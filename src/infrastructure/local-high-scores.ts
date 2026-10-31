import { type HighScore, HighScores } from "../domain/breach/high-scores";

const STORAGE_KEY = "cypher.breach.highScores";

function isHighScore(value: unknown): value is HighScore {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return ["score", "lines", "level", "at"].every((key) => typeof entry[key] === "number");
}

export function loadHighScores(): HighScores {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return HighScores.create(Array.isArray(saved) ? saved.filter(isHighScore) : []);
  } catch {
    return HighScores.create();
  }
}

export function saveHighScores(table: HighScores): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(table.entries));
  } catch {}
}
