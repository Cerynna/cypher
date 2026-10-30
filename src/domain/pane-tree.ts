export type PaneId = string;

export type Orientation = "horizontal" | "vertical";

export type PaneNode =
  | { readonly kind: "pane"; readonly id: PaneId }
  | {
      readonly kind: "split";
      readonly orientation: Orientation;
      readonly first: PaneNode;
      readonly second: PaneNode;
      readonly ratio?: number;
    };

export type SplitNode = Extract<PaneNode, { kind: "split" }>;

export type SplitPath = readonly ("first" | "second")[];

export const DEFAULT_RATIO = 0.5;
export const MIN_RATIO = 0.1;
export const MAX_RATIO = 0.9;

export function splitRatio(node: SplitNode): number {
  return node.ratio ?? DEFAULT_RATIO;
}

export function clampRatio(ratio: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

export type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export type Direction = "left" | "right" | "up" | "down";

export const UNIT_RECT: Rect = { x: 0, y: 0, width: 1, height: 1 };

export function leaf(id: PaneId): PaneNode {
  return { kind: "pane", id };
}

export function paneIds(node: PaneNode): readonly PaneId[] {
  return node.kind === "pane" ? [node.id] : [...paneIds(node.first), ...paneIds(node.second)];
}

export function containsPane(node: PaneNode, id: PaneId): boolean {
  return paneIds(node).includes(id);
}

export function splitPane(node: PaneNode, target: PaneId, newPane: PaneId, orientation: Orientation): PaneNode {
  if (node.kind === "pane") {
    return node.id === target ? { kind: "split", orientation, first: node, second: leaf(newPane) } : node;
  }
  return {
    ...node,
    first: splitPane(node.first, target, newPane, orientation),
    second: splitPane(node.second, target, newPane, orientation),
  };
}

export function removePane(node: PaneNode, target: PaneId): PaneNode | undefined {
  if (node.kind === "pane") return node.id === target ? undefined : node;
  const first = removePane(node.first, target);
  const second = removePane(node.second, target);
  if (!first) return second;
  if (!second) return first;
  return { ...node, first, second };
}

export function resizeSplit(node: PaneNode, path: SplitPath, ratio: number): PaneNode {
  if (node.kind === "pane") return node;
  if (path.length === 0) return { ...node, ratio: clampRatio(ratio) };
  const [branch, ...rest] = path;
  return { ...node, [branch]: resizeSplit(node[branch], rest, ratio) };
}

export function layoutRects(node: PaneNode, rect: Rect = UNIT_RECT): ReadonlyMap<PaneId, Rect> {
  if (node.kind === "pane") return new Map([[node.id, rect]]);
  const ratio = splitRatio(node);
  const [firstRect, secondRect] =
    node.orientation === "horizontal"
      ? [
          { ...rect, width: rect.width * ratio },
          { ...rect, x: rect.x + rect.width * ratio, width: rect.width * (1 - ratio) },
        ]
      : [
          { ...rect, height: rect.height * ratio },
          { ...rect, y: rect.y + rect.height * ratio, height: rect.height * (1 - ratio) },
        ];
  return new Map([...layoutRects(node.first, firstRect), ...layoutRects(node.second, secondRect)]);
}

const EPSILON = 1e-9;

function overlap(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function neighbourScore(from: Rect, to: Rect, direction: Direction): number | undefined {
  const horizontal = direction === "left" || direction === "right";
  const gap = {
    left: from.x - (to.x + to.width),
    right: to.x - (from.x + from.width),
    up: from.y - (to.y + to.height),
    down: to.y - (from.y + from.height),
  }[direction];
  const shared = horizontal
    ? overlap(from.y, from.y + from.height, to.y, to.y + to.height)
    : overlap(from.x, from.x + from.width, to.x, to.x + to.width);
  if (gap < -EPSILON || shared <= EPSILON) return undefined;
  return gap * 10 - shared;
}

export function neighbour(node: PaneNode, from: PaneId, direction: Direction): PaneId | undefined {
  const rects = layoutRects(node);
  const origin = rects.get(from);
  if (!origin) return undefined;
  let best: { id: PaneId; score: number } | undefined;
  for (const [id, rect] of rects) {
    if (id === from) continue;
    const score = neighbourScore(origin, rect, direction);
    if (score !== undefined && (!best || score < best.score)) best = { id, score };
  }
  return best?.id;
}

export function isPaneNode(value: unknown): value is PaneNode {
  if (typeof value !== "object" || value === null) return false;
  const node = value as Record<string, unknown>;
  if (node.kind === "pane") return typeof node.id === "string" && node.id !== "";
  return (
    node.kind === "split" &&
    (node.orientation === "horizontal" || node.orientation === "vertical") &&
    (node.ratio === undefined ||
      (typeof node.ratio === "number" && node.ratio >= MIN_RATIO && node.ratio <= MAX_RATIO)) &&
    isPaneNode(node.first) &&
    isPaneNode(node.second)
  );
}
