import { describe, expect, it } from "vitest";
import type { PaneId } from "../domain/pane-tree";
import type { Workspace } from "../domain/workspace";
import type { Pane, PaneEvents, PaneRequest, RunningCommand, SessionSnapshot } from "./ports";
import { WorkspaceController } from "./workspace-controller";

class FakePane implements Pane {
  disposed = false;
  focusCount = 0;
  title = "zsh";
  runningCommand: RunningCommand | undefined;

  constructor(
    readonly id: PaneId,
    public cwd: string | undefined,
    readonly events: PaneEvents,
  ) {}

  focus(): void {
    this.focusCount += 1;
  }

  dispose(): void {
    this.disposed = true;
  }
}

class InMemorySessionStore {
  saved: SessionSnapshot | undefined;

  constructor(private readonly initial: unknown = undefined) {}

  load(): unknown {
    return this.initial;
  }

  save(snapshot: SessionSnapshot): void {
    this.saved = JSON.parse(JSON.stringify(snapshot));
  }
}

function setup(initialSession: unknown = undefined) {
  let counter = 0;
  const created: FakePane[] = [];
  const renders: Workspace[] = [];
  const sessions = new InMemorySessionStore(initialSession);
  const window = { closed: false, close: () => void (window.closed = true) };
  const controller = WorkspaceController.create<FakePane>({
    factory: {
      create: (request: PaneRequest, events: PaneEvents) => {
        const pane = new FakePane(request.id, request.cwd, events);
        created.push(pane);
        return pane;
      },
    },
    renderer: { render: (workspace) => void renders.push(workspace) },
    sessions,
    window,
    newId: () => `id${++counter}`,
  });
  return { controller, created, renders, sessions, window };
}

describe("WorkspaceController", () => {
  it("ouvre un premier onglet au démarrage sans session", () => {
    const { controller, created, renders } = setup();
    controller.start();
    expect(created).toHaveLength(1);
    expect(controller.focused).toBe(created[0]);
    expect(renders.at(-1)?.tabs).toHaveLength(1);
  });

  it("ouvre les nouveaux onglets et splits dans le dossier du panneau actif", () => {
    const { controller, created } = setup();
    controller.start();
    created[0].cwd = "/home/jm/Labo";
    controller.newTab();
    controller.split("horizontal");
    expect(created.slice(1).map((pane) => pane.cwd)).toEqual(["/home/jm/Labo", "/home/jm/Labo"]);
  });

  it("ferme le panneau quand son shell se termine", () => {
    const { controller, created } = setup();
    controller.start();
    controller.split("vertical");
    created[1].events.onExit();
    expect(created[1].disposed).toBe(true);
    expect(controller.all).toEqual([created[0]]);
    expect(controller.focused).toBe(created[0]);
  });

  it("ferme la fenêtre quand le dernier panneau se ferme", () => {
    const { controller, window } = setup();
    controller.start();
    controller.closeFocusedPane();
    expect(window.closed).toBe(true);
  });

  it("fermer un onglet libère tous ses panneaux", () => {
    const { controller, created, renders } = setup();
    controller.start();
    controller.newTab();
    controller.split("horizontal");
    controller.closeTab(renders.at(-1)!.activeTabId!);
    expect(created.slice(1).every((pane) => pane.disposed)).toBe(true);
    expect(controller.all).toEqual([created[0]]);
  });

  it("le clic dans un panneau le focalise sans boucle de re-rendu", () => {
    const { controller, created, renders } = setup();
    controller.start();
    controller.split("horizontal");
    const rendersBefore = renders.length;
    created[0].events.onFocus();
    created[0].events.onFocus();
    expect(controller.focused).toBe(created[0]);
    expect(renders.length).toBe(rendersBefore + 1);
  });

  it("enregistre la disposition et les dossiers, puis les restaure", () => {
    const first = setup();
    first.controller.start();
    first.created[0].cwd = "/srv";
    first.controller.split("horizontal");
    first.created[1].events.onChange();

    const second = setup(first.sessions.saved);
    second.controller.start();
    expect(second.created.map((pane) => [pane.id, pane.cwd])).toEqual([
      ["id1", "/srv"],
      ["id3", "/srv"],
    ]);
    expect(second.controller.focused?.id).toBe("id3");
  });

  it("enregistre le nom et la couleur d'un onglet", () => {
    const { controller, sessions } = setup();
    controller.start();
    controller.renameTab(controller.activeTabId!, "serveur");
    controller.colorTab(controller.activeTabId!, "yellow");
    expect(sessions.saved?.workspace.tabs[0]).toMatchObject({ label: "serveur", color: "yellow" });
  });

  it("retrouve au redémarrage les commandes qui tournaient à la fermeture", () => {
    const first = setup();
    first.controller.start();
    first.created[0].cwd = "/home/jm/api";
    first.created[0].runningCommand = { command: "claude", startedAt: 1_000 };
    first.created[0].events.onChange();

    const second = setup(first.sessions.saved);
    expect(second.controller.start()).toEqual([
      { paneId: "id1", cwd: "/home/jm/api", command: "claude", startedAt: 1_000 },
    ]);
  });

  it("n'écrase plus la session une fois la fenêtre en cours de fermeture", () => {
    const { controller, created, sessions } = setup();
    controller.start();
    controller.split("horizontal");
    const before = sessions.saved;
    controller.freeze();
    created[1].events.onExit();
    expect(sessions.saved).toEqual(before);
  });

  it("ne signale rien d'interrompu sans session précédente", () => {
    expect(setup().controller.start()).toEqual([]);
  });

  it("enregistre le ratio d'un split redimensionné", () => {
    const { controller, sessions } = setup();
    controller.start();
    controller.split("horizontal");
    controller.resizeSplit([], 0.65);
    expect(sessions.saved?.workspace.tabs[0].root).toMatchObject({ kind: "split", ratio: 0.65 });
  });

  it("ignore une session corrompue", () => {
    const { controller, created } = setup({ workspace: { tabs: "nope" } });
    controller.start();
    expect(created).toHaveLength(1);
  });
});
