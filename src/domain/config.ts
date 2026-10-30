import { FontSize } from "./font-size";
import {
  createQuickCommand,
  isQuickCommandMode,
  isTabPosition,
  legacyMode,
  type QuickCommand,
  type QuickCommandMode,
  type TabPosition,
} from "./quick-commands";
import { type ThemePreference, isThemeName } from "./themes";

export type CursorStyle = "bar" | "block" | "underline";

const CURSOR_STYLES: readonly CursorStyle[] = ["bar", "block", "underline"];

export type Config = {
  readonly font: { readonly family: string; readonly size: number; readonly lineHeight: number };
  readonly theme: ThemePreference;
  readonly terminal: {
    readonly scrollback: number;
    readonly cursorStyle: CursorStyle;
    readonly cursorBlink: boolean;
    readonly copyOnSelect: boolean;
    readonly opacity: number;
    readonly blur: boolean;
    readonly scanlines: boolean;
  };
  readonly shell: { readonly program: string; readonly args: readonly string[]; readonly wsl: string };
  readonly editor: { readonly command: string };
  readonly notifications: { readonly longCommandSeconds: number };
  readonly keybindings: Readonly<Record<string, string>>;
  readonly ai: { readonly enabled: boolean; readonly model: string };
  readonly quake: { readonly enabled: boolean; readonly shortcut: string };
  readonly tabs: { readonly position: TabPosition };
  readonly commands: readonly QuickCommand[];
};

export const DEFAULT_CONFIG: Config = {
  font: { family: "Kode Mono Variable", size: FontSize.DEFAULT, lineHeight: 1.15 },
  theme: { dark: "abyss", light: "neon-day", followSystem: false },
  terminal: {
    scrollback: 10_000,
    cursorStyle: "bar",
    cursorBlink: true,
    copyOnSelect: false,
    opacity: 1,
    blur: false,
    scanlines: true,
  },
  shell: { program: "", args: [], wsl: "auto" },
  editor: { command: "code -g {file}:{line}:{column}" },
  notifications: { longCommandSeconds: 10 },
  keybindings: {},
  ai: { enabled: false, model: "claude-opus-5-5" },
  quake: { enabled: false, shortcut: "Control+Backquote" },
  tabs: { position: "top" },
  commands: [],
};

export type ParsedConfig = { readonly config: Config; readonly problems: readonly string[] };

type RawTable = Readonly<Record<string, unknown>>;

function isTable(value: unknown): value is RawTable {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class FieldReader {
  readonly problems: string[] = [];

  table(raw: RawTable, key: string): RawTable {
    const value = raw[key];
    if (value === undefined) return {};
    if (isTable(value)) return value;
    this.problems.push(`[${key}] doit être une table`);
    return {};
  }

  number(table: RawTable, path: string, fallback: number, min: number, max: number): number {
    const value = table[path.split(".").at(-1)!];
    if (value === undefined) return fallback;
    if (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max) return value;
    this.problems.push(`${path} doit être un nombre entre ${min} et ${max}`);
    return fallback;
  }

  boolean(table: RawTable, path: string, fallback: boolean): boolean {
    const value = table[path.split(".").at(-1)!];
    if (value === undefined) return fallback;
    if (typeof value === "boolean") return value;
    this.problems.push(`${path} doit valoir true ou false`);
    return fallback;
  }

  string(table: RawTable, path: string, fallback: string, accept: (value: string) => boolean = () => true): string {
    const value = table[path.split(".").at(-1)!];
    if (value === undefined) return fallback;
    if (typeof value === "string" && accept(value)) return value;
    this.problems.push(`${path} a une valeur invalide`);
    return fallback;
  }

  strings(table: RawTable, path: string, fallback: readonly string[]): readonly string[] {
    const value = table[path.split(".").at(-1)!];
    if (value === undefined) return fallback;
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;
    this.problems.push(`${path} doit être une liste de chaînes`);
    return fallback;
  }

  quickCommands(raw: unknown): readonly QuickCommand[] {
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
      this.problems.push("[[commands]] doit être une liste de tables");
      return [];
    }
    return raw.flatMap((entry, index): QuickCommand[] => {
      const table = isTable(entry) ? entry : {};
      const path = `commands[${index + 1}]`;
      const fallbackMode = legacyMode(
        this.boolean(table, `${path}.execute`, true),
        this.boolean(table, `${path}.new_tab`, false),
      );
      const quickCommand = createQuickCommand({
        emoji: this.string(table, `${path}.emoji`, ""),
        name: this.string(table, `${path}.name`, ""),
        command: this.string(table, `${path}.command`, ""),
        mode: this.string(table, `${path}.mode`, fallbackMode, isQuickCommandMode) as QuickCommandMode,
        notify: this.boolean(table, `${path}.notify`, false),
      });
      if (!quickCommand) this.problems.push(`${path} doit avoir un name et une command non vides`);
      return quickCommand ? [quickCommand] : [];
    });
  }

  stringRecord(table: RawTable, path: string): Readonly<Record<string, string>> {
    const entries = Object.entries(table).filter(([key, value]) => {
      if (typeof value === "string") return true;
      this.problems.push(`${path}."${key}" doit être une chaîne`);
      return false;
    });
    return Object.fromEntries(entries) as Record<string, string>;
  }
}

