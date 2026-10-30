import { describe, expect, it } from "vitest";
import { paneTitle } from "./pane-title";

const base = { runningCommand: undefined, repoRoot: undefined, cwd: undefined, shellTitle: "" };

describe("paneTitle", () => {
  it("affiche le nom du dépôt, même depuis un sous-dossier", () => {
    expect(paneTitle({ ...base, cwd: "/home/jm/Labo/cypher/src/domain", repoRoot: "/home/jm/Labo/cypher" })).toBe("cypher");
  });

  it("affiche le dossier courant hors d'un dépôt", () => {
    expect(paneTitle({ ...base, cwd: "/home/jm/Téléchargements" })).toBe("Téléchargements");
  });

  it("donne la priorité à la commande en cours", () => {
    expect(paneTitle({ ...base, runningCommand: "yarn dev", repoRoot: "/srv/api", cwd: "/srv/api" })).toBe("yarn dev");
  });

  it("se rabat sur le titre du shell, puis sur « shell »", () => {
    expect(paneTitle({ ...base, shellTitle: "vim" })).toBe("vim");
    expect(paneTitle(base)).toBe("shell");
  });
});
