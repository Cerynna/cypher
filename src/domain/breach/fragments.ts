export type Point = { readonly x: number; readonly y: number };

export type Fragment = {
  readonly name: string;
  readonly cells: readonly Point[];
  readonly color: number;
  readonly glitch: number | undefined;
};

const shape = (...pairs: readonly (readonly [number, number])[]): readonly Point[] =>
  pairs.map(([x, y]) => ({ x, y }));

export const FRAGMENTS: readonly Omit<Fragment, "glitch">[] = [
  { name: "bit", cells: shape([0, 0], [1, 0], [2, 0]), color: 1 },
  { name: "hook", cells: shape([0, 0], [0, 1], [1, 1]), color: 2 },
  { name: "node", cells: shape([1, 0], [0, 1], [1, 1], [2, 1], [1, 2]), color: 3 },
  { name: "port", cells: shape([0, 0], [2, 0], [0, 1], [1, 1], [2, 1]), color: 4 },
  { name: "mast", cells: shape([0, 0], [1, 0], [2, 0], [1, 1], [1, 2]), color: 5 },
  { name: "corner", cells: shape([0, 0], [0, 1], [0, 2], [1, 2], [2, 2]), color: 6 },
  { name: "stair", cells: shape([0, 0], [0, 1], [1, 1], [1, 2], [2, 2]), color: 1 },
  { name: "jack", cells: shape([0, 0], [0, 1], [0, 2], [0, 3], [1, 3]), color: 2 },
  { name: "chip", cells: shape([0, 0], [1, 0], [0, 1], [1, 1], [0, 2]), color: 3 },
  { name: "beam", cells: shape([0, 0], [0, 1], [0, 2], [0, 3], [0, 4]), color: 4 },
];

export const GLITCH_CHANCE = 1 / 8;

export function normalize(cells: readonly Point[]): readonly Point[] {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return cells.map((cell) => ({ x: cell.x - minX, y: cell.y - minY }));
}

export function rotateClockwise(cells: readonly Point[]): readonly Point[] {
  const height = Math.max(...cells.map((cell) => cell.y));
  return normalize(cells.map((cell) => ({ x: height - cell.y, y: cell.x })));
}

export function drawFragment(random: () => number): Fragment {
  const base = FRAGMENTS[Math.floor(random() * FRAGMENTS.length)] ?? FRAGMENTS[0];
  if (!base) throw new Error("aucun fragment");
  const glitch = random() < GLITCH_CHANCE ? Math.floor(random() * base.cells.length) : undefined;
  return { ...base, glitch };
}
