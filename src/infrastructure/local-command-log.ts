import { CommandLog, type LoggedCommand } from "../domain/command-log";

const STORAGE_KEY = "cypher.commandLog";

function isLoggedCommand(value: unknown): value is LoggedCommand {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.command === "string" && typeof entry.finishedAt === "number";
}

export function loadCommandLog(): CommandLog {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return CommandLog.create(Array.isArray(saved) ? saved.filter(isLoggedCommand) : []);
  } catch {
    return CommandLog.create();
  }
}

export function saveCommandLog(log: CommandLog): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log.entries));
  } catch (error) {
    console.warn("historique des commandes non enregistré", error);
  }
}
