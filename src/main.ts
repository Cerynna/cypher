import "@fontsource-variable/kode-mono";
import "@fontsource/noto-color-emoji";
import "@xterm/xterm/css/xterm.css";
import "./styles.css";
import { WorkspaceController } from "./application/workspace-controller";
import { ACTION_IDS, ACTION_LABELS, type ActionId, isActionId } from "./domain/actions";
import { commandPrompt, explainPrompt, extractCommand, type ShellContext } from "./domain/ai-prompts";
import { durationMs, formatDuration, shouldNotifyCompletion } from "./domain/command-history";
import type { InterruptedCommand } from "./application/ports";
import type { Config } from "./domain/config";
import { FontSize } from "./domain/font-size";
import { formatChord, Keymap } from "./domain/keymap";
import { type ClaudeSession, isClaudeCommand, matchSession, resumeCommand } from "./domain/claude-sessions";
import { editorInvocation } from "./domain/links";
import {
  type CommandOutcome,
  completionMessage,
  plainText,
  type QuickCommand,
  terminalInput,
  waitsForCompletion,
} from "./domain/quick-commands";
import { resolveTheme } from "./domain/themes";
import { windowTitle } from "./domain/window-title";
import { type LoadedConfig, loadConfig, saveConfig, watchConfig } from "./infrastructure/config-file";
import { LocalSessionStore } from "./infrastructure/local-session-store";
import {
  applyWindowBlur,
  askClaude,
  bindQuakeShortcut,
  claudeSessions,
  closeWindow,
  notify,
  openExternalUrl,
  onWindowClosing,
  openInEditor,
  platformName,
  runBackground,
  setWindowTitle,
} from "./infrastructure/system";
import { openAiCommand, openAiExplanation } from "./ui/ai-panel";
import { openResumeList, type ResumeEntry } from "./ui/claude-resume";
import { openCommandPalette } from "./ui/command-palette";
import { openOutputViewer } from "./ui/output-viewer";
import { attachTooltip } from "./ui/tooltip";
import { placeDock, type QuickCommandRun, renderQuickCommands } from "./ui/dock";
import { openQuickCommandForm } from "./ui/quick-command-form";
import { showToast } from "./ui/overlay";
import { SearchBar } from "./ui/search-bar";
import { openSettings } from "./ui/settings-panel";
import { type PaneServices, TerminalPane, type TerminalSettings } from "./ui/terminal-pane";
import { applyChromeTheme, xtermTheme } from "./ui/theme";
import { attachResizeHandles, attachTitleBar } from "./ui/title-bar";
import { WorkspaceView } from "./ui/workspace-view";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`${selector} introuvable`);
  return element;
}

function reportError(error: unknown): void {
  showToast(error instanceof Error ? error.message : String(error), "error");
}

let loaded: LoadedConfig = await loadConfig();
let config: Config = loaded.config;
let keymap = Keymap.create(config.keybindings);
let fontSize = FontSize.create(config.font.size);
const systemTheme = matchMedia("(prefers-color-scheme: dark)");

const palette = () => resolveTheme(config.theme, systemTheme.matches);

function terminalSettings(): TerminalSettings {
  const colors = palette();
  return {
    fontFamily: config.font.family,
    fontSize: fontSize.value,
    lineHeight: config.font.lineHeight,
    theme: xtermTheme(colors, config.terminal.opacity),
    scrollback: config.terminal.scrollback,
    cursorStyle: config.terminal.cursorStyle,
    cursorBlink: config.terminal.cursorBlink,
    copyOnSelect: config.terminal.copyOnSelect,
    dangerColor: colors.danger,
    successColor: colors.success,
  };
}

function shellContext(cwd: string | undefined): ShellContext {
  const shell = config.shell.program || (platformName() === "Windows" ? "PowerShell" : "zsh");
  return { platform: platformName(), shell, cwd };
}

function openFile(path: string, line: number | undefined, column: number | undefined): void {
  const invocation = editorInvocation(config.editor.command, path, line, column);
  if (invocation) openInEditor(invocation).catch(reportError);
}

const services: PaneServices = {
  keymap: () => keymap,
  settings: terminalSettings,
  shell: () => (config.shell.program ? { program: config.shell.program, args: config.shell.args } : undefined),
  onAction: (action) => runAction(action),
  openFile,
  openUrl: (url) => void openExternalUrl(url).catch(reportError),
  onCommandFinished: (block, pane) => {
    if (!shouldNotifyCompletion(block, config.notifications.longCommandSeconds, document.hasFocus())) return;
    const status = block.exitCode === 0 ? "réussie" : `échec (code ${block.exitCode})`;
    const duration = formatDuration(durationMs(block) ?? 0);
    void notify(`CYPHER · ${pane.title}`, `${block.command ?? "commande"} : ${status} en ${duration}`);
  },
};

