import { describe, expect, it } from "vitest";
import type { QuickCommand } from "../domain/quick-commands";
import type {
  BackgroundOutcome,
  CommandPane,
  CommandWorkspace,
  Completion,
  FinishedCommand,
} from "./ports";
import { QuickCommandRunner } from "./quick-command-runner";

class FakePane implements CommandPane {
  readonly written: string[] = [];
  readonly title = "zsh";
  private waiters: ((done: FinishedCommand) => void)[] = [];

  constructor(readonly cwd: string | undefined) {}

  write(data: string): void {
    this.written.push(data);
  }

  focus(): void {}

  nextCommandFinished(): Promise<FinishedCommand> {
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  finish(done: FinishedCommand): void {
    const waiters = this.waiters;
    this.waiters = [];
    for (const resolve of waiters) resolve(done);
  }
}

class FakeWorkspace implements CommandWorkspace<FakePane> {
  readonly panes: FakePane[] = [];
  focused: FakePane | undefined;

  constructor(cwd: string | undefined) {
    this.focused = cwd === undefined ? undefined : this.add(cwd);
  }

  private add(cwd: string | undefined): FakePane {
    const pane = new FakePane(cwd);
    this.panes.push(pane);
    return pane;
  }

  newTab(): void {
    this.focused = this.add(this.focused?.cwd);
  }

  pane(): FakePane | undefined {
    return undefined;
  }

  focusPane(): void {}

  tabLabelOf(): string | undefined {
    return undefined;
  }
}

class FakeBackground {
  readonly runs: { id: string; command: string; cwd: string | undefined }[] = [];
  readonly cancelled: string[] = [];
  private resolvers = new Map<string, (outcome: BackgroundOutcome) => void>();

  run(id: string, command: string, cwd: string | undefined): Promise<BackgroundOutcome> {
    this.runs.push({ id, command, cwd });
    return new Promise((resolve) => this.resolvers.set(id, resolve));
  }

  async cancel(id: string): Promise<void> {
    this.cancelled.push(id);
    this.resolvers.get(id)?.({ exitCode: undefined, durationMs: 10, output: "", cancelled: true });
  }

  complete(id: string, outcome: BackgroundOutcome): void {
    this.resolvers.get(id)?.(outcome);
  }
}

const command = (overrides: Partial<QuickCommand>): QuickCommand => ({
  emoji: "🔨",
  name: "Build",
  command: "yarn build",
  mode: "run",
  notify: false,
  ...overrides,
});

function setup(cwd: string | undefined = "/srv/app") {
  const workspace = new FakeWorkspace(cwd);
  const background = new FakeBackground();
  const notified: Completion[] = [];
  let counter = 0;
  const runner = QuickCommandRunner.create({
    workspace,
    background,
    notifier: { notify: (completion) => void notified.push(completion) },
    newId: () => `job${++counter}`,
  });
  return { runner, workspace, background, notified };
}

describe("QuickCommandRunner", () => {
  it("tape et exécute la commande dans le panneau actif", async () => {
    const { runner, workspace, notified } = setup();
    await runner.run(command({})).finished;
    expect(workspace.panes[0].written).toEqual(["yarn build\r"]);
    expect(notified).toEqual([]);
  });

  it("ouvre un nouvel onglet dans le même dossier en mode tab", () => {
    const { runner, workspace } = setup();
    runner.run(command({ mode: "tab" }));
    expect(workspace.panes).toHaveLength(2);
    expect(workspace.panes[1]).toMatchObject({ cwd: "/srv/app", written: ["yarn build\r"] });
  });

  it("notifie seulement la fin de sa propre commande", async () => {
    const { runner, workspace, notified } = setup();
    const execution = runner.run(command({ notify: true }));
    const pane = workspace.panes[0];
    pane.finish({ command: "npm run dev", exitCode: 130, durationMs: 1, output: "" });
    await Promise.resolve();
    expect(notified).toEqual([]);
    pane.finish({ command: "yarn build", exitCode: 0, durationMs: 1_500, output: "done\n" });
    await execution.finished;
    expect(notified).toEqual([{ title: "🔨 Build : terminé en 1,5 s", body: "done", failed: false, output: "done\n" }]);
  });

  it("lance une commande en arrière-plan dans le dossier actif et notifie le résultat", async () => {
    const { runner, workspace, background, notified } = setup();
    const execution = runner.run(command({ mode: "background", notify: true }));
    expect(background.runs).toEqual([{ id: "job1", command: "yarn build", cwd: "/srv/app" }]);
    expect(workspace.panes[0].written).toEqual([]);
    background.complete("job1", { exitCode: 2, durationMs: 300, output: "erreur TS\n", cancelled: false });
    await execution.finished;
    expect(notified[0]).toMatchObject({ title: "🔨 Build : échec (code 2) en 300 ms", failed: true });
  });

  it("arrête une commande en arrière-plan", async () => {
    const { runner, background, notified } = setup();
    const execution = runner.run(command({ mode: "background" }));
    execution.cancel?.();
    await execution.finished;
    expect(background.cancelled).toEqual(["job1"]);
    expect(notified[0]).toMatchObject({ title: "🔨 Build : arrêté en 10 ms", failed: false });
  });

  it("ne propose pas d'arrêt pour une commande lancée dans un terminal", () => {
    expect(setup().runner.run(command({})).cancel).toBeUndefined();
  });

  it("ouvre un onglet s'il n'y a aucun panneau", () => {
    const { runner, workspace } = setup(undefined);
    runner.run(command({}));
    expect(workspace.panes).toHaveLength(1);
  });
});
