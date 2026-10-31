import { FitAddon } from "@xterm/addon-fit";
import { ImageAddon } from "@xterm/addon-image";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import type { IBufferRange, IDisposable, ILink, IMarker, ITheme, Terminal as XTerm } from "@xterm/xterm";
import { Terminal } from "@xterm/xterm";
import type { CommandPane, FinishedCommand, Pane, PaneEvents, PaneRequest, RunningCommand } from "../application/ports";
import { type ActionId, passesThroughToShell } from "../domain/actions";
import { type CommandBlock, CommandHistory, durationMs, formatDuration } from "../domain/command-history";
import type { CursorStyle } from "../domain/config";
import type { Keymap } from "../domain/keymap";
import { type AttentionSignal, BELL_SIGNAL, KittyNotifications, parseOsc777, parseOsc9 } from "../domain/attention";
import { FlowControl } from "../domain/flow-control";
import { findFileLinks } from "../domain/links";
import type { PaneId } from "../domain/pane-tree";
import { paneTitle } from "../domain/pane-title";
import { parseSemanticPrompt, parseWorkingDirectory, type ShellEvent } from "../domain/shell-integration";
import { existingPaths, repoRootOf } from "../infrastructure/system";
import { Pty, type ShellOverride } from "../infrastructure/tauri-pty";
import { copyText, TerminalClipboard } from "./clipboard";
import { fontStack } from "./theme";

export type TerminalSettings = {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly theme: ITheme;
  readonly scrollback: number;
  readonly cursorStyle: CursorStyle;
  readonly cursorBlink: boolean;
  readonly copyOnSelect: boolean;
  readonly dangerColor: string;
  readonly successColor: string;
};

export type PaneServices = {
  readonly keymap: () => Keymap;
  readonly settings: () => TerminalSettings;
  readonly shell: () => ShellOverride | undefined;
  readonly onAction: (action: ActionId) => void;
  readonly openFile: (path: string, line: number | undefined, column: number | undefined) => void;
  readonly openUrl: (url: string) => void;
  readonly onCommandFinished: (block: CommandBlock<IMarker>, pane: TerminalPane) => void;
  readonly onAttention: (pane: TerminalPane, signal: AttentionSignal) => void;
};

const OSC_SEMANTIC_PROMPT = 133;
const OSC_WORKING_DIRECTORY = 7;
const FOCUS_REPORTS: ReadonlySet<string> = new Set(["\x1b[I", "\x1b[O"]);
const OSC_ITERM_NOTIFICATION = 9;
const OSC_KITTY_NOTIFICATION = 99;
const OSC_DESKTOP_NOTIFICATION = 777;

function lineText(terminal: XTerm, from: number, to: number): string {
  const buffer = terminal.buffer.active;
  let text = "";
  for (let y = from; y < to; y += 1) {
    const line = buffer.getLine(y);
    if (!line) continue;
    const separator = y === from || line.isWrapped ? "" : "\n";
    text += separator + line.translateToString(true);
  }
  return text.trimEnd();
}

export class TerminalPane implements Pane, CommandPane {
  private history = CommandHistory.empty<IMarker>();
  private cwdValue: string | undefined;
  private repoRoot: string | undefined;
  private shellTitle = "";
  private pty: Pty | undefined;
  private pendingInput = "";
  private attentionSignal: AttentionSignal | undefined;
  private awaitedSignal: AttentionSignal | undefined;
  private readonly kittyNotifications = new KittyNotifications();
  private readonly flow = FlowControl.create();
  private completionWaiters: ((finished: FinishedCommand) => void)[] = [];
  private opened = false;
  private disposed = false;
  private readonly disposables: IDisposable[] = [];
  private readonly resizeObserver = new ResizeObserver(() => this.fit());

  private constructor(
    readonly id: PaneId,
    readonly element: HTMLElement,
    private readonly terminal: XTerm,
    private readonly fitAddon: FitAddon,
    readonly search: SearchAddon,
    readonly clipboard: TerminalClipboard,
    private readonly events: PaneEvents,
    private readonly services: PaneServices,
  ) {}

