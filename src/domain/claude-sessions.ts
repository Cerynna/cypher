export type ClaudeSession = {
  readonly id: string;
  readonly createdMs: number;
  readonly modifiedMs: number;
  readonly preview: string | null;
};

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const START_TOLERANCE_MS = 5_000;

function words(command: string): readonly string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

export function isClaudeCommand(command: string): boolean {
  const program = words(command).find((word) => !ENV_ASSIGNMENT.test(word));
  return program !== undefined && program.split("/").at(-1) === "claude";
}

export function explicitSessionId(command: string): string | undefined {
  const tokens = words(command);
  const flag = tokens.findIndex((token) => token === "--resume" || token === "-r" || token === "--session-id");
  const candidate = flag === -1 ? undefined : tokens[flag + 1];
  return candidate !== undefined && SESSION_ID.test(candidate) ? candidate : undefined;
}

export function matchSession(
  command: string,
  startedAt: number,
  sessions: readonly ClaudeSession[],
): ClaudeSession | undefined {
  const explicit = explicitSessionId(command);
  if (explicit) return sessions.find((session) => session.id === explicit);
  const createdAfterStart = sessions
    .filter((session) => session.createdMs >= startedAt - START_TOLERANCE_MS)
    .sort((a, b) => a.createdMs - b.createdMs);
  if (createdAfterStart.length > 0) return createdAfterStart[0];
  return sessions
    .filter((session) => session.modifiedMs >= startedAt)
    .sort((a, b) => b.modifiedMs - a.modifiedMs)[0];
}

export function resumeCommand(sessionId: string | undefined): string {
  return sessionId ? `claude --resume ${sessionId}` : "claude --continue";
}

export function formatAgo(timestamp: number, now: number): string {
  const minutes = Math.round((now - timestamp) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} jours`;
}
