import { describe, expect, it } from "vitest";
import { KittyNotifications, parseOsc777, parseOsc9 } from "./attention";

const base64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

describe("OSC 9 (iTerm2)", () => {
  it("lit un message simple", () => {
    expect(parseOsc9("Claude attend ta réponse")).toEqual({ title: undefined, body: "Claude attend ta réponse" });
  });

  it("sépare le titre et le message au format de Claude Code", () => {
    expect(parseOsc9("\n\nClaude Code:\nClaude needs your permission to use Bash")).toEqual({
      title: "Claude Code",
      body: "Claude needs your permission to use Bash",
    });
  });

  it("retrouve le titre quand xterm a retiré les sauts de ligne de la séquence", () => {
    expect(parseOsc9("Claude Code:Claude is waiting for your input")).toEqual({
      title: "Claude Code",
      body: "Claude is waiting for your input",
    });
    expect(parseOsc9("Build fini : 3 erreurs")).toEqual({ title: undefined, body: "Build fini : 3 erreurs" });
    expect(parseOsc9("https://ci.example.com/run/42")?.title).toBeUndefined();
  });

  it("ignore les sous-commandes comme le dossier courant ou la progression", () => {
    expect(parseOsc9("9;/home/jm")).toBeUndefined();
    expect(parseOsc9("4;1;50")).toBeUndefined();
    expect(parseOsc9("   ")).toBeUndefined();
  });

  it("retire les caractères de contrôle", () => {
    expect(parseOsc9("fini\x1b[31m‮ !")?.body).toBe("fini [31m !");
  });
});

describe("OSC 777 (Ghostty, urxvt)", () => {
  it("lit le titre et le message, même avec des points-virgules", () => {
    expect(parseOsc777("notify;Claude Code;Tâche finie; prête à relire")).toEqual({
      title: "Claude Code",
      body: "Tâche finie; prête à relire",
    });
  });

  it("ignore les autres commandes", () => {
    expect(parseOsc777("preexec;ls")).toBeUndefined();
  });
});

describe("OSC 99 (kitty)", () => {
  it("assemble le titre et le corps envoyés en deux temps", () => {
    const kitty = new KittyNotifications();
    expect(kitty.receive("i=42:d=0:p=title;Claude Code")).toBeUndefined();
    expect(kitty.receive("i=42:p=body;Claude attend")).toEqual({ title: "Claude Code", body: "Claude attend" });
  });

  it("décode un corps en base64", () => {
    const kitty = new KittyNotifications();
    expect(kitty.receive(`i=1:e=1:p=body;${base64("Terminé ✅")}`)).toEqual({ title: undefined, body: "Terminé ✅" });
  });

  it("traite un message d'une seule partie comme un titre", () => {
    expect(new KittyNotifications().receive(";Build terminé")).toEqual({ title: undefined, body: "Build terminé" });
  });
});
