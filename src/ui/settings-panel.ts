import type { Config, CursorStyle } from "../domain/config";
import { type QuickCommand, TAB_POSITIONS, type TabPosition } from "../domain/quick-commands";
import { THEME_NAMES, THEMES } from "../domain/themes";
import { openOverlay } from "./overlay";
import { quickCommandFields } from "./quick-command-form";

type Field =
  | {
      readonly kind: "text";
      readonly label: string;
      readonly read: (config: Config) => string;
      readonly write: (config: Config, value: string) => Config;
    }
  | {
      readonly kind: "number";
      readonly label: string;
      readonly min: number;
      readonly max: number;
      readonly step: number;
      readonly read: (config: Config) => number;
      readonly write: (config: Config, value: number) => Config;
    }
  | {
      readonly kind: "toggle";
      readonly label: string;
      readonly read: (config: Config) => boolean;
      readonly write: (config: Config, value: boolean) => Config;
    }
  | {
      readonly kind: "select";
      readonly label: string;
      readonly options: readonly string[];
      readonly optionLabel?: (value: string) => string;
      readonly read: (config: Config) => string;
      readonly write: (config: Config, value: string) => Config;
    };

const themeLabel = (name: string): string => THEMES[name]?.label ?? name;

type Section = { readonly title: string; readonly fields: readonly Field[] };

const SECTIONS: readonly Section[] = [
  {
    title: "Disposition",
    fields: [
      { kind: "select", label: "Position des onglets", options: TAB_POSITIONS, read: (c) => c.tabs.position, write: (c, v) => ({ ...c, tabs: { position: v as TabPosition } }) },
    ],
  },
  {
    title: "Police",
    fields: [
      { kind: "text", label: "Famille", read: (c) => c.font.family, write: (c, v) => ({ ...c, font: { ...c.font, family: v } }) },
      { kind: "number", label: "Taille", min: 8, max: 40, step: 1, read: (c) => c.font.size, write: (c, v) => ({ ...c, font: { ...c.font, size: v } }) },
      { kind: "number", label: "Interligne", min: 1, max: 2, step: 0.05, read: (c) => c.font.lineHeight, write: (c, v) => ({ ...c, font: { ...c.font, lineHeight: v } }) },
    ],
  },
  {
    title: "Thème",
    fields: [
      { kind: "select", label: "Thème sombre", options: THEME_NAMES, optionLabel: themeLabel, read: (c) => c.theme.dark, write: (c, v) => ({ ...c, theme: { ...c.theme, dark: v } }) },
      { kind: "select", label: "Thème clair", options: THEME_NAMES, optionLabel: themeLabel, read: (c) => c.theme.light, write: (c, v) => ({ ...c, theme: { ...c.theme, light: v } }) },
      { kind: "toggle", label: "Suivre le thème du système", read: (c) => c.theme.followSystem, write: (c, v) => ({ ...c, theme: { ...c.theme, followSystem: v } }) },
      { kind: "number", label: "Opacité de la fenêtre", min: 0.3, max: 1, step: 0.05, read: (c) => c.terminal.opacity, write: (c, v) => ({ ...c, terminal: { ...c.terminal, opacity: v } }) },
      { kind: "toggle", label: "Effet scanlines (lignes d'écran cathodique)", read: (c) => c.terminal.scanlines, write: (c, v) => ({ ...c, terminal: { ...c.terminal, scanlines: v } }) },
      { kind: "toggle", label: "Flou d'arrière-plan (Windows, macOS)", read: (c) => c.terminal.blur, write: (c, v) => ({ ...c, terminal: { ...c.terminal, blur: v } }) },
    ],
  },
  {
    title: "Terminal",
    fields: [
      { kind: "select", label: "Curseur", options: ["bar", "block", "underline"], read: (c) => c.terminal.cursorStyle, write: (c, v) => ({ ...c, terminal: { ...c.terminal, cursorStyle: v as CursorStyle } }) },
      { kind: "toggle", label: "Curseur clignotant", read: (c) => c.terminal.cursorBlink, write: (c, v) => ({ ...c, terminal: { ...c.terminal, cursorBlink: v } }) },
      { kind: "toggle", label: "Copier à la sélection", read: (c) => c.terminal.copyOnSelect, write: (c, v) => ({ ...c, terminal: { ...c.terminal, copyOnSelect: v } }) },
      { kind: "number", label: "Historique (lignes)", min: 0, max: 1_000_000, step: 1000, read: (c) => c.terminal.scrollback, write: (c, v) => ({ ...c, terminal: { ...c.terminal, scrollback: v } }) },
      { kind: "number", label: "Notifier les commandes de plus de (s, 0 = jamais)", min: 0, max: 86_400, step: 1, read: (c) => c.notifications.longCommandSeconds, write: (c, v) => ({ ...c, notifications: { longCommandSeconds: v } }) },
    ],
  },
  {
    title: "Shell et éditeur",
    fields: [
      { kind: "text", label: "Shell (vide = automatique)", read: (c) => c.shell.program, write: (c, v) => ({ ...c, shell: { ...c.shell, program: v.trim() } }) },
      { kind: "text", label: "Arguments du shell", read: (c) => c.shell.args.join(" "), write: (c, v) => ({ ...c, shell: { ...c.shell, args: v.split(/\s+/).filter(Boolean) } }) },
      { kind: "text", label: "Commande de l'éditeur", read: (c) => c.editor.command, write: (c, v) => ({ ...c, editor: { command: v } }) },
    ],
  },
  {
    title: "IA et mode Quake",
    fields: [
      { kind: "toggle", label: "Activer l'assistant IA", read: (c) => c.ai.enabled, write: (c, v) => ({ ...c, ai: { ...c.ai, enabled: v } }) },
      { kind: "text", label: "Modèle Claude", read: (c) => c.ai.model, write: (c, v) => ({ ...c, ai: { ...c.ai, model: v.trim() } }) },
      { kind: "toggle", label: "Mode Quake (raccourci global)", read: (c) => c.quake.enabled, write: (c, v) => ({ ...c, quake: { ...c.quake, enabled: v } }) },
      { kind: "text", label: "Raccourci Quake", read: (c) => c.quake.shortcut, write: (c, v) => ({ ...c, quake: { ...c.quake, shortcut: v.trim() } }) },
    ],
  },
];

