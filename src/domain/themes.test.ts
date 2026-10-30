import { describe, expect, it } from "vitest";
import { THEMES } from "./themes";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const HEX = /^#[0-9a-f]{6}$/;
const themes = Object.entries(THEMES);

describe("thèmes", () => {
  it("ont tous un libellé distinct", () => {
    const labels = themes.map(([, palette]) => palette.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it.each(themes)("%s définit 16 couleurs ANSI valides", (_name, palette) => {
    expect(palette.ansi).toHaveLength(16);
    for (const color of [...palette.ansi, palette.background, palette.foreground, palette.accent]) {
      expect(color).toMatch(HEX);
    }
  });

  it.each(themes)("%s garde un texte très lisible (contraste ≥ 7)", (_name, palette) => {
    expect(contrast(palette.foreground, palette.background)).toBeGreaterThanOrEqual(7);
  });

  it.each(themes)("%s garde des couleurs ANSI lisibles sur le fond (contraste ≥ 3)", (_name, palette) => {
    const readable = palette.ansi.filter((_color, index) => index !== 0 && index !== 8);
    for (const color of readable) expect(contrast(color, palette.background)).toBeGreaterThanOrEqual(3);
  });

  it.each(themes.filter(([, palette]) => palette.isDark))("%s garde le gris discret lisible (contraste ≥ 3)", (_name, palette) => {
    expect(contrast(palette.muted, palette.background)).toBeGreaterThanOrEqual(3);
  });
});
