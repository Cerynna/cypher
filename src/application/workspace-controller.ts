import type { Direction, Orientation, PaneId, SplitPath } from "../domain/pane-tree";
import { containsPane, paneIds } from "../domain/pane-tree";
import { type TabColor, type TabId, Workspace } from "../domain/workspace";
import type {
  AppWindow,
  InterruptedCommand,
  Pane,
  PaneFactory,
  RunningCommand,
  SessionSnapshot,
  SessionStore,
  WorkspaceRenderer,
} from "./ports";

export type WorkspaceControllerDeps<P extends Pane> = {
  readonly factory: PaneFactory<P>;
  readonly renderer: WorkspaceRenderer<P>;
  readonly sessions: SessionStore;
  readonly window: AppWindow;
  readonly newId: () => string;
};

function readCwds(raw: unknown): Readonly<Record<PaneId, string>> {
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function readRunning(raw: unknown): Readonly<Record<PaneId, RunningCommand>> {
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, RunningCommand] => {
      const value = entry[1] as Partial<RunningCommand> | null;
      return typeof value?.command === "string" && typeof value.startedAt === "number";
    }),
  );
}

export class WorkspaceController<P extends Pane> {
  private workspace = Workspace.empty();
  private readonly panes = new Map<PaneId, P>();
  private frozen = false;

  private constructor(private readonly deps: WorkspaceControllerDeps<P>) {}

  static create<P extends Pane>(deps: WorkspaceControllerDeps<P>): WorkspaceController<P> {
    return new WorkspaceController(deps);
  }

  get focused(): P | undefined {
    const id = this.workspace.focusedPane;
    return id === undefined ? undefined : this.panes.get(id);
  }

  get activeTabId(): TabId | undefined {
    return this.workspace.activeTabId;
  }

  get all(): readonly P[] {
    return [...this.panes.values()];
  }

  start(): readonly InterruptedCommand[] {
    const interrupted = this.restoreSession();
    if (interrupted === undefined) this.newTab();
    return interrupted ?? [];
  }

  freeze(): void {
    this.frozen = true;
  }

  pane(id: PaneId): P | undefined {
    return this.panes.get(id);
  }

  tabLabelOf(id: PaneId): string | undefined {
    return this.workspace.tabs.find((tab) => containsPane(tab.root, id))?.label;
  }

  newTab(): void {
    const pane = this.spawn(this.deps.newId(), this.focused?.cwd);
    this.commit(this.workspace.openTab(this.deps.newId(), pane.id));
  }

  split(orientation: Orientation): void {
    if (this.workspace.isEmpty) return this.newTab();
    const pane = this.spawn(this.deps.newId(), this.focused?.cwd);
    this.commit(this.workspace.split(pane.id, orientation));
  }

  closeFocusedPane(): void {
    const id = this.workspace.focusedPane;
    if (id !== undefined) this.closePane(id);
  }

  closePane(id: PaneId): void {
    const pane = this.panes.get(id);
    if (!pane) return;
    this.panes.delete(id);
    pane.dispose();
    this.commit(this.workspace.closePane(id));
  }

  closeTab(tabId: TabId): void {
    const tab = this.workspace.tabs.find((candidate) => candidate.id === tabId);
    if (!tab) return;
    let next = this.workspace;
    for (const id of paneIds(tab.root)) {
      this.panes.get(id)?.dispose();
      this.panes.delete(id);
      next = next.closePane(id);
    }
    this.commit(next);
  }

  renameTab(tabId: TabId, label: string): void {
    this.commit(this.workspace.renameTab(tabId, label));
  }

  colorTab(tabId: TabId, color: TabColor | undefined): void {
    this.commit(this.workspace.colorTab(tabId, color));
  }

  resizeSplit(path: SplitPath, ratio: number): void {
    const tabId = this.workspace.activeTabId;
    if (tabId !== undefined) this.commit(this.workspace.resizeSplit(tabId, path, ratio));
  }

  activateTab(tabId: TabId): void {
    this.commit(this.workspace.activateTab(tabId));
  }

  cycleTab(offset: number): void {
    this.commit(this.workspace.cycleTab(offset));
  }

  focusPane(id: PaneId): void {
    if (this.workspace.focusedPane !== id) this.commit(this.workspace.focusPane(id));
  }

  moveFocus(direction: Direction): void {
    this.commit(this.workspace.moveFocus(direction));
  }

  refresh(): void {
    if (this.workspace.isEmpty) return;
    this.deps.renderer.render(this.workspace, this.panes);
    this.saveSession();
  }

  private spawn(id: PaneId, cwd: string | undefined): P {
    const pane = this.deps.factory.create(
      { id, cwd },
      {
        onExit: () => this.closePane(id),
        onFocus: () => this.focusPane(id),
        onChange: () => this.refresh(),
      },
    );
    this.panes.set(id, pane);
    return pane;
  }

  private commit(next: Workspace): void {
    this.workspace = next;
    this.saveSession();
    if (next.isEmpty) return this.deps.window.close();
    this.deps.renderer.render(next, this.panes);
    this.focused?.focus();
  }

  private saveSession(): void {
    if (this.frozen) return;
    const cwds: Record<PaneId, string> = {};
    const running: Record<PaneId, RunningCommand> = {};
    for (const pane of this.panes.values()) {
      if (pane.cwd !== undefined) cwds[pane.id] = pane.cwd;
      if (pane.runningCommand !== undefined) running[pane.id] = pane.runningCommand;
    }
    const snapshot: SessionSnapshot = { workspace: this.workspace.snapshot(), cwds, running };
    this.deps.sessions.save(snapshot);
  }

  private restoreSession(): readonly InterruptedCommand[] | undefined {
    const raw = this.deps.sessions.load();
    if (typeof raw !== "object" || raw === null) return undefined;
    const { workspace: rawWorkspace, cwds: rawCwds, running: rawRunning } = raw as Record<string, unknown>;
    const workspace = Workspace.restore(rawWorkspace);
    if (!workspace) return undefined;
    const cwds = readCwds(rawCwds);
    const running = readRunning(rawRunning);
    for (const id of workspace.allPanes) this.spawn(id, cwds[id]);
    const interrupted = workspace.allPanes.flatMap((paneId): InterruptedCommand[] => {
      const command = running[paneId];
      return command ? [{ ...command, paneId, cwd: cwds[paneId] }] : [];
    });
    this.commit(workspace);
    return interrupted;
  }
}
