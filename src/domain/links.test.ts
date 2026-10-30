import { describe, expect, it } from "vitest";
import { editorInvocation, findFileLinks } from "./links";

describe("findFileLinks", () => {
  it("repère un chemin avec ligne et colonne", () => {
    expect(findFileLinks("error in src/main.ts:12:3 — oops")).toEqual([
      { start: 9, length: 16, path: "src/main.ts", line: 12, column: 3 },
    ]);
  });

  it("repère les chemins absolus, relatifs et avec tilde", () => {
    const paths = findFileLinks("/etc/hosts.conf ./a/b.rs:4 ~/notes.md ../x.toml").map((link) => link.path);
    expect(paths).toEqual(["/etc/hosts.conf", "./a/b.rs", "~/notes.md", "../x.toml"]);
  });

  it("ignore les URL et les numéros de version", () => {
    expect(findFileLinks("voir https://site.dev/app.js et v1.2.3 ou 10.0.1")).toEqual([]);
  });

  it("repère un fichier entre parenthèses ou guillemets", () => {
    expect(findFileLinks(`at fn (lib/x.js:7:9) "pkg.json"`).map((link) => link.path)).toEqual([
      "lib/x.js",
      "pkg.json",
    ]);
  });
});

describe("editorInvocation", () => {
  it("remplace les marqueurs sans couper un chemin contenant des espaces", () => {
    expect(editorInvocation("code -g {file}:{line}:{column}", "/home/jm/mes projets/a.ts", 12, undefined)).toEqual({
      program: "code",
      args: ["-g", "/home/jm/mes projets/a.ts:12:1"],
    });
  });

  it("ouvre VS Code à distance dans WSL quand le terminal tourne dans une distribution", () => {
    expect(editorInvocation("code -g {file}:{line}:{column}", "/home/jm/a.ts", 3, 1, "Ubuntu")).toEqual({
      program: "code",
      args: ["--remote", "wsl+Ubuntu", "-g", "/home/jm/a.ts:3:1"],
    });
  });

  it("ne touche pas aux éditeurs sans mode distant ni à un --remote déjà présent", () => {
    expect(editorInvocation("vim +{line} {file}", "/a.ts", 3, 1, "Ubuntu")?.args).toEqual(["+3", "/a.ts"]);
    expect(editorInvocation("code --remote ssh-remote+box -g {file}", "/a.ts", 1, 1, "Ubuntu")?.args).toEqual([
      "--remote",
      "ssh-remote+box",
      "-g",
      "/a.ts",
    ]);
  });

  it("refuse un modèle vide", () => {
    expect(editorInvocation("   ", "a.ts", 1, 1)).toBeUndefined();
  });
});
