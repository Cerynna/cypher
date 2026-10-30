export type Ranked<T> = { readonly item: T; readonly score: number };

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function fuzzyScore(query: string, text: string): number | undefined {
  const needle = normalize(query).replace(/\s+/g, "");
  const haystack = normalize(text);
  if (needle === "") return 0;
  let score = 0;
  let position = -1;
  let streak = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, position + 1);
    if (found === -1) return undefined;
    const atWordStart = found === 0 || /[\s:/-]/.test(haystack[found - 1]);
    streak = found === position + 1 ? streak + 1 : 0;
    score += 1 + streak * 2 + (atWordStart ? 3 : 0) - Math.min(found - position - 1, 5) * 0.2;
    position = found;
  }
  return score;
}

export function rankByFuzzy<T>(query: string, items: readonly T[], text: (item: T) => string): readonly T[] {
  return items
    .flatMap((item): Ranked<T>[] => {
      const score = fuzzyScore(query, text(item));
      return score === undefined ? [] : [{ item, score }];
    })
    .sort((a, b) => b.score - a.score)
    .map((ranked) => ranked.item);
}
