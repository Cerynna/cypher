import { describe, expect, it } from "vitest";
import { layoutRects, paneIds } from "./pane-tree";
import { Workspace } from "./workspace";

const twoByTwo = () =>
  Workspace.empty()
    .openTab("t1", "a")
    .split("b", "horizontal")
    .focusPane("a")
    .split("c", "vertical")
    .focusPane("b")
    .split("d", "vertical");

describe("Workspace", () => {
  it("ouvre un onglet actif avec un panneau focalisé", () => {
    const workspace = Workspace.empty().openTab("t1", "a");
    expect(workspace.activeTabId).toBe("t1");
    expect(workspace.focusedPane).toBe("a");
  });

  it("insère un nouvel onglet juste après l'onglet actif", () => {
    const workspace = Workspace.empty().openTab("t1", "a").openTab("t2", "b").activateTab("t1").openTab("t3", "c");
    expect(workspace.tabs.map((tab) => tab.id)).toEqual(["t1", "t3", "t2"]);
  });

  it("passe d'un onglet à l'autre en boucle", () => {
    const workspace = Workspace.empty().openTab("t1", "a").openTab("t2", "b");
    expect(workspace.cycleTab(1).activeTabId).toBe("t1");
    expect(workspace.cycleTab(-1).activeTabId).toBe("t1");
  });

  it("divise le panneau focalisé et focalise le nouveau", () => {
    const workspace = Workspace.empty().openTab("t1", "a").split("b", "horizontal");
    expect(paneIds(workspace.activeTab!.root)).toEqual(["a", "b"]);
    expect(workspace.focusedPane).toBe("b");
    expect(layoutRects(workspace.activeTab!.root).get("b")).toEqual({ x: 0.5, y: 0, width: 0.5, height: 1 });
  });

  it("redimensionne un split et borne le ratio", () => {
    const workspace = Workspace.empty().openTab("t1", "a").split("b", "horizontal");
    const resized = workspace.resizeSplit("t1", [], 0.7);
    expect(layoutRects(resized.activeTab!.root).get("a")?.width).toBeCloseTo(0.7);
    expect(layoutRects(resized.activeTab!.root).get("b")).toMatchObject({ x: 0.7 });
    expect(workspace.resizeSplit("t1", [], 0.99).activeTab!.root).toMatchObject({ ratio: 0.9 });
    expect(workspace.resizeSplit("t1", [], 0).activeTab!.root).toMatchObject({ ratio: 0.1 });
  });

  it("redimensionne un split imbriqué via son chemin", () => {
    const resized = twoByTwo().resizeSplit("t1", ["second"], 0.25);
    const rects = layoutRects(resized.activeTab!.root);
    expect(rects.get("b")?.height).toBeCloseTo(0.25);
    expect(rects.get("d")).toMatchObject({ y: 0.25 });
    expect(rects.get("c")?.height).toBeCloseTo(0.5);
  });

  it("garde les ratios voisins quand on ferme un panneau", () => {
    const workspace = twoByTwo().resizeSplit("t1", [], 0.3).closePane("d");
    expect(workspace.activeTab!.root).toMatchObject({ ratio: 0.3 });
  });

  it("navigue selon les tailles réelles après redimensionnement", () => {
    const workspace = twoByTwo().resizeSplit("t1", ["first"], 0.2).resizeSplit("t1", ["second"], 0.8).focusPane("c");
    expect(workspace.moveFocus("right").focusedPane).toBe("b");
  });

  it("navigue entre panneaux selon leur position", () => {
    const workspace = twoByTwo().focusPane("a");
    expect(workspace.moveFocus("right").focusedPane).toBe("b");
    expect(workspace.moveFocus("down").focusedPane).toBe("c");
    expect(workspace.moveFocus("left").focusedPane).toBe("a");
    expect(workspace.focusPane("d").moveFocus("up").focusedPane).toBe("b");
    expect(workspace.focusPane("d").moveFocus("left").focusedPane).toBe("c");
  });

  it("fermer un panneau rend sa place et déplace le focus", () => {
    const workspace = twoByTwo().focusPane("b").closePane("b");
    expect(workspace.allPanes).toEqual(["a", "c", "d"]);
    expect(workspace.focusedPane).toBe("a");
  });

  it("fermer le dernier panneau d'un onglet ferme l'onglet et active le voisin", () => {
    const workspace = Workspace.empty().openTab("t1", "a").openTab("t2", "b").closePane("b");
    expect(workspace.tabs.map((tab) => tab.id)).toEqual(["t1"]);
    expect(workspace.activeTabId).toBe("t1");
  });

  it("devient vide quand tout est fermé", () => {
    expect(Workspace.empty().openTab("t1", "a").closePane("a").isEmpty).toBe(true);
  });

  it("renomme un onglet et revient au nom automatique avec un nom vide", () => {
    const renamed = Workspace.empty().openTab("t1", "a").renameTab("t1", "  API   prod ");
    expect(renamed.activeTab?.label).toBe("API prod");
    expect(renamed.renameTab("t1", "   ").activeTab).not.toHaveProperty("label");
  });

  it("colore un onglet et retire la couleur", () => {
    const colored = Workspace.empty().openTab("t1", "a").colorTab("t1", "magenta");
    expect(colored.activeTab?.color).toBe("magenta");
    expect(colored.colorTab("t1", undefined).activeTab).not.toHaveProperty("color");
  });

  it("garde le nom et la couleur quand on divise ou ferme un panneau", () => {
    const tab = Workspace.empty()
      .openTab("t1", "a")
      .renameTab("t1", "logs")
      .colorTab("t1", "green")
      .split("b", "horizontal")
      .closePane("b").activeTab;
    expect(tab).toMatchObject({ label: "logs", color: "green" });
  });

  it("restaure une ancienne session sans ratio en 50/50", () => {
    const restored = Workspace.restore({
      tabs: [
        {
          id: "t",
          focusedPane: "a",
          root: { kind: "split", orientation: "vertical", first: { kind: "pane", id: "a" }, second: { kind: "pane", id: "b" } },
        },
      ],
    });
    expect(layoutRects(restored!.activeTab!.root).get("b")).toMatchObject({ y: 0.5, height: 0.5 });
  });

  it("se restaure depuis un instantané valide", () => {
    const original = twoByTwo().renameTab("t1", "dev").colorTab("t1", "cyan").openTab("t2", "e");
    const restored = Workspace.restore(JSON.parse(JSON.stringify(original.snapshot())));
    expect(restored?.snapshot()).toEqual(original.snapshot());
  });

  it.each([
    null,
    { tabs: [] },
    { tabs: [{ id: "t", root: { kind: "pane", id: "a" }, focusedPane: "z" }] },
    {
      tabs: [
        { id: "t1", root: { kind: "pane", id: "a" }, focusedPane: "a" },
        { id: "t2", root: { kind: "pane", id: "a" }, focusedPane: "a" },
      ],
    },
    { tabs: [{ id: "t", root: { kind: "pane", id: "a" }, focusedPane: "a", color: "chartreuse" }] },
    {
      tabs: [
        {
          id: "t",
          focusedPane: "a",
          root: { kind: "split", orientation: "horizontal", ratio: 2, first: { kind: "pane", id: "a" }, second: { kind: "pane", id: "b" } },
        },
      ],
    },
  ])("refuse un instantané invalide : %j", (snapshot) => {
    expect(Workspace.restore(snapshot)).toBeUndefined();
  });
});
