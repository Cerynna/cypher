export type HighScore = { readonly score: number; readonly lines: number; readonly level: number; readonly at: number };

export type Ranking = { readonly table: HighScores; readonly rank: number | undefined };

export class HighScores {
  static readonly SIZE = 5;

  private constructor(readonly entries: readonly HighScore[]) {}

  static create(entries: readonly HighScore[] = []): HighScores {
    return new HighScores([...entries].sort((a, b) => b.score - a.score).slice(0, HighScores.SIZE));
  }

  get best(): number {
    return this.entries[0]?.score ?? 0;
  }

  record(entry: HighScore): Ranking {
    if (entry.score <= 0) return { table: this, rank: undefined };
    const table = HighScores.create([...this.entries, entry]);
    const index = table.entries.indexOf(entry);
    return { table, rank: index === -1 ? undefined : index + 1 };
  }
}