attachTitleBar(requireElement(".hud"));
attachResizeHandles(document.body);

const dockLayout = {
  frame: requireElement<HTMLElement>(".frame"),
  hud: requireElement<HTMLElement>(".hud"),
  hudAnchor: requireElement<HTMLElement>(".hud__pulse"),
  body: requireElement<HTMLElement>(".frame__body"),
  workspace: requireElement<HTMLElement>("#workspace"),
  dock: requireElement<HTMLElement>(".dock"),
};
const quickCommandsHost = requireElement<HTMLElement>(".dock__commands");

const view = WorkspaceView.create(requireElement(".dock__tabs"), requireElement("#workspace"), {
  onActivateTab: (id) => controller.activateTab(id),
  onCloseTab: (id) => controller.closeTab(id),
  onNewTab: () => controller.newTab(),
  onClosePane: (id) => controller.closePane(id),
  onRenameTab: (id, label) => controller.renameTab(id, label),
  onColorTab: (id, color) => controller.colorTab(id, color),
  onTabEditEnd: () => controller.focused?.focus(),
  onRendered: (focused) => void setWindowTitle(windowTitle(focused?.title ?? "")),
});

const controller = WorkspaceController.create<TerminalPane>({
  factory: { create: (request, events) => TerminalPane.create(request, events, services) },
  renderer: view,
  sessions: new LocalSessionStore(),
  window: { close: () => void closeWindow() },
  newId: () => crypto.randomUUID(),
});

const searchBar = SearchBar.attach(requireElement("#search-bar"), () => {
  const colors = palette();
  return {
    matchBackground: `${colors.highlight}66`,
    matchOverviewRuler: colors.highlight,
    activeMatchBackground: `${colors.warning}99`,
    activeMatchColorOverviewRuler: colors.warning,
  };
});

const refocus = () => controller.focused?.focus();

function applyFontSize(next: FontSize): void {
  fontSize = next;
  for (const pane of controller.all) pane.applySettings(terminalSettings());
}

const UNTRACKED_RUN: QuickCommandRun = { finished: () => undefined };

function announce(quickCommand: QuickCommand, outcome: CommandOutcome): void {
  const message = completionMessage(quickCommand, outcome, formatDuration);
  showToast(`${message.title}\n${message.body}`, message.failed ? "error" : "info", {
    label: "Voir la sortie",
    run: () => openOutputViewer(message.title, plainText(outcome.output), refocus),
  });
  void notify(message.title, message.body).catch(() => undefined);
}

function runInBackground(quickCommand: QuickCommand, run: QuickCommandRun): void {
  runBackground(quickCommand.command, controller.focused?.cwd)
    .then((result) =>
      announce(quickCommand, { exitCode: result.exitCode ?? undefined, durationMs: result.durationMs, output: result.output }),
    )
    .catch(reportError)
    .finally(run.finished);
}

function runQuickCommand(quickCommand: QuickCommand, run: QuickCommandRun = UNTRACKED_RUN): void {
  if (quickCommand.mode === "background") return runInBackground(quickCommand, run);
  if (quickCommand.mode === "tab" || !controller.focused) controller.newTab();
  const pane = controller.focused;
  if (!pane) return run.finished();
  if (waitsForCompletion(quickCommand)) {
    void pane.nextCommandFinished().then((block) => {
      run.finished();
      announce(quickCommand, { exitCode: block.exitCode, durationMs: durationMs(block), output: pane.outputOf(block) });
    });
  } else {
    run.finished();
  }
  pane.write(terminalInput(quickCommand));
  pane.focus();
}

async function saveAndApply(next: Config): Promise<void> {
  await saveConfig(next);
  applyConfig({ ...loaded, config: next, problems: [], exists: true });
}

function createQuickCommand(): void {
  openQuickCommandForm(
    (quickCommand) => void saveAndApply({ ...config, commands: [...config.commands, quickCommand] }).catch(reportError),
    refocus,
  );
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-action]")) {
  const action = button.dataset.action ?? "";
  if (!isActionId(action)) continue;
  button.addEventListener("click", () => runAction(action));
  attachTooltip(button, () => {
    const chord = keymap.chordsFor(action).map(formatChord)[0];
    return { title: ACTION_LABELS[action], lines: chord ? [{ text: chord, tone: "muted" }] : [] };
  });
}

