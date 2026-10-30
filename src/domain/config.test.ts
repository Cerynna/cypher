import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, parseConfig, serializeConfig } from "./config";
import { resolveTheme, THEMES, withOpacity } from "./themes";

describe("parseConfig", () => {
  it("donne la config par défaut pour un fichier vide ou absent", () => {
    expect(parseConfig(undefined)).toEqual({ config: DEFAULT_CONFIG, problems: [] });
    expect(parseConfig({}).config).toEqual(DEFAULT_CONFIG);
  });

  it("lit les valeurs valides", () => {
    const { config, problems } = parseConfig({
      font: { size: 18, family: "JetBrains Mono" },
      theme: { dark: "synthwave", follow_system: true },
      terminal: { cursor_style: "block", opacity: 0.85, scanlines: false },
      shell: { program: "bash", args: ["--login"], wsl: "Debian" },
      keybindings: { "alt+t": "newTab" },
    });
    expect(problems).toEqual([]);
    expect(config.font).toEqual({ family: "JetBrains Mono", size: 18, lineHeight: 1.15 });
    expect(config.theme.dark).toBe("synthwave");
    expect(config.terminal.cursorStyle).toBe("block");
    expect(config.terminal.scanlines).toBe(false);
    expect(config.shell.args).toEqual(["--login"]);
    expect(config.shell.wsl).toBe("Debian");
    expect(config.keybindings).toEqual({ "alt+t": "newTab" });
  });

  it("garde la valeur par défaut et signale chaque champ invalide", () => {
    const { config, problems } = parseConfig({
      font: { size: 300 },
      theme: { dark: "inconnu" },
      terminal: { cursor_style: "triangle", blur: "oui" },
      editor: { command: "code" },
      shell: { wsl: "Ubuntu; rm -rf /" },
      quake: "oui",
    });
    expect(config.font.size).toBe(DEFAULT_CONFIG.font.size);
    expect(config.theme.dark).toBe("abyss");
    expect(config.terminal.cursorStyle).toBe("bar");
    expect(config.editor.command).toBe(DEFAULT_CONFIG.editor.command);
    expect(config.shell.wsl).toBe("auto");
    expect(problems).toHaveLength(7);
  });

  it("se relit à l'identique après sérialisation", () => {
    const { config } = parseConfig({ font: { size: 20 }, keybindings: { "alt+w": "closePane" } });
    expect(parseConfig(serializeConfig(config))).toEqual({ config, problems: [] });
  });
});

describe("thèmes", () => {
  it("suit le thème clair du système quand c'est demandé", () => {
    const preference = { dark: "neon", light: "neon-day", followSystem: true };
    expect(resolveTheme(preference, false)).toBe(THEMES["neon-day"]);
    expect(resolveTheme(preference, true)).toBe(THEMES.neon);
    expect(resolveTheme({ ...preference, followSystem: false }, false)).toBe(THEMES.neon);
  });

  it("ajoute un canal alpha aux couleurs quand l'opacité est réduite", () => {
    expect(withOpacity("#07060d", 1)).toBe("#07060d");
    expect(withOpacity("#07060d", 0.5)).toBe("#07060d80");
  });
});
