export type ClaudePaneSnapshot = {
  readonly paneId: string;
  readonly tabLabel: string;
  readonly title: string;
  readonly command: string | undefined;
  readonly startedAt: number | undefined;
  readonly waitingFor: string | undefined;
};

export type ClaudeSessionState = "waiting" | "working";

export type ClaudeSessionView = {
  readonly paneId: string;
  readonly tabLabel: string;
  readonly topic: string;
  readonly state: ClaudeSessionState;
  readonly detail: string | undefined;
  readonly startedAt: number | undefined;
};

const CLAUDE_TITLE_DECORATION = /^[\s✳✻✶✢·*⠀-⣿]+/u;

export function isClaudeCommand(command: string | undefined): boolean {
  const program = command?.trim().split(/\s+/)[0] ?? "";
  return program.split("/").pop() === "claude";
}

function topicOf(snapshot: ClaudePaneSnapshot): string {
  const topic = snapshot.title.replace(CLAUDE_TITLE_DECORATION, "").trim();
  return topic && topic !== snapshot.command ? topic : "Claude Code";
}

export function claudeDashboard(snapshots: readonly ClaudePaneSnapshot[]): readonly ClaudeSessionView[] {
  return snapshots
    .filter((snapshot) => isClaudeCommand(snapshot.command))
    .map((snapshot) => ({
      paneId: snapshot.paneId,
      tabLabel: snapshot.tabLabel,
      topic: topicOf(snapshot),
      state: snapshot.waitingFor === undefined ? ("working" as const) : ("waiting" as const),
      detail: snapshot.waitingFor,
      startedAt: snapshot.startedAt,
    }))
    .sort((a, b) => Number(b.state === "waiting") - Number(a.state === "waiting"));
}