const scanlines = requireElement<HTMLElement>(".scanlines");

function applyAppearance(): void {
  applyChromeTheme(palette(), config.terminal.opacity, config.font.family);
  scanlines.hidden = !config.terminal.scanlines;
  placeDock(dockLayout, config.tabs.position);
  for (const pane of controller.all) pane.applySettings(terminalSettings());
}

function previewConfig(draft: Config): void {
  config = draft;
  fontSize = FontSize.create(config.font.size);
  applyAppearance();
}

function applyConfig(next: LoadedConfig): void {
  loaded = next;
  config = next.config;
  keymap = Keymap.create(config.keybindings);
  fontSize = FontSize.create(config.font.size);
  applyAppearance();
  renderQuickCommands(quickCommandsHost, config.commands, { onRun: runQuickCommand, onCreate: createQuickCommand });
  void applyWindowBlur(config.terminal.blur).catch(() => undefined);
  void bindQuakeShortcut(config.quake.enabled, config.quake.shortcut).catch(reportError);
  const problems = [...next.problems, ...keymap.problems];
  if (problems.length > 0) showToast(`config.toml : ${problems.join(" · ")}`, "error");
}

function aiDisabled(): boolean {
  if (config.ai.enabled) return false;
  showToast("Assistant IA désactivé : activez-le dans les réglages (Ctrl+,).");
  return true;
}

function askForCommand(): void {
  const pane = controller.focused;
  if (!pane || aiDisabled()) return;
  openAiCommand({
    generate: async (request) => {
      const { system, prompt } = commandPrompt(request, shellContext(pane.cwd));
      return extractCommand(await askClaude(config.ai.model, system, prompt));
    },
    insert: (command) => pane.write(command),
    onClose: refocus,
  });
}

function explainLastFailure(): void {
  const pane = controller.focused;
  if (!pane || aiDisabled()) return;
  const block = pane.lastFailed;
  if (!block) return showToast("Aucune commande en échec dans ce panneau.");
  const { system, prompt } = explainPrompt(
    block.command ?? "(inconnue)",
    block.exitCode ?? 1,
    pane.outputOf(block),
    shellContext(pane.cwd),
  );
  openAiExplanation(block.command ?? "dernière erreur", askClaude(config.ai.model, system, prompt), refocus);
}

async function openConfigFile(): Promise<void> {
  if (!loaded.exists) await saveConfig(config);
  openFile(loaded.path, undefined, undefined);
}

const CLAUDE_SESSION_LIMIT = 50;
const RECENT_SESSIONS_SHOWN = 12;

function resumeInPane(paneId: string, command: string): void {
  if (!controller.pane(paneId)) {
    controller.newTab();
    controller.focused?.write(`${command}\r`);
    return;
  }
  controller.focusPane(paneId);
  controller.pane(paneId)?.write(`${command}\r`);
}

async function interruptedClaudeEntries(interrupted: readonly InterruptedCommand[]): Promise<readonly ResumeEntry[]> {
  const claudeRuns = interrupted.filter((run) => isClaudeCommand(run.command));
  return Promise.all(
    claudeRuns.map(async (run): Promise<ResumeEntry> => {
      const sessions = run.cwd ? await claudeSessions(run.cwd, CLAUDE_SESSION_LIMIT).catch(() => []) : [];
      const session = matchSession(run.command, run.startedAt, sessions);
      return {
        title: controller.tabLabelOf(run.paneId) ?? controller.pane(run.paneId)?.title ?? "claude",
        cwd: run.cwd,
        preview: session?.preview ?? null,
        lastActivity: session?.modifiedMs ?? run.startedAt,
        sessionFound: session !== undefined,
        resume: () => resumeInPane(run.paneId, resumeCommand(session?.id)),
      };
    }),
  );
}

async function offerInterruptedClaudeSessions(interrupted: readonly InterruptedCommand[]): Promise<void> {
  const entries = await interruptedClaudeEntries(interrupted);
  if (entries.length === 0) return;
  openResumeList(entries, {
    heading: "Sessions Claude interrompues",
    intro: "Ces sessions Claude tournaient à la fermeture de CYPHER. Reprends-les dans leur panneau d'origine.",
    emptyText: "",
    onClose: refocus,
  });
}

function sessionEntry(session: ClaudeSession, cwd: string): ResumeEntry {
  return {
    title: session.preview ? "Session Claude" : session.id.slice(0, 8),
    cwd,
    preview: session.preview,
    lastActivity: session.modifiedMs,
    sessionFound: true,
    resume: () => {
      controller.newTab();
      controller.focused?.write(`${resumeCommand(session.id)}\r`);
    },
  };
}

