import "@fontsource-variable/kode-mono";
import "@fontsource/noto-color-emoji";
import "@xterm/xterm/css/xterm.css";
import "./styles.css";
import { ClaudeResume } from "./application/claude-resume";
import { type QuickCommandExecution, QuickCommandRunner } from "./application/quick-command-runner";
import { WorkspaceController } from "./application/workspace-controller";
import { ACTION_IDS, ACTION_LABELS, type ActionId, HIDDEN_FROM_PALETTE, isActionId } from "./domain/actions";
import { commandPrompt, explainPrompt, extractCommand, type ShellContext } from "./domain/ai-prompts";
import { claudeDashboard } from "./domain/claude-dashboard";
import { ClipboardHistory } from "./domain/clipboard-history";
import { commandIn } from "./domain/command-log";
import { type CommandBlock, durationMs, formatDuration, shouldNotifyCompletion } from "./domain/command-history";
import type { InterruptedCommand } from "./application/ports";
import type { Config } from "./domain/config";
import { FontSize } from "./domain/font-size";
import { formatChord, Keymap } from "./domain/keymap";
import { editorInvocation } from "./domain/links";
import type { Project } from "./domain/project-scripts";
import { plainText, type QuickCommand } from "./domain/quick-commands";
import { directoryName } from "./domain/shell-integration";
import { resolveTheme } from "./domain/themes";
import { windowTitle } from "./domain/window-title";
import { type LoadedConfig, loadConfig, saveConfig, watchConfig } from "./infrastructure/config-file";
import { LocalSessionStore } from "./infrastructure/local-session-store";
import {
  applyWindowBlur,
  appVersion,
  askClaude,
  bindQuakeShortcut,
  cancelBackground,
  claudeSessions,
  closeWindow,
  configureHost,
  type HostInfo,
  NATIVE_HOST,
  notify,
  onWindowClosing,
  openExternalUrl,
  openInEditor,
  platformName,
  runBackground,
  setWindowTitle,
  toggleFullscreen,
} from "./infrastructure/system";
import { findUpdate } from "./infrastructure/updater";
import { loadCommandLog, saveCommandLog } from "./infrastructure/local-command-log";
import { loadHighScores, saveHighScores } from "./infrastructure/local-high-scores";
import { readNotes, writeNotes } from "./infrastructure/notes-file";
import { fileDiff, projectAt, repositoryStatus } from "./infrastructure/project";
import { openAiCommand, openAiExplanation } from "./ui/ai-panel";
import { openBreach } from "./ui/breach-game";
import { openResumeList } from "./ui/claude-resume";
import { ClaudeView } from "./ui/claude-panel";
import { onCopy, readClipboardText } from "./ui/clipboard";
import { ClipboardView } from "./ui/clipboard-panel";
import { NotesWindow } from "./ui/notes-window";
import { ProjectView } from "./ui/project-panel";
import { Sidebar, type SidebarTool } from "./ui/sidebar";
import { openCommandPalette } from "./ui/command-palette";
import { openOutputViewer } from "./ui/output-viewer";
import { attachTooltip } from "./ui/tooltip";
import { placeDock, renderQuickCommands } from "./ui/dock";
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

let host: HostInfo = NATIVE_HOST;

async function configureHostOnce(mode: string): Promise<void> {
  host = await configureHost(mode).catch((error: unknown) => {
    reportError(error);
    return NATIVE_HOST;
  });
  if (host.configError) showToast(`Config WSL inaccessible, config Windows utilisée : ${host.configError}`, "error");
  if (host.kind === "wsl") applyConfig(await loadConfig());
}

function shellContext(cwd: string | undefined): ShellContext {
  if (host.kind === "wsl") return { platform: `Linux (WSL ${host.distro})`, shell: config.shell.program || "zsh", cwd };
  const shell = config.shell.program || (platformName() === "Windows" ? "PowerShell" : "zsh");
  return { platform: platformName(), shell, cwd };
}

function openWithEditor(path: string, line: number | undefined, column: number | undefined, wslDistro?: string): void {
  const invocation = editorInvocation(config.editor.command, path, line, column, wslDistro);
  if (invocation) openInEditor(invocation).catch(reportError);
}

