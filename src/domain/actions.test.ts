import { describe, expect, it } from "vitest";
import { HIDDEN_FROM_PALETTE, passesThroughToShell } from "./actions";

describe("Ctrl+C façon Windows Terminal", () => {
  it("copie quand du texte est sélectionné", () => {
    expect(passesThroughToShell("copyOrInterrupt", true)).toBe(false);
  });

  it("laisse passer Ctrl+C au shell sans sélection, pour interrompre la commande", () => {
    expect(passesThroughToShell("copyOrInterrupt", false)).toBe(true);
  });

  it("ne laisse jamais passer les autres actions", () => {
    expect(passesThroughToShell("copy", false)).toBe(false);
    expect(passesThroughToShell("paste", false)).toBe(false);
  });

  it("n'affiche pas l'action conditionnelle dans la palette", () => {
    expect(HIDDEN_FROM_PALETTE.has("copyOrInterrupt")).toBe(true);
  });
});
