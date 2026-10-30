import { describe, expect, it } from "vitest";
import { FontSize } from "./font-size";

describe("FontSize", () => {
  it("part de la taille par défaut", () => {
    expect(FontSize.create().value).toBe(16);
  });

  it("augmente, diminue et revient à la taille par défaut", () => {
    const size = FontSize.create().increase().increase().decrease();
    expect(size.value).toBe(17);
    expect(size.reset().value).toBe(16);
  });

  it("reste dans les bornes", () => {
    expect(FontSize.create(FontSize.MAX).increase().value).toBe(FontSize.MAX);
    expect(FontSize.create(FontSize.MIN).decrease().value).toBe(FontSize.MIN);
    expect(FontSize.create(3).value).toBe(FontSize.MIN);
  });
});
