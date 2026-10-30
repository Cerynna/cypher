import { describe, expect, it } from "vitest";
import { formatDuration } from "./command-history";
import { parseConfig, serializeConfig } from "./config";
import {
  completionMessage,
  createQuickCommand,
  firstGrapheme,
  plainText,
  type QuickCommand,
  terminalInput,
  waitsForCompletion,
} from "./quick-commands";

const build: QuickCommand = { emoji: "🔨", name: "Build", command: "yarn build", mode: "run", notify: false };

describe("commandes rapides", () => {
  it("refuse un nom ou une commande vide", () => {
    expect(createQuickCommand({ name: "  ", command: "ls" })).toBeUndefined();
    expect(createQuickCommand({ name: "Build", command: "" })).toBeUndefined();
  });

  it("s'exécutent par défaut dans le terminal actif avec un emoji par défaut", () => {
    expect(createQuickCommand({ name: " Build ", command: " yarn build " })).toEqual({
      emoji: "⚡",
      name: "Build",
      command: "yarn build",
      mode: "run",
      notify: false,
    });
  });

  it("ne garde qu'un seul emoji, même composé", () => {
    expect(firstGrapheme(" 👩‍💻 extra")).toBe("👩‍💻");
    expect(firstGrapheme("🇫🇷🇩🇪")).toBe("🇫🇷");
    expect(createQuickCommand({ emoji: "🐳🐳", name: "Docker", command: "docker.exe ps" })?.emoji).toBe("🐳");
  });

  it("notifie toujours en arrière-plan", () => {
    expect(createQuickCommand({ name: "Sync", command: "git fetch", mode: "background" })?.notify).toBe(true);
  });

  it("envoie Entrée sauf en mode « taper sans exécuter »", () => {
    expect(terminalInput(build)).toBe("yarn build\r");
    expect(terminalInput({ ...build, mode: "type" })).toBe("yarn build");
  });

  it("enchaîne les lignes d'une commande sur plusieurs lignes", () => {
    expect(terminalInput({ ...build, command: "git fetch\ngit status" })).toBe("git fetch\rgit status\r");
  });

  it("attend la fin de la commande seulement dans un terminal avec notification", () => {
    expect(waitsForCompletion({ ...build, notify: true })).toBe(true);
    expect(waitsForCompletion({ ...build, mode: "tab", notify: true })).toBe(true);
    expect(waitsForCompletion(build)).toBe(false);
    expect(waitsForCompletion({ ...build, mode: "background", notify: true })).toBe(false);
  });

  it("résume un succès et un échec pour la notification", () => {
    expect(completionMessage(build, { exitCode: 0, durationMs: 12_500, output: "built\n✓ done in 12s\n\n" }, formatDuration)).toEqual({
      title: "🔨 Build : terminé en 12,5 s",
      body: "✓ done in 12s",
      failed: false,
    });
    expect(completionMessage(build, { exitCode: 2, durationMs: undefined, output: "" }, formatDuration)).toEqual({
      title: "🔨 Build : échec (code 2)",
      body: "yarn build",
      failed: true,
    });
  });
});

describe("plainText", () => {
  it("retire les couleurs, les titres OSC et les retours chariot de progression", () => {
    expect(plainText("\x1b[32m✓\x1b[0m ok\x1b]0;titre\x07\r\nfin")).toBe("✓ ok\r\nfin");
    expect(plainText("10%\r50%\r100%")).toBe("10%\n50%\n100%");
  });
});

describe("config des onglets et commandes", () => {
  it("lit la position des onglets et la liste [[commands]]", () => {
    const { config, problems } = parseConfig({
      tabs: { position: "left" },
      commands: [
        { emoji: "🧪", name: "Tests", command: "yarn test", mode: "background" },
        { name: "htop", command: "htop", mode: "tab" },
        { name: "", command: "oups" },
      ],
    });
    expect(config.tabs.position).toBe("left");
    expect(config.commands.map((quickCommand) => [quickCommand.emoji, quickCommand.mode])).toEqual([
      ["🧪", "background"],
      ["⚡", "tab"],
    ]);
    expect(problems).toEqual(["commands[3] doit avoir un name et une command non vides"]);
  });

  it("convertit l'ancien format execute / new_tab", () => {
    const { config } = parseConfig({
      commands: [
        { name: "A", command: "a", execute: false },
        { name: "B", command: "b", new_tab: true },
      ],
    });
    expect(config.commands.map((quickCommand) => quickCommand.mode)).toEqual(["type", "tab"]);
  });

  it("signale un mode inconnu et garde le terminal actif", () => {
    const { config, problems } = parseConfig({ commands: [{ name: "A", command: "a", mode: "fusée" }] });
    expect(config.commands[0].mode).toBe("run");
    expect(problems).toHaveLength(1);
  });

  it("garde le haut par défaut et signale une position inconnue", () => {
    const { config, problems } = parseConfig({ tabs: { position: "diagonale" } });
    expect(config.tabs.position).toBe("top");
    expect(problems).toHaveLength(1);
  });

  it("se relit à l'identique après sérialisation", () => {
    const { config } = parseConfig({
      tabs: { position: "bottom" },
      commands: [{ emoji: "🚀", name: "Deploy", command: "make deploy", mode: "run", notify: true }],
    });
    expect(parseConfig(serializeConfig(config))).toEqual({ config, problems: [] });
  });
});