  static create(request: PaneRequest, events: PaneEvents, services: PaneServices): TerminalPane {
    const settings = services.settings();
    const terminal = new Terminal({
      allowProposedApi: true,
      allowTransparency: true,
      fontFamily: fontStack(settings.fontFamily),
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      theme: settings.theme,
      scrollback: settings.scrollback,
      cursorStyle: settings.cursorStyle,
      cursorBlink: settings.cursorBlink,
      cursorWidth: 2,
      rightClickSelectsWord: false,
    });
    const fitAddon = new FitAddon();
    const search = new SearchAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(search);
    terminal.loadAddon(new Unicode11Addon());
    terminal.unicode.activeVersion = "11";

    const element = document.createElement("div");
    element.className = "pane";
    element.dataset.paneId = request.id;
    const clipboard = TerminalClipboard.attach(terminal, element);
    const pane = new TerminalPane(request.id, element, terminal, fitAddon, search, clipboard, events, services);
    pane.cwdValue = request.cwd;
    if (request.cwd) void pane.refreshRepoRoot(request.cwd);
    return pane;
  }

  get cwd(): string | undefined {
    return this.cwdValue;
  }

  get runningCommand(): RunningCommand | undefined {
    const current = this.history.current;
    if (current?.startedAt === undefined || current.finishedAt !== undefined || !current.command) return undefined;
    return { command: current.command, startedAt: current.startedAt };
  }

  get attention(): AttentionSignal | undefined {
    return this.attentionSignal;
  }

  get terminalTitle(): string {
    return this.shellTitle;
  }

  get waitingFor(): string | undefined {
    return this.awaitedSignal?.body;
  }

  get title(): string {
    return paneTitle({
      runningCommand: this.runningCommand?.command,
      repoRoot: this.repoRoot,
      cwd: this.cwdValue,
      shellTitle: this.shellTitle,
    });
  }

  get lastFailed(): CommandBlock<IMarker> | undefined {
    return this.history.lastFailed;
  }

  mount(): void {
    if (this.opened || this.disposed || !this.element.isConnected) return;
    this.opened = true;
    this.terminal.open(this.element);
    this.loadGpuRendererWhenAvailable();
    this.terminal.loadAddon(new ImageAddon());
    this.terminal.loadAddon(new WebLinksAddon((_event, uri) => this.services.openUrl(uri)));
    this.registerShellIntegration();
    this.registerFileLinks();
    this.registerInput();
    this.resizeObserver.observe(this.element);
    this.fit();
    void this.spawnShell();
  }

  focus(): void {
    this.terminal.focus();
  }

  fit(): void {
    if (this.opened && this.element.isConnected && this.element.clientWidth > 0) this.fitAddon.fit();
  }

  applySettings(settings: TerminalSettings): void {
    const options = this.terminal.options;
    options.fontFamily = fontStack(settings.fontFamily);
    options.fontSize = settings.fontSize;
    options.lineHeight = settings.lineHeight;
    options.theme = settings.theme;
    options.scrollback = settings.scrollback;
    options.cursorStyle = settings.cursorStyle;
    options.cursorBlink = settings.cursorBlink;
    this.fit();
  }

  nextCommandFinished(): Promise<FinishedCommand> {
    return new Promise((resolve) => this.completionWaiters.push(resolve));
  }

  write(data: string): void {
    if (this.pty) void this.pty.write(data);
    else this.pendingInput += data;
  }

  scrollToCommand(direction: -1 | 1): void {
    const top = this.terminal.buffer.active.viewportY;
    const lines = this.history.blocks
      .map((block) => block.promptAnchor.line)
      .filter((line) => line >= 0);
    const target = direction < 0 ? lines.findLast((line) => line < top) : lines.find((line) => line > top);
    if (target !== undefined) this.terminal.scrollToLine(target);
  }

  outputOf(block: CommandBlock<IMarker>): string {
    const start = block.outputAnchor?.line ?? -1;
    const end = block.endAnchor?.line ?? -1;
    return start >= 0 && end >= start ? lineText(this.terminal, start, end) : "";
  }

