import { describe, expect, it } from "vitest";
import { EMOJI_CATEGORIES, searchEmojis } from "./emoji-catalog";
import { firstGrapheme } from "./quick-commands";

const emojis = (query: string) => searchEmojis(query).map((candidate) => candidate.emoji);

describe("catalogue d'emojis", () => {
  it("ne contient que des emojis uniques, chacun d'un seul graphème", () => {
    const all = EMOJI_CATEGORIES.flatMap((category) => category.entries.map((candidate) => candidate.emoji));
    expect(new Set(all).size).toBe(all.length);
    for (const emoji of all) expect(firstGrapheme(emoji)).toBe(emoji);
  });

  it("donne tout le catalogue pour une recherche vide", () => {
    const total = EMOJI_CATEGORIES.reduce((sum, category) => sum + category.entries.length, 0);
    expect(searchEmojis("  ")).toHaveLength(total);
  });

  it("cherche en français et en anglais, sans accents ni casse", () => {
    expect(emojis("fusée")).toContain("🚀");
    expect(emojis("DEPLOY")).toContain("🚀");
    expect(emojis("baleine")).toEqual(["🐳"]);
  });

  it("cherche par début de mot et combine les mots", () => {
    expect(emojis("dock")).toContain("🐳");
    expect(emojis("carre rouge")).toEqual(["🟥"]);
  });

  it("accepte un emoji collé, même absent du catalogue", () => {
    expect(emojis("🦩")).toEqual(["🦩"]);
    expect(emojis("🐳 docker")).toEqual(["🐳"]);
  });

  it("retire le sélecteur de présentation, mal rendu avec une police emoji découpée", () => {
    expect(emojis("engrenage")).toEqual(["\u2699"]);
    expect(emojis("⚙️")).toEqual(["\u2699"]);
  });

  it("ne trouve rien pour un mot inconnu", () => {
    expect(searchEmojis("xyzzy")).toEqual([]);
  });
});
