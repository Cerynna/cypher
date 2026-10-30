import { describe, expect, it } from "vitest";
import { type KeyStroke, Keymap, formatChord, parseChord } from "./keymap";

const stroke = (overrides: Partial<KeyStroke>): KeyStroke => ({
  key: "",
  code: "",
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...overrides,
});

describe("parseChord", () => {
  it("lit les modificateurs et les alias de touches", () => {
    expect(parseChord("Ctrl+Shift+Plus")).toEqual({ key: "+", ctrl: true, shift: true, alt: false, meta: false });
    expect(parseChord("cmd+up")?.key).toBe("arrowup");
  });

  it("refuse un raccourci sans touche ou avec deux touches", () => {
    expect(parseChord("ctrl+shift")).toBeUndefined();
    expect(parseChord("a+b")).toBeUndefined();
  });

  it("s'affiche de façon lisible", () => {
    expect(formatChord(parseChord("ctrl+shift+t")!)).toBe("Ctrl+Maj+T");
    expect(formatChord(parseChord("ctrl+shift+down")!)).toBe("Ctrl+Maj+↓");
  });
});

describe("Keymap", () => {
  const keymap = Keymap.create();

  it.each([
    [{ key: "C", ctrlKey: true, shiftKey: true }, "copy"],
    [{ key: "c", metaKey: true }, "copy"],
    [{ key: "T", ctrlKey: true, shiftKey: true }, "newTab"],
    [{ key: "D", ctrlKey: true, shiftKey: true }, "splitRight"],
    [{ key: "ArrowLeft", ctrlKey: true, altKey: true }, "focusLeft"],
    [{ key: "Tab", ctrlKey: true, shiftKey: true }, "previousTab"],
    [{ key: "P", ctrlKey: true, shiftKey: true }, "commandPalette"],
    [{ key: ",", ctrlKey: true }, "settings"],
  ] as const)("%o → %s", (overrides, action) => {
    expect(keymap.resolve(stroke(overrides))).toBe(action);
  });

  it("copie avec Ctrl+C et colle avec Ctrl+V, comme Windows Terminal", () => {
    expect(keymap.resolve(stroke({ key: "c", ctrlKey: true }))).toBe("copyOrInterrupt");
    expect(keymap.resolve(stroke({ key: "v", ctrlKey: true }))).toBe("paste");
  });

  it("laisse Ctrl+C au shell quand on le désactive dans la config", () => {
    expect(Keymap.create({ "ctrl+c": "none" }).resolve(stroke({ key: "c", ctrlKey: true }))).toBeUndefined();
  });

  it("zoome avec Ctrl++ même quand Maj est nécessaire pour taper +", () => {
    expect(keymap.resolve(stroke({ key: "+", ctrlKey: true, shiftKey: true }))).toBe("zoomIn");
  });

  it("réinitialise avec Ctrl+0 sur un clavier AZERTY", () => {
    expect(keymap.resolve(stroke({ key: "à", code: "Digit0", ctrlKey: true }))).toBe("zoomReset");
  });

  it("applique les surcharges et les désactivations de la config", () => {
    const custom = Keymap.create({ "ctrl+shift+t": "none", "alt+t": "newTab" });
    expect(custom.resolve(stroke({ key: "T", ctrlKey: true, shiftKey: true }))).toBeUndefined();
    expect(custom.resolve(stroke({ key: "t", altKey: true }))).toBe("newTab");
  });

  it("signale les raccourcis et actions invalides sans planter", () => {
    const custom = Keymap.create({ "ctrl+shift": "copy", "alt+z": "voler" });
    expect(custom.problems).toHaveLength(2);
    expect(custom.resolve(stroke({ key: "C", ctrlKey: true, shiftKey: true }))).toBe("copy");
  });

  it("liste les raccourcis d'une action", () => {
    expect(keymap.chordsFor("newTab").map(formatChord)).toEqual(["Ctrl+Maj+T", "Meta+T"]);
  });
});
