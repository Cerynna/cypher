import { describe, expect, it } from "vitest";
import { ClipboardHistory } from "./clipboard-history";

const texts = (history: ClipboardHistory) => history.entries.map((entry) => entry.text);

describe("ClipboardHistory", () => {
  it("garde les copies de la plus récente à la plus ancienne", () => {
    const history = ClipboardHistory.create().record("a", 1).record("b", 2);
    expect(history.entries).toEqual([
      { text: "b", copiedAt: 2 },
      { text: "a", copiedAt: 1 },
    ]);
  });

  it("remonte une copie déjà présente au lieu de la dupliquer", () => {
    const history = ClipboardHistory.create().record("a", 1).record("b", 2).record("a", 3);
    expect(history.entries).toEqual([
      { text: "a", copiedAt: 3 },
      { text: "b", copiedAt: 2 },
    ]);
  });

  it("ignore les copies vides et la répétition de la dernière", () => {
    const history = ClipboardHistory.create().record("a", 1);
    expect(history.record("  \n", 2)).toBe(history);
    expect(history.record("a", 3)).toBe(history);
  });

  it("oublie les plus anciennes au-delà de la capacité", () => {
    let history = ClipboardHistory.create();
    for (let index = 0; index <= ClipboardHistory.CAPACITY; index++) history = history.record(`copie ${index}`, index);
    expect(history.entries).toHaveLength(ClipboardHistory.CAPACITY);
    expect(history.latest?.text).toBe(`copie ${ClipboardHistory.CAPACITY}`);
    expect(texts(history)).not.toContain("copie 0");
  });

  it("retire une copie ou vide tout", () => {
    const history = ClipboardHistory.create().record("a", 1).record("b", 2);
    expect(texts(history.remove("a"))).toEqual(["b"]);
    expect(history.clear().entries).toEqual([]);
  });
});
