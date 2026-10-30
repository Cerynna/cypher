import { describe, expect, it } from "vitest";
import { windowTitle } from "./window-title";

describe("windowTitle", () => {
  it("suffixe le titre du shell par le nom de l'app", () => {
    expect(windowTitle("vim PLAN.md")).toBe("vim PLAN.md — CYPHER");
  });

  it("revient au nom de l'app quand le titre est vide", () => {
    expect(windowTitle("  \x07 ")).toBe("CYPHER");
  });

  it("retire les caractères de contrôle et d'inversion bidirectionnelle", () => {
    expect(windowTitle("a\x1bb‮c​d")).toBe("abcd — CYPHER");
  });

  it("tronque les titres trop longs", () => {
    expect(windowTitle("x".repeat(200))).toBe(`${"x".repeat(79)}… — CYPHER`);
  });
});
