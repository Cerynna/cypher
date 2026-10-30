import { describe, expect, it } from "vitest";
import {
  type CommandBlock,
  CommandHistory,
  formatDuration,
  shouldNotifyCompletion,
} from "./command-history";
import { directoryName, parseSemanticPrompt, parseWorkingDirectory } from "./shell-integration";

const base64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

describe("parseSemanticPrompt (OSC 133)", () => {
  it("reconnaît les quatre repères", () => {
    expect(parseSemanticPrompt("A")).toEqual({ kind: "promptStart" });
    expect(parseSemanticPrompt("B")).toEqual({ kind: "inputStart" });
    expect(parseSemanticPrompt("D;127")).toEqual({ kind: "commandEnd", exitCode: 127 });
    expect(parseSemanticPrompt("D")).toEqual({ kind: "commandEnd", exitCode: undefined });
  });

  it("décode la commande transmise en base64 UTF-8", () => {
    expect(parseSemanticPrompt(`C;cmd64=${base64("echo 'héllo' | wc")}`)).toEqual({
      kind: "commandStart",
      command: "echo 'héllo' | wc",
    });
  });

  it("ignore une commande mal encodée et les repères inconnus", () => {
    expect(parseSemanticPrompt("C;cmd64=%%%")).toEqual({ kind: "commandStart", command: undefined });
    expect(parseSemanticPrompt("Z")).toBeUndefined();
  });
});

describe("parseWorkingDirectory (OSC 7)", () => {
  it("extrait et décode le chemin", () => {
    expect(parseWorkingDirectory("file://pc/home/jm/mes%20projets")).toBe("/home/jm/mes projets");
    expect(parseWorkingDirectory("file:///C:/Users/jm")).toBe("C:/Users/jm");
    expect(parseWorkingDirectory("http://x/y")).toBeUndefined();
  });

  it("donne le nom du dossier", () => {
    expect(directoryName("/home/jm/Labo/cypher/")).toBe("cypher");
    expect(directoryName("/")).toBe("/");
  });
});

describe("CommandHistory", () => {
  const run = (exitCode: number) =>
    CommandHistory.empty<string>()
      .apply({ kind: "promptStart" }, "L1", 0)
      .apply({ kind: "inputStart" }, "L1", 0)
      .apply({ kind: "commandStart", command: " make test " }, "L2", 1_000)
      .apply({ kind: "commandEnd", exitCode }, "L9", 13_500);

  it("construit un bloc complet", () => {
    expect(run(0).current).toEqual<CommandBlock<string>>({
      id: 1,
      promptAnchor: "L1",
      outputAnchor: "L2",
      endAnchor: "L9",
      command: "make test",
      exitCode: 0,
      startedAt: 1_000,
      finishedAt: 13_500,
    });
  });

  it("retrouve la dernière commande terminée et le dernier échec", () => {
    const history = run(2).apply({ kind: "promptStart" }, "L10", 14_000);
    expect(history.lastFinished?.id).toBe(1);
    expect(history.lastFailed?.exitCode).toBe(2);
    expect(run(0).lastFailed).toBeUndefined();
  });

  it("ignore une fin de commande sans début (prompt vide)", () => {
    const history = CommandHistory.empty<string>()
      .apply({ kind: "promptStart" }, "L1", 0)
      .apply({ kind: "commandEnd", exitCode: 0 }, "L1", 10);
    expect(history.current?.finishedAt).toBeUndefined();
  });

  it("notifie seulement les commandes longues terminées hors focus", () => {
    const block = run(0).current!;
    expect(shouldNotifyCompletion(block, 10, false)).toBe(true);
    expect(shouldNotifyCompletion(block, 10, true)).toBe(false);
    expect(shouldNotifyCompletion(block, 60, false)).toBe(false);
    expect(shouldNotifyCompletion(block, 0, false)).toBe(false);
  });

  it.each([
    [450, "450 ms"],
    [12_500, "12,5 s"],
    [125_000, "2 min 05 s"],
    [3_780_000, "1 h 03 min"],
  ])("formate %d ms en %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
