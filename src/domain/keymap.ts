import { type ActionId, isActionId } from "./actions";

export type KeyStroke = {
  readonly key: string;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
};

export type Chord = {
  readonly key: string;
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly meta: boolean;
};

export const UNBOUND = "none";

const KEY_ALIASES: Readonly<Record<string, string>> = {
  plus: "+",
  minus: "-",
  equal: "=",
  comma: ",",
  period: ".",
  backquote: "`",
  space: " ",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  esc: "escape",
  return: "enter",
};

const MODIFIERS = new Set(["ctrl", "control", "shift", "alt", "option", "meta", "cmd", "super"]);

export const DEFAULT_BINDINGS: Readonly<Record<string, ActionId>> = {
  "ctrl+c": "copyOrInterrupt",
  "ctrl+shift+c": "copy",
  "meta+c": "copy",
  "ctrl+v": "paste",
  "ctrl+shift+v": "paste",
  "meta+v": "paste",
  "ctrl+shift+f": "find",
  "meta+f": "find",
  "ctrl+equal": "zoomIn",
  "ctrl+plus": "zoomIn",
  "meta+equal": "zoomIn",
  "ctrl+minus": "zoomOut",
  "meta+minus": "zoomOut",
  "ctrl+0": "zoomReset",
  "meta+0": "zoomReset",
  "ctrl+shift+t": "newTab",
  "meta+t": "newTab",
  "ctrl+shift+r": "renameTab",
  "ctrl+shift+w": "closePane",
  "meta+w": "closePane",
  "ctrl+tab": "nextTab",
  "ctrl+pagedown": "nextTab",
  "ctrl+shift+tab": "previousTab",
  "ctrl+pageup": "previousTab",
  "ctrl+shift+d": "splitRight",
  "ctrl+shift+e": "splitDown",
  "ctrl+alt+left": "focusLeft",
  "ctrl+alt+right": "focusRight",
  "ctrl+alt+up": "focusUp",
  "ctrl+alt+down": "focusDown",
  "ctrl+shift+up": "previousCommand",
  "ctrl+shift+down": "nextCommand",
  "ctrl+shift+o": "copyLastOutput",
  "ctrl+shift+h": "toggleClipboardHistory",
  "ctrl+shift+p": "commandPalette",
  "meta+shift+p": "commandPalette",
  "f11": "toggleFullscreen",
  "ctrl+comma": "settings",
  "meta+comma": "settings",
  "ctrl+shift+a": "aiCommand",
  "ctrl+shift+x": "aiExplain",
};

function normalizeKey(name: string): string {
  const lower = name.toLowerCase();
  return KEY_ALIASES[lower] ?? lower;
}

export function parseChord(text: string): Chord | undefined {
  const parts = text.toLowerCase().split("+").map((part) => part.trim());
  const keyParts = parts.filter((part) => !MODIFIERS.has(part));
  if (keyParts.length !== 1 || keyParts[0] === "") return undefined;
  return {
    key: normalizeKey(keyParts[0]),
    ctrl: parts.includes("ctrl") || parts.includes("control"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt") || parts.includes("option"),
    meta: parts.includes("meta") || parts.includes("cmd") || parts.includes("super"),
  };
}

const KEY_LABELS: Readonly<Record<string, string>> = {
  " ": "Espace",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  pageup: "PgPréc",
  pagedown: "PgSuiv",
  tab: "Tab",
  enter: "Entrée",
  escape: "Échap",
  backspace: "Retour",
  delete: "Suppr",
};

export function formatChord(chord: Chord): string {
  const modifiers = [chord.ctrl && "Ctrl", chord.alt && "Alt", chord.shift && "Maj", chord.meta && "Meta"];
  const key = KEY_LABELS[chord.key] ?? (chord.key.length === 1 ? chord.key.toUpperCase() : chord.key);
  return [...modifiers.filter(Boolean), key].join("+");
}

function chordId(chord: Chord): string {
  return [chord.ctrl, chord.shift, chord.alt, chord.meta, chord.key].join("|");
}

function isSymbol(key: string): boolean {
  return key.length === 1 && !/[\p{L}\p{N}]/u.test(key);
}

function keyFromCode(code: string): string | undefined {
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (digit) return digit[1];
  if (code === "NumpadAdd") return "+";
  if (code === "NumpadSubtract") return "-";
  return undefined;
}

function matches(chord: Chord, stroke: KeyStroke): boolean {
  const ignoreShift = isSymbol(chord.key) && !chord.shift;
  if (chord.ctrl !== stroke.ctrlKey || chord.alt !== stroke.altKey || chord.meta !== stroke.metaKey) return false;
  if (!ignoreShift && chord.shift !== stroke.shiftKey) return false;
  return normalizeKey(stroke.key) === chord.key || keyFromCode(stroke.code) === chord.key;
}

type Binding = { readonly chord: Chord; readonly action: ActionId };

export class Keymap {
  private constructor(
    private readonly bindings: readonly Binding[],
    readonly problems: readonly string[],
  ) {}

  static create(overrides: Readonly<Record<string, string>> = {}): Keymap {
    const problems: string[] = [];
    const byChord = new Map<string, Binding>();
    const assign = (text: string, action: string, source: string) => {
      const chord = parseChord(text);
      if (!chord) return problems.push(`raccourci invalide « ${text} » (${source})`);
      const id = chordId(chord);
      if (action === UNBOUND) return byChord.delete(id);
      if (!isActionId(action)) return problems.push(`action inconnue « ${action} » pour ${text}`);
      byChord.set(id, { chord, action });
    };
    for (const [text, action] of Object.entries(DEFAULT_BINDINGS)) assign(text, action, "défaut");
    for (const [text, action] of Object.entries(overrides)) assign(text, action, "config");
    return new Keymap([...byChord.values()], problems);
  }

  resolve(stroke: KeyStroke): ActionId | undefined {
    return this.bindings.find((binding) => matches(binding.chord, stroke))?.action;
  }

  chordsFor(action: ActionId): readonly Chord[] {
    return this.bindings.filter((binding) => binding.action === action).map((binding) => binding.chord);
  }
}
