import { isClaudeCommand, matchSession, resumeCommand, type ClaudeSession } from "../domain/claude-sessions";
import type { PaneId } from "../domain/pane-tree";
import type { ClaudeSessionStore, CommandPane, CommandWorkspace, InterruptedCommand } from "./ports";

export type ResumeCandidate = {
  readonly title: string;
  readonly cwd: string | undefined;
  readonly preview: string | null;
  readonly lastActivity: number | undefined;
  readonly sessionFound: boolean;
  readonly resume: () => void;
};

export type RecentSessions = { readonly cwd: string; readonly candidates: readonly ResumeCandidate[] };

export type ClaudeResumeDeps<P extends CommandPane> = {
  readonly workspace: CommandWorkspace<P>;
  readonly sessions: ClaudeSessionStore;
};

const MATCHING_WINDOW = 50;
const RECENT_LIMIT = 12;

export class ClaudeResume<P extends CommandPane> {
  private constructor(private readonly deps: ClaudeResumeDeps<P>) {}

  static create<P extends CommandPane>(deps: ClaudeResumeDeps<P>): ClaudeResume<P> {
    return new ClaudeResume(deps);
  }

  async interrupted(runs: readonly InterruptedCommand[]): Promise<readonly ResumeCandidate[]> {
    const claudeRuns = runs.filter((run) => isClaudeCommand(run.command));
    return Promise.all(
      claudeRuns.map(async (run): Promise<ResumeCandidate> => {
        const sessions = run.cwd ? await this.deps.sessions.list(run.cwd, MATCHING_WINDOW).catch(() => []) : [];
        const session = matchSession(run.command, run.startedAt, sessions);
        const { workspace } = this.deps;
        return {
          title: workspace.tabLabelOf(run.paneId) ?? workspace.pane(run.paneId)?.title ?? "claude",
          cwd: run.cwd,
          preview: session?.preview ?? null,
          lastActivity: session?.modifiedMs ?? run.startedAt,
          sessionFound: session !== undefined,
          resume: () => this.resumeInPane(run.paneId, resumeCommand(session?.id)),
        };
      }),
    );
  }

  async recent(): Promise<RecentSessions | undefined> {
    const cwd = this.deps.workspace.focused?.cwd;
    if (!cwd) return undefined;
    const sessions = await this.deps.sessions.list(cwd, RECENT_LIMIT);
    return { cwd, candidates: sessions.map((session) => this.recentCandidate(session, cwd)) };
  }

  private recentCandidate(session: ClaudeSession, cwd: string): ResumeCandidate {
    return {
      title: session.preview ? "Session Claude" : session.id.slice(0, 8),
      cwd,
      preview: session.preview,
      lastActivity: session.modifiedMs,
      sessionFound: true,
      resume: () => this.resumeInNewTab(resumeCommand(session.id)),
    };
  }

  private resumeInPane(paneId: PaneId, command: string): void {
    const pane = this.deps.workspace.pane(paneId);
    if (!pane) return this.resumeInNewTab(command);
    this.deps.workspace.focusPane(paneId);
    pane.write(`${command}\r`);
  }

  private resumeInNewTab(command: string): void {
    this.deps.workspace.newTab();
    this.deps.workspace.focused?.write(`${command}\r`);
  }
}
