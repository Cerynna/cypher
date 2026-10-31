import { drawFragment, type Fragment, type Point, rotateClockwise } from "./fragments";

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const GLITCH = 99;

const LINE_SCORES = [0, 100, 300, 500, 800, 1200] as const;
const COMBO_BONUS = 50;
const GLITCH_BONUS = 250;
const LINES_PER_LEVEL = 10;
const KICKS = [0, -1, 1, -2, 2] as const;

export type Board = readonly (readonly number[])[];
export type BreachStatus = "running" | "paused" | "over";
export type ActivePiece = { readonly fragment: Fragment; readonly cells: readonly Point[]; readonly x: number; readonly y: number };

type Progress = { readonly score: number; readonly lines: number; readonly combo: number };

function emptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array.from({ length: BOARD_WIDTH }, () => 0));
}

function spawn(fragment: Fragment): ActivePiece {
  const width = Math.max(...fragment.cells.map((cell) => cell.x)) + 1;
  return { fragment, cells: fragment.cells, x: Math.floor((BOARD_WIDTH - width) / 2), y: 0 };
}

export function absoluteCells(piece: ActivePiece): readonly Point[] {
  return piece.cells.map((cell) => ({ x: piece.x + cell.x, y: piece.y + cell.y }));
}

function fits(board: Board, piece: ActivePiece): boolean {
  return absoluteCells(piece).every(
    ({ x, y }) => x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT && board[y]?.[x] === 0,
  );
}

function stamp(board: Board, piece: ActivePiece): Board {
  const next = board.map((row) => [...row]);
  absoluteCells(piece).forEach(({ x, y }, index) => {
    const row = next[y];
    if (row) row[x] = index === piece.fragment.glitch ? GLITCH : piece.fragment.color;
  });
  return next;
}

type Cleared = { readonly board: Board; readonly lines: number; readonly glitches: number };

function clearLines(board: Board): Cleared {
  const full = board.flatMap((row, y) => (row.every((cell) => cell !== 0) ? [y] : []));
  if (full.length === 0) return { board, lines: 0, glitches: 0 };
  const breachedColumns = new Set(full.flatMap((y) => (board[y] ?? []).flatMap((cell, x) => (cell === GLITCH ? [x] : []))));
  const remaining = board
    .filter((_, y) => !full.includes(y))
    .map((row) => row.map((cell, x) => (breachedColumns.has(x) ? 0 : cell)));
  const refill = Array.from({ length: full.length }, () => Array.from({ length: BOARD_WIDTH }, () => 0));
  return { board: [...refill, ...remaining], lines: full.length, glitches: breachedColumns.size };
}

export class Breach {
  private constructor(
    readonly board: Board,
    readonly piece: ActivePiece,
    readonly next: Fragment,
    readonly score: number,
    readonly lines: number,
    readonly combo: number,
    readonly status: BreachStatus,
    private readonly random: () => number,
  ) {}

  static create(random: () => number = Math.random): Breach {
    return new Breach(emptyBoard(), spawn(drawFragment(random)), drawFragment(random), 0, 0, 0, "running", random);
  }

  static fromBoard(board: Board, fragment: Fragment, random: () => number): Breach {
    return new Breach(board, spawn(fragment), fragment, 0, 0, 0, "running", random);
  }

  get level(): number {
    return Math.floor(this.lines / LINES_PER_LEVEL) + 1;
  }

  get dropInterval(): number {
    return Math.max(90, 800 - (this.level - 1) * 70);
  }

  get ghost(): ActivePiece {
    let ghost = this.piece;
    while (fits(this.board, { ...ghost, y: ghost.y + 1 })) ghost = { ...ghost, y: ghost.y + 1 };
    return ghost;
  }

  move(dx: number): Breach {
    return this.tryPlace({ ...this.piece, x: this.piece.x + dx });
  }

  rotate(): Breach {
    if (this.status !== "running") return this;
    const cells = rotateClockwise(this.piece.cells);
    for (const kick of KICKS) {
      const candidate = { ...this.piece, cells, x: this.piece.x + kick };
      if (fits(this.board, candidate)) return this.with({ piece: candidate });
    }
    return this;
  }

  softDrop(): Breach {
    if (this.status !== "running") return this;
    const lowered = { ...this.piece, y: this.piece.y + 1 };
    if (!fits(this.board, lowered)) return this.lock();
    return this.with({ piece: lowered, score: this.score + 1 });
  }

  hardDrop(): Breach {
    if (this.status !== "running") return this;
    const ghost = this.ghost;
    return this.with({ piece: ghost, score: this.score + (ghost.y - this.piece.y) * 2 }).lock();
  }

  tick(): Breach {
    if (this.status !== "running") return this;
    const lowered = { ...this.piece, y: this.piece.y + 1 };
    return fits(this.board, lowered) ? this.with({ piece: lowered }) : this.lock();
  }

  togglePause(): Breach {
    if (this.status === "over") return this;
    return this.with({ status: this.status === "paused" ? "running" : "paused" });
  }

  private tryPlace(piece: ActivePiece): Breach {
    if (this.status !== "running" || !fits(this.board, piece)) return this;
    return this.with({ piece });
  }

  private lock(): Breach {
    const cleared = clearLines(stamp(this.board, this.piece));
    const progress = this.scored(cleared);
    const piece = spawn(this.next);
    const next = drawFragment(this.random);
    const status = fits(cleared.board, piece) ? "running" : "over";
    return new Breach(cleared.board, piece, next, progress.score, progress.lines, progress.combo, status, this.random);
  }

  private scored(cleared: Cleared): Progress {
    if (cleared.lines === 0) return { score: this.score, lines: this.lines, combo: 0 };
    const level = this.level;
    const combo = this.combo + 1;
    const gained =
      (LINE_SCORES[cleared.lines] ?? LINE_SCORES[5]) * level +
      COMBO_BONUS * (combo - 1) * level +
      GLITCH_BONUS * cleared.glitches * level;
    return { score: this.score + gained, lines: this.lines + cleared.lines, combo };
  }

  private with(changes: Partial<Pick<Breach, "piece" | "score" | "status">>): Breach {
    return new Breach(
      this.board,
      changes.piece ?? this.piece,
      this.next,
      changes.score ?? this.score,
      this.lines,
      this.combo,
      changes.status ?? this.status,
      this.random,
    );
  }
}
