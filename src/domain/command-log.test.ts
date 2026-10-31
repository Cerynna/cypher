import { describe, expect, it } from "vitest";
import { CommandLog, commandIn, type LoggedCommand } from "./command-log";

const run = (command: string, finishedAt: number, cwd = "/srv"): LoggedCommand => ({
  command,
  cwd,
  exitCode: 0,
  durationMs: 10,
  finishedAt,
});

describe("CommandLog", () => {
  it("garde les commandes de la plus récente à la plus ancienne et ignore les vides", () => {
    const log = CommandLog.create().record(run("ls", 1)).record(run("  ", 2)).record(run("yarn test", 3));
    expect(log.entries.map((entry) => entry.command)).toEqual(["yarn test", "ls"]);
  });

  it("ne propose qu'une fois la même commande dans le même dossier", () => {
    const log = CommandLog.create()
      .record(run("yarn test", 1))
      .record(run("ls", 2))
      .record(run("yarn test", 3))
      .record(run("yarn test", 4, "/autre"));
    expect(log.latestDistinct().map((entry) => [entry.command, entry.cwd, entry.finishedAt])).toEqual([
      ["yarn test", "/autre", 4],
      ["yarn test", "/srv", 3],
      ["ls", "/srv", 2],
    ]);
  });

  it("oublie les plus anciennes au-delà de la capacité", () => {
    let log = CommandLog.create();
    for (let index = 0; index <= CommandLog.CAPACITY; index++) log = log.record(run(`echo ${index}`, index));
    expect(log.entries).toHaveLength(CommandLog.CAPACITY);
    expect(log.entries.at(-1)?.command).toBe("echo 1");
  });
});

describe("commandIn", () => {
  it("se place dans le dossier d'origine s'il diffère du dossier courant", () => {
    expect(commandIn(run("yarn test", 1, "/srv/app"), "/srv/app")).toBe("yarn test");
    expect(commandIn(run("yarn test", 1, "/srv/app"), "/home")).toBe("cd /srv/app && yarn test");
    expect(commandIn(run("ls", 1, "/srv/l'app web"), undefined)).toBe("cd '/srv/l'\\''app web' && ls");
  });
});
