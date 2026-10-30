import { describe, expect, it } from "vitest";
import {
  type ClaudeSession,
  explicitSessionId,
  formatAgo,
  isClaudeCommand,
  matchSession,
  resumeCommand,
} from "./claude-sessions";

const ID = "e5e6d6bd-eb93-4263-a002-e648c587d9b7";

const session = (id: string, createdMs: number, modifiedMs = createdMs): ClaudeSession => ({
  id,
  createdMs,
  modifiedMs,
  preview: null,
});

describe("isClaudeCommand", () => {
  it.each(["claude", "claude --resume x", "CLAUDE_CONFIG_DIR=/tmp claude", "~/.local/bin/claude -c"])(
    "reconnaît %j",
    (command) => expect(isClaudeCommand(command)).toBe(true),
  );

  it.each(["claude-code-router", "git log --grep claude", "vim claude.md", ""])("ignore %j", (command) => {
    expect(isClaudeCommand(command)).toBe(false);
  });
});

describe("explicitSessionId", () => {
  it("lit l'identifiant passé à --resume ou -r", () => {
    expect(explicitSessionId(`claude --resume ${ID}`)).toBe(ID);
    expect(explicitSessionId(`claude -r ${ID} --verbose`)).toBe(ID);
  });

  it("ignore un --resume sans identifiant valide", () => {
    expect(explicitSessionId("claude --resume")).toBeUndefined();
    expect(explicitSessionId("claude -r mon-titre")).toBeUndefined();
  });
});

describe("matchSession", () => {
  const sessions = [session("avant", 1_000, 9_000), session("pendant", 10_500), session("après", 30_000)];

  it("prend la session créée juste après le lancement de claude", () => {
    expect(matchSession("claude", 10_000, sessions)?.id).toBe("pendant");
  });

  it("préfère l'identifiant explicite de la commande", () => {
    expect(matchSession(`claude --resume ${ID}`, 10_000, [...sessions, session(ID, 0)])?.id).toBe(ID);
  });

  it("se rabat sur la session modifiée le plus récemment après le lancement", () => {
    const resumed = [session("ancienne", 0, 50_000), session("autre", 0, 40_000)];
    expect(matchSession("claude --continue", 35_000, resumed)?.id).toBe("ancienne");
  });

  it("ne trouve rien si aucune session n'a bougé depuis le lancement", () => {
    expect(matchSession("claude", 100_000, sessions)).toBeUndefined();
  });
});

describe("reprise", () => {
  it("reprend une session précise ou la plus récente du dossier", () => {
    expect(resumeCommand(ID)).toBe(`claude --resume ${ID}`);
    expect(resumeCommand(undefined)).toBe("claude --continue");
  });

  it.each([
    [20_000, "à l'instant"],
    [5 * 60_000, "il y a 5 min"],
    [3 * 3_600_000, "il y a 3 h"],
    [26 * 3_600_000, "hier"],
    [5 * 86_400_000, "il y a 5 jours"],
  ])("formate un écart de %d ms en %s", (elapsed, text) => {
    expect(formatAgo(0, elapsed)).toBe(text);
  });
});
