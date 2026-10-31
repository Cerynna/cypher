import { describe, expect, it } from "vitest";
import { type ClaudePaneSnapshot, claudeDashboard, isClaudeCommand } from "./claude-dashboard";

const pane = (overrides: Partial<ClaudePaneSnapshot>): ClaudePaneSnapshot => ({
  paneId: "p",
  tabLabel: "cypher",
  title: "claude",
  command: "claude",
  startedAt: 1,
  waitingFor: undefined,
  ...overrides,
});

describe("isClaudeCommand", () => {
  it("reconnaît claude avec ses options ou par son chemin", () => {
    expect(isClaudeCommand("claude")).toBe(true);
    expect(isClaudeCommand("claude --resume abc")).toBe(true);
    expect(isClaudeCommand("~/.local/bin/claude -c")).toBe(true);
    expect(isClaudeCommand("claudette")).toBe(false);
    expect(isClaudeCommand("echo claude")).toBe(false);
    expect(isClaudeCommand(undefined)).toBe(false);
  });
});

describe("claudeDashboard", () => {
  it("ne garde que les panneaux où tourne Claude, ceux qui attendent en premier", () => {
    const sessions = claudeDashboard([
      pane({ paneId: "a", title: "✳ Refacto du parser" }),
      pane({ paneId: "b", command: "yarn test" }),
      pane({ paneId: "c", tabLabel: "api", waitingFor: "Claude needs your permission to use Bash" }),
    ]);
    expect(sessions).toEqual([
      {
        paneId: "c",
        tabLabel: "api",
        topic: "Claude Code",
        state: "waiting",
        detail: "Claude needs your permission to use Bash",
        startedAt: 1,
      },
      { paneId: "a", tabLabel: "cypher", topic: "Refacto du parser", state: "working", detail: undefined, startedAt: 1 },
    ]);
  });
});
