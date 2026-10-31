import { absoluteCells, type ActivePiece, BOARD_HEIGHT, BOARD_WIDTH, Breach, GLITCH } from "../domain/breach/breach";
import type { Fragment } from "../domain/breach/fragments";
import type { HighScores } from "../domain/breach/high-scores";
import { element, textElement } from "./dom";
import { openOverlay } from "./overlay";

export type BreachStorage = {
  readonly load: () => HighScores;
  readonly save: (table: HighScores) => void;
};

const PALETTE_VARIABLES = ["--accent", "--highlight", "--success", "--warning", "--accent-alt", "--fg"] as const;
const PREVIEW_CELLS = 5;

type Palette = { readonly colors: readonly string[]; readonly glitch: string; readonly grid: string; readonly text: string };

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim() || "#05d9e8";
  return {
    colors: PALETTE_VARIABLES.map(read),
    glitch: read("--danger"),
    grid: read("--muted"),
    text: read("--fg"),
  };
}

function cellSize(): number {
  return Math.max(14, Math.min(26, Math.floor((window.innerHeight - 220) / BOARD_HEIGHT)));
}

function stat(label: string): { readonly row: HTMLElement; readonly value: HTMLElement } {
  const row = element("div", "breach__stat");
  const value = textElement("span", "breach__value", "0");
  row.append(textElement("span", "breach__label", label), value);
  return { row, value };
}

