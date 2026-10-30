import type { PaneId } from "../domain/pane-tree";
import type { Workspace, WorkspaceSnapshot } from "../domain/workspace";

export type PaneRequest = { readonly id: PaneId; readonly cwd: string | undefined };

export type PaneEvents = {
  readonly onExit: () => void;
  readonly onFocus: () => void;
  readonly onChange: () => void;
};

export type RunningCommand = { readonly command: string; readonly startedAt: number };

export interface Pane {
  readonly id: PaneId;
  readonly cwd: string | undefined;
  readonly title: string;
  readonly runningCommand: RunningCommand | undefined;
  focus(): void;
  dispose(): void;
}

export interface PaneFactory<P extends Pane> {
  create(request: PaneRequest, events: PaneEvents): P;
}

export interface WorkspaceRenderer<P extends Pane> {
  render(workspace: Workspace, panes: ReadonlyMap<PaneId, P>): void;
}

export type SessionSnapshot = {
  readonly workspace: WorkspaceSnapshot;
  readonly cwds: Readonly<Record<PaneId, string>>;
  readonly running: Readonly<Record<PaneId, RunningCommand>>;
};

export type InterruptedCommand = RunningCommand & {
  readonly paneId: PaneId;
  readonly cwd: string | undefined;
};

export interface SessionStore {
  load(): unknown;
  save(snapshot: SessionSnapshot): void;
}

export interface AppWindow {
  close(): void;
}