function fieldInput(field: Field, config: Config, update: (next: (config: Config) => Config) => void): HTMLElement {
  if (field.kind === "select") {
    const select = document.createElement("select");
    for (const option of field.options) {
      const text = field.optionLabel?.(option) ?? option;
      select.add(new Option(text, option, false, option === field.read(config)));
    }
    select.addEventListener("change", () => update((current) => field.write(current, select.value)));
    return select;
  }
  const input = document.createElement("input");
  if (field.kind === "toggle") {
    input.type = "checkbox";
    input.checked = field.read(config);
    input.addEventListener("change", () => update((current) => field.write(current, input.checked)));
  } else if (field.kind === "number") {
    input.type = "number";
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    input.value = String(field.read(config));
    input.addEventListener("change", () => {
      const value = Math.min(field.max, Math.max(field.min, Number(input.value)));
      if (Number.isFinite(value)) update((current) => field.write(current, value));
    });
  } else {
    input.type = "text";
    input.value = field.read(config);
    input.spellcheck = false;
    input.addEventListener("change", () => update((current) => field.write(current, input.value)));
  }
  return input;
}

function quickCommandsSection(
  initial: readonly QuickCommand[],
  onChange: (commands: readonly QuickCommand[]) => void,
): HTMLFieldSetElement {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Commandes rapides";
  const list = document.createElement("div");
  list.className = "quick-command-list";
  const entries: { readonly read: () => QuickCommand | undefined; readonly element: HTMLElement }[] = [];

  const publish = () => onChange(entries.flatMap((entry) => entry.read() ?? []));
  const addEntry = (quickCommand: QuickCommand | undefined) => {
    const fields = quickCommandFields(quickCommand);
    const card = document.createElement("div");
    card.className = "quick-command-card";
    const remove = document.createElement("button");
    remove.className = "quick-command-card__remove";
    remove.textContent = "Supprimer";
    const entry = { read: fields.read, element: card };
    remove.addEventListener("click", () => {
      entries.splice(entries.indexOf(entry), 1);
      card.remove();
      publish();
    });
    card.append(fields.element, remove);
    card.addEventListener("change", publish);
    entries.push(entry);
    list.append(card);
  };

  for (const quickCommand of initial) addEntry(quickCommand);
  const add = document.createElement("button");
  add.textContent = "+ Ajouter une commande";
  add.addEventListener("click", () => {
    addEntry(undefined);
    list.lastElementChild?.querySelector("input")?.focus();
  });
  fieldset.append(legend, list, add);
  return fieldset;
}

export type SettingsActions = {
  readonly onSave: (config: Config) => Promise<void>;
  readonly onPreview: (config: Config) => void;
  readonly onOpenFile: () => void;
  readonly onClose: () => void;
};

export function openSettings(config: Config, configPath: string, actions: SettingsActions): void {
  let draft = config;
  let saved = false;
  const overlay = openOverlay(
    "Réglages",
    () => {
      if (!saved && draft !== config) actions.onPreview(config);
      actions.onClose();
    },
    "overlay__panel--settings",
  );
  const update = (next: (current: Config) => Config) => {
    draft = next(draft);
    actions.onPreview(draft);
  };

  const sections = SECTIONS.map((section) => {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = section.title;
    fieldset.append(legend);
    for (const field of section.fields) {
      const row = document.createElement("label");
      row.className = `settings__row settings__row--${field.kind}`;
      const name = document.createElement("span");
      name.textContent = field.label;
      row.append(name, fieldInput(field, config, update));
      fieldset.append(row);
    }
    return fieldset;
  });

  sections.push(
    quickCommandsSection(config.commands, (commands) => update((current) => ({ ...current, commands }))),
  );

  const path = document.createElement("p");
  path.className = "settings__path";
  path.textContent = `${configPath} — raccourcis dans [keybindings]`;

  const footer = document.createElement("div");
  footer.className = "settings__actions";
  const openFile = document.createElement("button");
  openFile.textContent = "Ouvrir config.toml";
  openFile.addEventListener("click", () => {
    overlay.close();
    actions.onOpenFile();
  });
  const save = document.createElement("button");
  save.className = "button--primary";
  save.textContent = "Enregistrer";
  save.addEventListener("click", () => {
    saved = true;
    void actions.onSave(draft).then(() => overlay.close());
  });
  footer.append(openFile, save);

  overlay.body.append(...sections, path, footer);
  overlay.body.querySelector<HTMLElement>("input, select")?.focus();
}