export function openBreach(storage: BreachStorage, onClose: () => void): void {
  let frame = 0;
  let game = Breach.create();
  let table = storage.load();
  let rank: number | undefined;
  let recorded = false;
  let lastDrop = performance.now();
  const palette = readPalette();
  const size = cellSize();
  const fontFamily = getComputedStyle(document.body).fontFamily;
  let drawn: Breach | undefined;

  const overlay = openOverlay(
    "BREACH",
    () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("blur", pauseOnBlur);
      onClose();
    },
    "overlay__panel--breach",
  );

  const canvas = element("canvas", "breach__board");
  canvas.width = BOARD_WIDTH * size;
  canvas.height = BOARD_HEIGHT * size;
  canvas.tabIndex = 0;
  const preview = element("canvas", "breach__preview");
  preview.width = PREVIEW_CELLS * 14;
  preview.height = PREVIEW_CELLS * 14;
  const score = stat("Score");
  const best = stat("Record");
  const level = stat("Niveau");
  const lines = stat("Lignes");
  const scores = element("ol", "breach__scores");
  const side = element("aside", "breach__side");
  side.append(
    score.row,
    best.row,
    level.row,
    lines.row,
    textElement("span", "breach__label", "Suivant"),
    preview,
    textElement("span", "breach__label", "Meilleurs scores"),
    scores,
    textElement(
      "p",
      "breach__help",
      "← → déplacer · ↑ tourner · ↓ descendre · Espace lâcher · P pause · Échap quitter\nUne case ! effacée perce toute sa colonne.",
    ),
  );
  const layout = element("div", "breach");
  layout.append(canvas, side);
  overlay.body.append(layout);

  const context = canvas.getContext("2d");
  const previewContext = preview.getContext("2d");
  if (!context || !previewContext) return overlay.close();

  function pauseOnBlur(): void {
    if (game.status === "running") game = game.togglePause();
  }
  window.addEventListener("blur", pauseOnBlur);

  const renderScores = () => {
    scores.replaceChildren(
      ...(table.entries.length === 0
        ? [textElement("li", "breach__empty", "Aucun score")]
        : table.entries.map((entry, index) => {
            const item = textElement("li", "breach__score", `${entry.score} · niv. ${entry.level}`);
            item.classList.toggle("breach__score--new", index + 1 === rank && game.status === "over");
            return item;
          })),
    );
  };

  const drawCell = (target: CanvasRenderingContext2D, x: number, y: number, cell: number, unit: number, alpha = 1) => {
    const glitch = cell === GLITCH;
    const color = glitch ? palette.glitch : (palette.colors[(cell - 1) % palette.colors.length] ?? palette.text);
    target.globalAlpha = alpha;
    target.fillStyle = color;
    target.shadowColor = color;
    target.shadowBlur = alpha === 1 ? unit / 3 : 0;
    target.fillRect(x * unit + 1, y * unit + 1, unit - 2, unit - 2);
    target.shadowBlur = 0;
    if (glitch && alpha === 1) {
      target.fillStyle = palette.text;
      target.font = `bold ${Math.round(unit * 0.7)}px ${fontFamily}`;
      target.textAlign = "center";
      target.textBaseline = "middle";
      target.fillText("!", x * unit + unit / 2, y * unit + unit / 2 + 1);
    }
    target.globalAlpha = 1;
  };

  const pieceCell = (piece: ActivePiece, index: number) =>
    index === piece.fragment.glitch ? GLITCH : piece.fragment.color;

  const drawPreview = (fragment: Fragment) => {
    previewContext.clearRect(0, 0, preview.width, preview.height);
    const unit = 14;
    const width = Math.max(...fragment.cells.map((cell) => cell.x)) + 1;
    const height = Math.max(...fragment.cells.map((cell) => cell.y)) + 1;
    const offsetX = (PREVIEW_CELLS - width) / 2;
    const offsetY = (PREVIEW_CELLS - height) / 2;
    fragment.cells.forEach((cell, index) => {
      drawCell(previewContext, cell.x + offsetX, cell.y + offsetY, index === fragment.glitch ? GLITCH : fragment.color, unit);
    });
  };

  const drawBanner = (title: string, subtitle: string) => {
    context.fillStyle = "rgb(0 0 0 / 65%)";
    context.fillRect(0, canvas.height / 2 - 48, canvas.width, 96);
    context.fillStyle = palette.glitch;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `bold ${Math.round(size * 0.9)}px ${fontFamily}`;
    context.fillText(title, canvas.width / 2, canvas.height / 2 - 14);
    context.fillStyle = palette.text;
    context.font = `${Math.round(size * 0.55)}px ${fontFamily}`;
    context.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 18);
  };

  const draw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = palette.grid;
    context.globalAlpha = 0.18;
    for (let x = 1; x < BOARD_WIDTH; x++) {
      context.beginPath();
      context.moveTo(x * size + 0.5, 0);
      context.lineTo(x * size + 0.5, canvas.height);
      context.stroke();
    }
    context.globalAlpha = 1;
    game.board.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell !== 0) drawCell(context, x, y, cell, size);
      });
    });
    if (game.status !== "over") {
      absoluteCells(game.ghost).forEach(({ x, y }, index) => drawCell(context, x, y, pieceCell(game.piece, index), size, 0.18));
      absoluteCells(game.piece).forEach(({ x, y }, index) => drawCell(context, x, y, pieceCell(game.piece, index), size));
    }
    if (game.status === "paused") drawBanner("PAUSE", "P pour reprendre");
    if (game.status === "over") {
      drawBanner("BREACH ÉCHOUÉ", rank === 1 ? "Nouveau record ! Entrée pour rejouer" : "Entrée pour rejouer");
    }
    score.value.textContent = String(game.score);
    best.value.textContent = String(Math.max(table.best, game.score));
    level.value.textContent = String(game.level);
    lines.value.textContent = String(game.lines);
    if (drawn?.next !== game.next) drawPreview(game.next);
    drawn = game;
  };

  const finish = () => {
    if (recorded) return;
    recorded = true;
    const ranking = table.record({ score: game.score, lines: game.lines, level: game.level, at: Date.now() });
    table = ranking.table;
    rank = ranking.rank;
    storage.save(table);
    renderScores();
  };

  const restart = () => {
    game = Breach.create();
    drawn = undefined;
    recorded = false;
    rank = undefined;
    lastDrop = performance.now();
    renderScores();
  };

  const loop = (now: number) => {
    if (game.status === "running" && now - lastDrop >= game.dropInterval) {
      game = game.tick();
      lastDrop = now;
    }
    if (game.status === "over") finish();
    if (game !== drawn) draw();
    frame = requestAnimationFrame(loop);
  };

  const controls: Readonly<Record<string, () => void>> = {
    ArrowLeft: () => (game = game.move(-1)),
    ArrowRight: () => (game = game.move(1)),
    ArrowUp: () => (game = game.rotate()),
    x: () => (game = game.rotate()),
    ArrowDown: () => {
      game = game.softDrop();
      lastDrop = performance.now();
    },
    " ": () => {
      game = game.hardDrop();
      lastDrop = performance.now();
    },
    p: () => (game = game.togglePause()),
    Enter: () => {
      if (game.status === "over") restart();
    },
  };

  canvas.addEventListener("keydown", (event) => {
    if (event.key === "Escape") return;
    event.stopPropagation();
    const control = controls[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!control) return;
    event.preventDefault();
    control();
  });
  canvas.addEventListener("blur", () => requestAnimationFrame(() => overlay.panel.isConnected && canvas.focus()));

  renderScores();
  canvas.focus();
  frame = requestAnimationFrame(loop);
}