function openFile(path: string, line: number | undefined, column: number | undefined): void {
  openWithEditor(path, line, column, host.distro ?? undefined);
}

const services: PaneServices = {
  keymap: () => keymap,
  settings: terminalSettings,
  shell: () => (config.shell.program ? { program: config.shell.program, args: config.shell.args } : undefined),
  onAction: (action) => runAction(action),
  openFile,
  openUrl: (url) => void openExternalUrl(url).catch(reportError),
  onAttention: (pane, signal) => {
    const tab = controller.tabLabelOf(pane.id) ?? pane.title;
    const title = `🔔 ${signal.title ?? "Attention"} · ${tab}`;
    if (!document.hasFocus()) return void notify(title, signal.body).catch(() => undefined);
    showToast(`${title}\n${signal.body}`, "info", { label: "Voir", run: () => controller.focusPane(pane.id) });
  },
  onCommandFinished: (block, pane) => {
    recordCommand(block, pane);
    if (pane === controller.focused) void refreshProject();
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
  hudAnchor: requireElement<HTMLElement>(".hud__version"),
  body: requireElement<HTMLElement>(".frame__body"),
  main: requireElement<HTMLElement>(".frame__main"),
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
  onResizeSplit: (path, ratio) => controller.resizeSplit(path, ratio),
  onRendered: (focused) => {
    void setWindowTitle(windowTitle(focused?.title ?? ""));
    renderClaudeSessions();
    followFocusedProject(focused);
  },
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

const pasteInTerminal = (text: string) => void controller.focused?.clipboard.paste(text).catch(reportError);

let clipboardHistory = ClipboardHistory.create();
const clipboardView = ClipboardView.create({
  onPaste: pasteInTerminal,
  onRemove: (text) => updateClipboardHistory(clipboardHistory.remove(text)),
  onClear: () => updateClipboardHistory(clipboardHistory.clear()),
});
const claudeView = ClaudeView.create(
  (paneId) => controller.focusPane(paneId),
  () => renderClaudeSessions(),
);
const projectView = ProjectView.create({
  onRefresh: () => void refreshProject(),
  onShow: () => void refreshProject(),
  onRunScript: (script) => runInTerminal(script.name, script.command, "run"),
  onShowDiff: (root, file) => void showDiff(root, file.path).catch(reportError),
  onOpenFile: (root, file) => openFile(`${root}/${file.path}`, undefined, undefined),
});
const sidebar = Sidebar.create([clipboardView.view, claudeView.view, projectView.view], () => {
  sidebar.close();
  refocus();
});
dockLayout.main.append(sidebar.element);
clipboardView.render(clipboardHistory);

function toggleSidebar(tool?: SidebarTool): void {
  sidebar.toggle(tool);
  refocus();
}

function updateClipboardHistory(next: ClipboardHistory): void {
  clipboardHistory = next;
  clipboardView.render(next);
}

onCopy((text) => updateClipboardHistory(clipboardHistory.record(text, Date.now())));
window.addEventListener("focus", () => {
  void readClipboardText();
  if (sidebar.showing === "project") void refreshProject();
});

function renderClaudeSessions(): void {
  if (sidebar.showing !== "claude") return;
  const snapshots = controller.all.map((pane) => ({
    paneId: pane.id,
    tabLabel: controller.tabLabelOf(pane.id) ?? (pane.cwd ? directoryName(pane.cwd) : "shell"),
    title: pane.terminalTitle,
    command: pane.runningCommand?.command,
    startedAt: pane.runningCommand?.startedAt,
    waitingFor: pane.waitingFor,
  }));
  claudeView.render(claudeDashboard(snapshots), Date.now());
}

setInterval(renderClaudeSessions, 15_000);

let project: Project | undefined;
let projectRequest = 0;
let followedProject = "";

function followFocusedProject(focused: TerminalPane | undefined): void {
  const key = `${focused?.id ?? ""}\u0000${focused?.cwd ?? ""}`;
  if (key === followedProject) return;
  followedProject = key;
  void refreshProject();
}

async function refreshProject(): Promise<void> {
  const request = ++projectRequest;
  const cwd = controller.focused?.cwd;
  if (!cwd) {
    project = undefined;
    return projectView.render({ kind: "none" });
  }
  const withGit = sidebar.showing === "project";
  try {
    const [repository, found] = await Promise.all([withGit ? repositoryStatus(cwd) : undefined, projectAt(cwd)]);
    if (request !== projectRequest) return;
    project = found;
    if (withGit) projectView.render({ kind: "ready", repository, project: found });
  } catch (error) {
    if (request === projectRequest) projectView.render({ kind: "error", message: String(error) });
  }
}

async function showDiff(root: string, path: string): Promise<void> {
  const diff = await fileDiff(root, path);
  openOutputViewer(path, diff || "Aucune différence avec HEAD.", refocus);
}

function runInTerminal(name: string, command: string, mode: "run" | "type"): void {
  const busy = controller.focused?.runningCommand !== undefined;
  runQuickCommand({ emoji: "▶", name, command, mode: busy ? "tab" : mode, notify: false });
}

let commandLog = loadCommandLog();

function recordCommand(block: CommandBlock<unknown>, pane: TerminalPane): void {
  if (!block.command) return;
  commandLog = commandLog.record({
    command: block.command,
    cwd: pane.cwd,
    exitCode: block.exitCode,
    durationMs: durationMs(block),
    finishedAt: Date.now(),
  });
  saveCommandLog(commandLog);
}

function searchHistory(): void {
  const currentCwd = controller.focused?.cwd;
  const entries = commandLog.latestDistinct().map((entry) => {
    const command = commandIn(entry, currentCwd);
    const status = entry.exitCode === undefined ? "" : entry.exitCode === 0 ? "✓" : `✗ ${entry.exitCode}`;
    return {
      label: entry.command,
      hint: [entry.cwd ? directoryName(entry.cwd) : "", status].filter(Boolean).join(" · "),
      run: () => runInTerminal(entry.command, command, "type"),
      runAlternate: () => runInTerminal(entry.command, command, "run"),
    };
  });
  openCommandPalette(entries, refocus, {
    title: "Historique des commandes",
    placeholder: "Rechercher une commande…",
    footer: "Entrée : taper dans le terminal · Maj+Entrée : exécuter",
  });
}

const notesWindow = NotesWindow.create({
  load: readNotes,
  save: writeNotes,
  onSend: pasteInTerminal,
  onOpenUrl: (url) => void openExternalUrl(url).catch(reportError),
  onClose: () => {
    notesWindow.close();
    refocus();
  },
  onError: reportError,
});
document.body.append(notesWindow.element);

function toggleNotes(): void {
  if (!notesWindow.isOpen) return void notesWindow.open();
  notesWindow.close();
  refocus();
}

function applyFontSize(next: FontSize): void {
  fontSize = next;
  for (const pane of controller.all) pane.applySettings(terminalSettings());
}

const quickCommands = QuickCommandRunner.create<TerminalPane>({
  workspace: controller,
  background: { run: runBackground, cancel: cancelBackground },
  notifier: {
    notify: (completion) => {
      showToast(`${completion.title}\n${completion.body}`, completion.failed ? "error" : "info", {
        label: "Voir la sortie",
        run: () => openOutputViewer(completion.title, plainText(completion.output), refocus),
      });
      void notify(completion.title, completion.body).catch(() => undefined);
    },
  },
  newId: () => crypto.randomUUID(),
});

function runQuickCommand(quickCommand: QuickCommand): QuickCommandExecution {
  const execution = quickCommands.run(quickCommand);
  execution.finished.catch(reportError);
  return execution;
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

async function checkForUpdate(): Promise<boolean> {
  const update = await findUpdate();
  if (!update) return false;
  showToast(`CYPHER ${update.version} est disponible.`, "info", {
    label: "Mettre à jour",
    run: () => {
      showToast(`Téléchargement de CYPHER ${update.version}…`);
      void update.install(() => controller.freeze()).catch(reportError);
    },
  });
  return true;
}

async function openConfigFile(): Promise<void> {
  if (!loaded.exists) await saveConfig(config);
  openFile(loaded.path, undefined, undefined);
}

const claudeResume = ClaudeResume.create<TerminalPane>({
  workspace: controller,
  sessions: { list: claudeSessions },
});

async function offerInterruptedClaudeSessions(interrupted: readonly InterruptedCommand[]): Promise<void> {
  const candidates = await claudeResume.interrupted(interrupted);
  if (candidates.length === 0) return;
  openResumeList(candidates, {
    heading: "Sessions Claude interrompues",
    intro: "Ces sessions Claude tournaient à la fermeture de CYPHER. Reprends-les dans leur panneau d'origine.",
    emptyText: "",
    onClose: refocus,
  });
}

async function browseClaudeSessions(): Promise<void> {
  const recent = await claudeResume.recent();
  if (!recent) return showToast("Dossier courant inconnu dans ce panneau.");
  openResumeList(recent.candidates, {
    heading: "Reprendre une session Claude",
    intro: `Sessions récentes dans ${recent.cwd.replace(/^\/home\/[^/]+/, "~")}. La session choisie s'ouvre dans un nouvel onglet.`,
    emptyText: "Aucune session Claude dans ce dossier.",
    onClose: refocus,
  });
}

function openPalette(): void {
  const quickCommands = config.commands.map((quickCommand) => ({
    label: `${quickCommand.emoji} ${quickCommand.name}`,
    hint: quickCommand.command,
    run: () => runQuickCommand(quickCommand),
  }));
  const actionCommands = ACTION_IDS.filter((action) => !HIDDEN_FROM_PALETTE.has(action)).map((action) => ({
    label: ACTION_LABELS[action],
    hint: keymap.chordsFor(action).map(formatChord)[0] ?? "",
    run: () => runAction(action),
  }));
  const scripts = (project?.scripts ?? []).map((script) => ({
    label: `▶ ${script.name}`,
    hint: script.command,
    run: () => runInTerminal(script.name, script.command, "run"),
  }));
  openCommandPalette([...quickCommands, ...scripts, ...actionCommands], refocus);
}

const actions: Readonly<Record<ActionId, () => void>> = {
  copy: () => void controller.focused?.clipboard.copySelection().catch(reportError),
  copyOrInterrupt: () => void controller.focused?.clipboard.copySelection().catch(reportError),
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
    openSettings(config, loaded.path, { hostModeEditable: platformName() === "Windows" && host.kind === "native" }, {
      onSave: (next) => saveAndApply(next).catch(reportError),
      onPreview: previewConfig,
      onOpenFile: () => void openConfigFile().catch(reportError),
      onClose: refocus,
    }),
  openConfigFile: () => void openConfigFile().catch(reportError),
  toggleFullscreen: () => void toggleFullscreen().catch(reportError),
  toggleSidebar: () => toggleSidebar(),
  toggleClipboardHistory: () => toggleSidebar("clipboard"),
  toggleClaudeSessions: () => toggleSidebar("claude"),
  toggleProjectPanel: () => toggleSidebar("project"),
  searchHistory,
  toggleNotes,
  aiCommand: askForCommand,
  aiExplain: explainLastFailure,
  newQuickCommand: createQuickCommand,
  resumeClaude: () => void browseClaudeSessions().catch(reportError),
  checkForUpdate: () => {
    refocus();
    void checkForUpdate()
      .then((found) => found || showToast("CYPHER est à jour."))
      .catch(reportError);
  },
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
await configureHostOnce(config.shell.wsl);
void onWindowClosing(() => controller.freeze());
const interrupted = controller.start();
void offerInterruptedClaudeSessions(interrupted).catch(reportError);
requireElement<HTMLElement>(".hud__pulse").addEventListener("dblclick", (event) => {
  event.stopPropagation();
  openBreach({ load: loadHighScores, save: saveHighScores }, refocus);
});
void appVersion()
  .then((version) => {
    requireElement<HTMLElement>(".hud__version").textContent = `v${version}`;
  })
  .catch(() => undefined);
void checkForUpdate().catch(() => undefined);
void watchConfig(() => void loadConfig().then(applyConfig).catch(reportError));
