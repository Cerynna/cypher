import { describe, expect, it } from "vitest";
import type { ClaudeSession } from "../domain/claude-sessions";
import { ClaudeResume } from "./claude-resume";
import type { CommandPane, CommandWorkspace, FinishedCommand } from "./ports";

const SESSION_ID = "e5e6d6bd-eb93-4263-a002-e648c587d9b7";

class FakePane implements CommandPane {
  readonly written: string[] = [];

  constructor(
    readonly cwd: string | undefined,
    readonly title: string,
  ) {}

  write(data: string): void {
    this.written.push(data);
  }

  focus(): void {}

  nextCommandFinished(): Promise<FinishedCommand> {
    return new Promise(() => undefined);
  }
}

class FakeWorkspace implements CommandWorkspace<FakePane> {
  readonly opened: FakePane[] = [];
  readonly focusedIds: string[] = [];

  constructor(
    private readonly panes: Map<string, FakePane>,
    public focused: FakePane | undefined,
    private readonly labels: Record<string, string> = {},
  ) {}

  newTab(): void {
    const pane = new FakePane(this.focused?.cwd, "nouveau");
    this.opened.push(pane);
    this.focused = pane;
  }

  pane(id: string): FakePane | undefined {
    return this.panes.get(id);
  }

  focusPane(id: string): void {
    this.focusedIds.push(id);
  }

  tabLabelOf(id: string): string | undefined {
    return this.labels[id];
  }
}

const session = (id: string, createdMs: number, preview: string | null = "Ajoute la reprise"): ClaudeSession => ({
  id,
  createdMs,
  modifiedMs: createdMs + 1_000,
  preview,
});

describe("ClaudeResume", () => {
  const api = new FakePane("/srv/api", "api");
  const workspace = () => new FakeWorkspace(new Map([["p1", api]]), api, { p1: "API prod" });

  it("propose les sessions claude interrompues avec leur session retrouvée", async () => {
    const resume = ClaudeResume.create({
      workspace: workspace(),
      sessions: { list: async () => [session(SESSION_ID, 10_500)] },
    });
    const candidates = await resume.interrupted([
      { paneId: "p1", cwd: "/srv/api", command: "claude", startedAt: 10_000 },
      { paneId: "p2", cwd: "/srv/api", command: "yarn dev", startedAt: 10_000 },
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ title: "API prod", preview: "Ajoute la reprise", sessionFound: true });
  });

  it("reprend la session dans son panneau d'origine", async () => {
    const pane = new FakePane("/srv/api", "api");
    const fake = new FakeWorkspace(new Map([["p1", pane]]), pane);
    const resume = ClaudeResume.create({ workspace: fake, sessions: { list: async () => [session(SESSION_ID, 10_500)] } });
    const [candidate] = await resume.interrupted([{ paneId: "p1", cwd: "/srv/api", command: "claude", startedAt: 10_000 }]);
    candidate.resume();
    expect(fake.focusedIds).toEqual(["p1"]);
    expect(pane.written).toEqual([`claude --resume ${SESSION_ID}\r`]);
  });

  it("se rabat sur claude --continue sans session retrouvée", async () => {
    const pane = new FakePane("/srv/api", "api");
    const fake = new FakeWorkspace(new Map([["p1", pane]]), pane);
    const resume = ClaudeResume.create({ workspace: fake, sessions: { list: async () => Promise.reject(new Error("illisible")) } });
    const [candidate] = await resume.interrupted([{ paneId: "p1", cwd: "/srv/api", command: "claude", startedAt: 10_000 }]);
    expect(candidate.sessionFound).toBe(false);
    candidate.resume();
    expect(pane.written).toEqual(["claude --continue\r"]);
  });

  it("liste les sessions récentes du dossier courant et les rouvre dans un nouvel onglet", async () => {
    const fake = workspace();
    const resume = ClaudeResume.create({ workspace: fake, sessions: { list: async () => [session(SESSION_ID, 0, null)] } });
    const recent = await resume.recent();
    expect(recent?.cwd).toBe("/srv/api");
    expect(recent?.candidates[0].title).toBe("e5e6d6bd");
    recent?.candidates[0].resume();
    expect(fake.opened[0].written).toEqual([`claude --resume ${SESSION_ID}\r`]);
  });

  it("ne liste rien sans dossier courant", async () => {
    const resume = ClaudeResume.create({
      workspace: new FakeWorkspace(new Map(), undefined),
      sessions: { list: async () => [] },
    });
    expect(await resume.recent()).toBeUndefined();
  });
});
