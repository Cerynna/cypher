import { describe, expect, it } from "vitest";
import { HighScores } from "./high-scores";

const run = (score: number, at = 1) => ({ score, lines: 0, level: 1, at });

describe("HighScores", () => {
  it("classe les scores et donne le rang du nouveau", () => {
    const { table, rank } = HighScores.create([run(500), run(100)]).record(run(300, 2));
    expect(table.entries.map((entry) => entry.score)).toEqual([500, 300, 100]);
    expect(rank).toBe(2);
    expect(table.best).toBe(500);
  });

  it("ne garde que les cinq meilleurs et n'enregistre pas un score nul", () => {
    const full = HighScores.create([run(900), run(800), run(700), run(600), run(500)]);
    expect(full.record(run(100)).rank).toBeUndefined();
    expect(full.record(run(0)).rank).toBeUndefined();
    expect(full.record(run(650)).table.entries).toHaveLength(5);
  });
});
