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
  ])("refuse un instantané invalide : %j", (snapshot) => {
    expect(Workspace.restore(snapshot)).toBeUndefined();
  });
});
