import { describe, expect, it } from "vitest";
import { defaultFrame, fitFrame, MIN_FRAME } from "./floating-frame";

const viewport = { width: 1200, height: 800 };

describe("fitFrame", () => {
  it("garde la fenêtre entièrement visible", () => {
    expect(fitFrame({ x: 1100, y: -30, width: 400, height: 300 }, viewport)).toEqual({
      x: 800,
      y: 0,
      width: 400,
      height: 300,
    });
  });

  it("respecte la taille minimale et ne dépasse pas l'écran", () => {
    expect(fitFrame({ x: 0, y: 0, width: 10, height: 10 }, viewport)).toMatchObject(MIN_FRAME);
    expect(fitFrame({ x: 0, y: 0, width: 5000, height: 5000 }, viewport)).toMatchObject(viewport);
  });
});

describe("defaultFrame", () => {
  it("se place en haut à droite", () => {
    expect(defaultFrame(viewport)).toEqual({ x: 616, y: 64, width: 560, height: 420 });
  });
});