  async copyLastOutput(): Promise<boolean> {
    const block = this.history.lastFinished;
    if (!block) return false;
    await copyText(this.outputOf(block));
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.resizeObserver.disconnect();
    for (const disposable of this.disposables) disposable.dispose();
    void this.pty?.close();
    this.terminal.dispose();
    this.element.remove();
  }

  private loadGpuRendererWhenAvailable(): void {
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      this.terminal.loadAddon(webgl);
    } catch {
      console.warn("WebGL indisponible, rendu DOM conservé");
    }
  }

  private async spawnShell(): Promise<void> {
    try {
      this.pty = await Pty.create(
        { cols: this.terminal.cols, rows: this.terminal.rows, cwd: this.cwdValue, shell: this.services.shell() },
        {
          onOutput: (data) => this.writeOutput(data),
          onExit: () => this.events.onExit(),
        },
      );
      if (this.disposed) return void this.pty.close();
      if (this.pendingInput) void this.pty.write(this.pendingInput);
      this.pendingInput = "";
    } catch (error) {
      this.terminal.write(`\x1b[31mImpossible d'ouvrir le shell : ${error}\x1b[0m\r\n`);
    }
  }

  private isWatched(): boolean {
    return document.hasFocus() && document.activeElement === this.terminal.textarea;
  }

  private raiseAttention(signal: AttentionSignal): void {
    this.awaitedSignal = signal;
    if (this.isWatched()) return this.events.onChange();
    this.attentionSignal = signal;
    this.services.onAttention(this, signal);
    this.events.onChange();
  }

  private stopAwaiting(): void {
    if (!this.awaitedSignal) return;
    this.awaitedSignal = undefined;
    this.events.onChange();
  }

  private clearAttention(): void {
    if (!this.attentionSignal) return;
    this.attentionSignal = undefined;
    this.events.onChange();
  }

  private async refreshRepoRoot(cwd: string): Promise<void> {
    const root = await repoRootOf(cwd);
    if (this.cwdValue !== cwd || root === this.repoRoot) return;
    this.repoRoot = root;
    this.events.onChange();
  }

  private writeOutput(data: Uint8Array): void {
    if (this.flow.received(data.length) === "pause") void this.pty?.setPaused(true);
    this.terminal.write(data, () => {
      if (this.flow.rendered(data.length) === "resume") void this.pty?.setPaused(false);
    });
  }

  private registerInput(): void {
    this.terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      const action = this.services.keymap().resolve(event);
      if (!action || passesThroughToShell(action, this.terminal.hasSelection())) return true;
      event.preventDefault();
      this.services.onAction(action);
      return false;
    });
    this.disposables.push(
      this.terminal.onData((data) => {
        void this.pty?.write(data);
        if (!FOCUS_REPORTS.has(data)) this.stopAwaiting();
      }),
      this.terminal.onResize((size) => void this.pty?.resize(size)),
      this.terminal.onTitleChange((title) => {
        this.shellTitle = title;
        this.events.onChange();
      }),
      this.terminal.onSelectionChange(() => {
        if (this.services.settings().copyOnSelect && this.terminal.hasSelection()) {
          void copyText(this.terminal.getSelection());
        }
      }),
    );
    this.terminal.textarea?.addEventListener("focus", () => {
      this.clearAttention();
      this.events.onFocus();
    });
    this.element.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const done = this.terminal.hasSelection() ? this.clipboard.copySelection() : this.clipboard.pasteFromClipboard();
      void done.catch(() => undefined).finally(() => this.terminal.focus());
    });
  }

  private registerShellIntegration(): void {
    const notify = (parse: (payload: string) => AttentionSignal | undefined) => (payload: string) => {
      const signal = parse(payload);
      if (signal) this.raiseAttention(signal);
      return true;
    };
    this.disposables.push(
      this.terminal.parser.registerOscHandler(OSC_ITERM_NOTIFICATION, notify(parseOsc9)),
      this.terminal.parser.registerOscHandler(OSC_DESKTOP_NOTIFICATION, notify(parseOsc777)),
      this.terminal.parser.registerOscHandler(OSC_KITTY_NOTIFICATION, notify((payload) => this.kittyNotifications.receive(payload))),
      this.terminal.onBell(() => this.raiseAttention(BELL_SIGNAL)),
      this.terminal.parser.registerOscHandler(OSC_SEMANTIC_PROMPT, (payload) => {
        const event = parseSemanticPrompt(payload);
        if (event) this.onShellEvent(event);
        return true;
      }),
      this.terminal.parser.registerOscHandler(OSC_WORKING_DIRECTORY, (payload) => {
        const cwd = parseWorkingDirectory(payload);
        if (cwd && cwd !== this.cwdValue) {
          this.cwdValue = cwd;
          this.events.onChange();
          void this.refreshRepoRoot(cwd);
        }
        return true;
      }),
    );
  }

  private onShellEvent(event: ShellEvent): void {
    const marker = this.terminal.registerMarker(0);
    if (!marker) return;
    const previous = this.history;
    this.history = this.history.apply(event, marker, Date.now());
    if (this.history === previous) return marker.dispose();
    if (event.kind === "commandStart") this.events.onChange();
    if (event.kind === "commandEnd") {
      const block = this.history.current;
      if (block?.finishedAt !== undefined) this.onCommandFinished(block);
    }
  }

  private onCommandFinished(block: CommandBlock<IMarker>): void {
    this.decorateBlock(block);
    const waiters = this.completionWaiters;
    this.completionWaiters = [];
    const finished: FinishedCommand = {
      command: block.command,
      exitCode: block.exitCode,
      durationMs: durationMs(block),
      output: this.outputOf(block),
    };
    for (const resolve of waiters) resolve(finished);
    this.services.onCommandFinished(block, this);
    this.events.onChange();
  }

  private decorateBlock(block: CommandBlock<IMarker>): void {
    const settings = this.services.settings();
    const failed = block.exitCode !== undefined && block.exitCode !== 0;
    const duration = durationMs(block);
    const label = [failed ? `✗ ${block.exitCode}` : "✓", duration === undefined ? "" : formatDuration(duration)]
      .filter(Boolean)
      .join(" · ");
    const status = this.terminal.registerDecoration({
      marker: block.promptAnchor,
      anchor: "right",
      x: 1,
      width: label.length + 2,
      layer: "top",
      overviewRulerOptions: { color: failed ? settings.dangerColor : settings.successColor, position: "left" },
    });
    status?.onRender((element) => {
      element.classList.add("block-status", failed ? "block-status--failed" : "block-status--ok");
      element.textContent = label;
    });
    const endLine = block.endAnchor?.line ?? -1;
    if (!failed || endLine < block.promptAnchor.line) return;
    const gutter = this.terminal.registerDecoration({
      marker: block.promptAnchor,
      x: 0,
      width: 1,
      height: Math.max(1, endLine - block.promptAnchor.line),
      layer: "top",
    });
    gutter?.onRender((element) => {
      element.classList.add("block-gutter--failed");
    });
  }

  private registerFileLinks(): void {
    this.disposables.push(
      this.terminal.registerLinkProvider({
        provideLinks: (y, callback) => {
          const text = this.terminal.buffer.active.getLine(y - 1)?.translateToString(true) ?? "";
          const candidates = findFileLinks(text);
          if (candidates.length === 0) return callback(undefined);
          existingPaths(
            this.cwdValue,
            candidates.map((candidate) => candidate.path),
          )
            .then((resolved) => {
              const links = candidates.flatMap((candidate, index): ILink[] => {
                const path = resolved[index];
                if (!path) return [];
                const range: IBufferRange = {
                  start: { x: candidate.start + 1, y },
                  end: { x: candidate.start + candidate.length, y },
                };
                return [
                  {
                    range,
                    text: text.slice(candidate.start, candidate.start + candidate.length),
                    decorations: { underline: true, pointerCursor: true },
                    activate: () => this.services.openFile(path, candidate.line, candidate.column),
                  },
                ];
              });
              callback(links.length > 0 ? links : undefined);
            })
            .catch(() => callback(undefined));
        },
      }),
    );
  }
}
