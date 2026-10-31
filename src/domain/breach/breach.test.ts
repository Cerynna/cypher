import { describe, expect, it } from "vitest";
import { absoluteCells, BOARD_HEIGHT, BOARD_WIDTH, type Board, Breach, GLITCH } from "./breach";
import { FRAGMENTS, type Fragment, rotateClockwise } from "./fragments";

const neverGlitch = () => 0.99;
const fragment = (name: string, glitch?: number): Fragment => {
  const base = FRAGMENTS.find((candidate) => candidate.name === name);
  if (!base) throw new Error(name);
  return { ...base, glitch };
};

function boardWith(rows: Readonly<Record<number, string>>): Board {
  return Array.from({ length: BOARD_HEIGHT }, (_, y) =>
    Array.from({ length: BOARD_WIDTH }, (_, x) => {
      const cell = rows[y]?.[x];
      if (cell === "#") return 1;
      if (cell === "!") return GLITCH;
      return 0;
    }),
  );
}

describe("fragments", () => {
  it("tournent sur eux-mêmes et reviennent à leur forme après quatre quarts de tour", () => {
    const hook = fragment("hook").cells;
    expect(rotateClockwise(hook)).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]);
    const full = rotateClockwise(rotateClockwise(rotateClockwise(rotateClockwise(hook))));
    expect(new Set(full.map(({ x, y }) => `${x},${y}`))).toEqual(new Set(hook.map(({ x, y }) => `${x},${y}`)));
  });
});

describe("Breach", () => {
  it("fait apparaître le fragment centré en haut", () => {
    const game = Breach.fromBoard(boardWith({}), fragment("bit"), neverGlitch);
    expect(absoluteCells(game.piece)).toEqual([
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
    ]);
  });

  it("bloque le fragment contre les murs", () => {
    let game = Breach.fromBoard(boardWith({}), fragment("bit"), neverGlitch);
    for (let step = 0; step < 10; step++) game = game.move(-1);
    expect(game.piece.x).toBe(0);
    for (let step = 0; step < 10; step++) game = game.move(1);
    expect(game.piece.x).toBe(BOARD_WIDTH - 3);
  });

  it("décale le fragment pour pouvoir le tourner contre un mur", () => {
    let game = Breach.fromBoard(boardWith({}), fragment("beam"), neverGlitch).rotate();
    for (let step = 0; step < 10; step++) game = game.move(1);
    const rotated = game.rotate();
    expect(rotated.piece).not.toBe(game.piece);
    expect(absoluteCells(rotated.piece).every(({ x }) => x < BOARD_WIDTH)).toBe(true);
  });

  it("efface une ligne pleine et compte les points du niveau", () => {
    const board = boardWith({ 19: "###.######" });
    let game = Breach.fromBoard(board, fragment("beam"), neverGlitch);
    game = game.move(-1).hardDrop();
    expect(game.lines).toBe(1);
    expect(game.board[19]?.filter((cell) => cell !== 0)).toHaveLength(1);
    expect(game.score).toBe(100 + 15 * 2);
  });

  it("efface toute la colonne d'une case glitch prise dans une ligne", () => {
    const board = boardWith({ 17: ".#........", 18: ".#........", 19: ".!########" });
    let game = Breach.fromBoard(board, fragment("beam"), neverGlitch);
    for (let step = 0; step < 10; step++) game = game.move(-1);
    game = game.hardDrop();
    expect(game.lines).toBe(1);
    expect(game.score).toBeGreaterThanOrEqual(100 + 250);
    expect(game.board.map((row) => row[1])).toEqual(Array.from({ length: BOARD_HEIGHT }, () => 0));
  });

  it("enchaîne un combo quand deux poses de suite effacent des lignes", () => {
    const board = boardWith({ 18: ".#########", 19: ".#########" });
    let game = Breach.fromBoard(board, fragment("bit"), neverGlitch);
    game = game.rotate();
    for (let step = 0; step < 10; step++) game = game.move(-1);
    game = game.hardDrop();
    expect(game.combo).toBe(1);
  });

  it("perd quand le nouveau fragment n'a plus de place", () => {
    const blocked = boardWith(Object.fromEntries(Array.from({ length: 3 }, (_, y) => [y, "#".repeat(9) + "."])));
    const game = Breach.fromBoard(blocked, fragment("bit"), neverGlitch);
    expect(game.hardDrop().status).toBe("over");
  });

  it("accélère avec le niveau sans descendre sous 90 ms", () => {
    expect(Breach.create(neverGlitch).dropInterval).toBe(800);
  });

  it("ne bouge plus en pause", () => {
    const paused = Breach.create(neverGlitch).togglePause();
    expect(paused.status).toBe("paused");
    expect(paused.tick()).toBe(paused);
    expect(paused.togglePause().status).toBe("running");
  });
});