export function parseConfig(raw: unknown): ParsedConfig {
  const read = new FieldReader();
  const root = isTable(raw) ? raw : {};
  const defaults = DEFAULT_CONFIG;
  const font = read.table(root, "font");
  const theme = read.table(root, "theme");
  const terminal = read.table(root, "terminal");
  const shell = read.table(root, "shell");
  const editor = read.table(root, "editor");
  const notifications = read.table(root, "notifications");
  const ai = read.table(root, "ai");
  const quake = read.table(root, "quake");
  const tabs = read.table(root, "tabs");

  const config: Config = {
    font: {
      family: read.string(font, "font.family", defaults.font.family, (value) => value.trim() !== ""),
      size: read.number(font, "font.size", defaults.font.size, FontSize.MIN, FontSize.MAX),
      lineHeight: read.number(font, "font.line_height", defaults.font.lineHeight, 1, 2),
    },
    theme: {
      dark: read.string(theme, "theme.dark", defaults.theme.dark, isThemeName),
      light: read.string(theme, "theme.light", defaults.theme.light, isThemeName),
      followSystem: read.boolean(theme, "theme.follow_system", defaults.theme.followSystem),
    },
    terminal: {
      scrollback: read.number(terminal, "terminal.scrollback", defaults.terminal.scrollback, 0, 1_000_000),
      cursorStyle: read.string(terminal, "terminal.cursor_style", defaults.terminal.cursorStyle, (value) =>
        CURSOR_STYLES.includes(value as CursorStyle),
      ) as CursorStyle,
      cursorBlink: read.boolean(terminal, "terminal.cursor_blink", defaults.terminal.cursorBlink),
      copyOnSelect: read.boolean(terminal, "terminal.copy_on_select", defaults.terminal.copyOnSelect),
      opacity: read.number(terminal, "terminal.opacity", defaults.terminal.opacity, 0.3, 1),
      blur: read.boolean(terminal, "terminal.blur", defaults.terminal.blur),
      scanlines: read.boolean(terminal, "terminal.scanlines", defaults.terminal.scanlines),
    },
    shell: {
      program: read.string(shell, "shell.program", defaults.shell.program),
      args: read.strings(shell, "shell.args", defaults.shell.args),
      wsl: read.string(shell, "shell.wsl", defaults.shell.wsl, (value) => /^[\w.-]+$/.test(value)),
    },
    editor: {
      command: read.string(editor, "editor.command", defaults.editor.command, (value) => value.includes("{file}")),
    },
    notifications: {
      longCommandSeconds: read.number(
        notifications,
        "notifications.long_command_seconds",
        defaults.notifications.longCommandSeconds,
        0,
        86_400,
      ),
    },
    keybindings: read.stringRecord(read.table(root, "keybindings"), "keybindings"),
    ai: {
      enabled: read.boolean(ai, "ai.enabled", defaults.ai.enabled),
      model: read.string(ai, "ai.model", defaults.ai.model, (value) => value.trim() !== ""),
    },
    quake: {
      enabled: read.boolean(quake, "quake.enabled", defaults.quake.enabled),
      shortcut: read.string(quake, "quake.shortcut", defaults.quake.shortcut, (value) => value.trim() !== ""),
    },
    tabs: {
      position: read.string(tabs, "tabs.position", defaults.tabs.position, isTabPosition) as TabPosition,
    },
    commands: read.quickCommands(root.commands),
  };
  return { config, problems: read.problems };
}

export function serializeConfig(config: Config): Record<string, unknown> {
  return {
    font: { family: config.font.family, size: config.font.size, line_height: config.font.lineHeight },
    theme: { dark: config.theme.dark, light: config.theme.light, follow_system: config.theme.followSystem },
    terminal: {
      scrollback: config.terminal.scrollback,
      cursor_style: config.terminal.cursorStyle,
      cursor_blink: config.terminal.cursorBlink,
      copy_on_select: config.terminal.copyOnSelect,
      opacity: config.terminal.opacity,
      blur: config.terminal.blur,
      scanlines: config.terminal.scanlines,
    },
    shell: { program: config.shell.program, args: [...config.shell.args], wsl: config.shell.wsl },
    editor: { command: config.editor.command },
    notifications: { long_command_seconds: config.notifications.longCommandSeconds },
    ai: { enabled: config.ai.enabled, model: config.ai.model },
    quake: { enabled: config.quake.enabled, shortcut: config.quake.shortcut },
    tabs: { position: config.tabs.position },
    keybindings: { ...config.keybindings },
    commands: config.commands.map((quickCommand) => ({
      emoji: quickCommand.emoji,
      name: quickCommand.name,
      command: quickCommand.command,
      mode: quickCommand.mode,
      notify: quickCommand.notify,
    })),
  };
}
