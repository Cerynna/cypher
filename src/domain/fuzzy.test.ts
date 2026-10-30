import { describe, expect, it } from "vitest";
import { rankByFuzzy } from "./fuzzy";

const labels = ["Nouvel onglet", "Onglet suivant", "Diviser à droite", "Réglages", "Rechercher dans le terminal"];

describe("rankByFuzzy", () => {
  it("garde tout dans l'ordre d'origine pour une recherche vide", () => {
    expect(rankByFuzzy("", labels, (label) => label)).toEqual(labels);
  });

  it("filtre par sous-séquence en ignorant accents et casse", () => {
    expect(rankByFuzzy("regl", labels, (label) => label)).toEqual(["Réglages"]);
    expect(rankByFuzzy("div dr", labels, (label) => label)).toEqual(["Diviser à droite"]);
  });

  it("classe d'abord les correspondances en début de mot", () => {
    expect(rankByFuzzy("ong", labels, (label) => label)[0]).toBe("Onglet suivant");
  });
});