async function browseClaudeSessions(): Promise<void> {
  const cwd = controller.focused?.cwd;
  if (!cwd) return showToast("Dossier courant inconnu dans ce panneau.");
  const sessions = await claudeSessions(cwd, RECENT_SESSIONS_SHOWN);
  openResumeList(
    sessions.map((session) => sessionEntry(session, cwd)),
    {
      heading: "Reprendre une session Claude",
      intro: `Sessions récentes dans ${cwd.replace(/^\/home\/[^/]+/, "~")}. La session choisie s'ouvre dans un nouvel onglet.`,
      emptyText: "Aucune session Claude dans ce dossier.",
      onClose: refocus,
    },
  );
}

function openPalette(): void {
  const quickCommands = config.commands.map((quickCommand) => ({
    label: `${quickCommand.emoji} ${quickCommand.name}`,
    hint: quickCommand.command,
    run: () => runQuickCommand(quickCommand),
  }));
  const actionCommands = ACTION_IDS.filter((action) => action !== "commandPalette").map((action) => ({
    label: ACTION_LABELS[action],
    hint: keymap.chordsFor(action).map(formatChord)[0] ?? "",
    run: () => runAction(action),
  }));
  openCommandPalette([...quickCommands, ...actionCommands], refocus);
}

const actions: Readonly<Record<ActionId, () => void>> = {
  copy: () => void controller.focused?.clipboard.copySelection().catch(reportError),
  paste: () => void controller.focused?.clipboard.pasteFromClipboard().catch(reportError),
  find: () => {
    const pane = controller.focused;
    if (pane) searchBar.open(pane);
  },
  zoomIn: () => applyFontSize(fontSize.increase()),
  zoomOut: () => applyFontSize(fontSize.decrease()),
  zoomReset: () => applyFontSize(FontSize.create(config.font.size)),
  newTab: () => controller.newTab(),
  renameTab: () => {
    const tabId = controller.activeTabId;
    if (tabId) view.startRename(tabId);
  },
  closePane: () => controller.closeFocusedPane(),
  nextTab: () => controller.cycleTab(1),
  previousTab: () => controller.cycleTab(-1),
  splitRight: () => controller.split("horizontal"),
  splitDown: () => controller.split("vertical"),
  focusLeft: () => controller.moveFocus("left"),
  focusRight: () => controller.moveFocus("right"),
  focusUp: () => controller.moveFocus("up"),
  focusDown: () => controller.moveFocus("down"),
  previousCommand: () => controller.focused?.scrollToCommand(-1),
  nextCommand: () => controller.focused?.scrollToCommand(1),
  copyLastOutput: () =>
    void controller.focused
      ?.copyLastOutput()
      .then((copied) => showToast(copied ? "Sortie copiée." : "Aucune commande terminée dans ce panneau."))
      .catch(reportError),
  commandPalette: openPalette,
  settings: () =>
    openSettings(config, loaded.path, {
      onSave: (next) => saveAndApply(next).catch(reportError),
      onPreview: previewConfig,
      onOpenFile: () => void openConfigFile().catch(reportError),
      onClose: refocus,
    }),
  openConfigFile: () => void openConfigFile().catch(reportError),
  aiCommand: askForCommand,
  aiExplain: explainLastFailure,
  newQuickCommand: createQuickCommand,
  resumeClaude: () => void browseClaudeSessions().catch(reportError),
};

function runAction(action: ActionId): void {
  actions[action]();
}

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.target instanceof HTMLInputElement) return;
  const action = keymap.resolve(event);
  if (!action) return;
  event.preventDefault();
  runAction(action);
});

systemTheme.addEventListener("change", () => applyConfig(loaded));

const COMMON_EMOJIS = "🚀✅❌⚠️🔥✨📦🐳🧪🔨📈💾🔍⚡";
await Promise.all([
  document.fonts.load(`${fontSize.value}px '${config.font.family}'`),
  document.fonts.load(`${fontSize.value}px 'Noto Color Emoji'`, COMMON_EMOJIS + config.commands.map((c) => c.emoji).join("")),
]).catch(() => undefined);
applyConfig(loaded);
void onWindowClosing(() => controller.freeze());
const interrupted = controller.start();
void offerInterruptedClaudeSessions(interrupted).catch(reportError);
void watchConfig(() => void loadConfig().then(applyConfig).catch(reportError));
