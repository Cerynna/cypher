import type { PaneId } from "../domain/pane-tree";
import type { ClaudeSession } from "../domain/claude-sessions";
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

export type FinishedCommand = {
  readonly command: string | undefined;
  readonly exitCode: number | undefined;
  readonly durationMs: number | undefined;
  readonly output: string;
};

export interface CommandPane {
  readonly cwd: string | undefined;
  readonly title: string;
  write(data: string): void;
  focus(): void;
  nextCommandFinished(): Promise<FinishedCommand>;
}

export interface CommandWorkspace<P extends CommandPane> {
  readonly focused: P | undefined;
  newTab(): void;
  pane(id: PaneId): P | undefined;
  focusPane(id: PaneId): void;
  tabLabelOf(id: PaneId): string | undefined;
}

export type BackgroundOutcome = {
  readonly exitCode: number | undefined;
  readonly durationMs: number;
  readonly output: string;
  readonly cancelled: boolean;
};

export interface BackgroundRunner {
  run(id: string, command: string, cwd: string | undefined): Promise<BackgroundOutcome>;
  cancel(id: string): Promise<void>;
}

export type Completion = {
  readonly title: string;
  readonly body: string;
  readonly failed: boolean;
  readonly output: string;
};

export interface CompletionNotifier {
  notify(completion: Completion): void;
}

export interface ClaudeSessionStore {
  list(cwd: string, limit: number): Promise<readonly ClaudeSession[]>;
}
