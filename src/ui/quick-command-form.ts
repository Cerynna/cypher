import {
  createQuickCommand,
  isQuickCommandMode,
  QUICK_COMMAND_MODE_LABELS,
  QUICK_COMMAND_MODES,
  type QuickCommand,
} from "../domain/quick-commands";
import { createEmojiPicker } from "./emoji-picker";
import { openOverlay } from "./overlay";

export type QuickCommandFields = {
  readonly element: HTMLElement;
  readonly read: () => QuickCommand | undefined;
};

function labelled(text: string, input: HTMLElement, kind: "text" | "toggle" | "select"): HTMLElement {
  const row = document.createElement(input instanceof HTMLInputElement || input instanceof HTMLSelectElement ? "label" : "div");
  row.className = `settings__row settings__row--${kind}`;
  const name = document.createElement("span");
  name.textContent = text;
  row.append(name, input);
  return row;
}

function textInput(value: string, placeholder: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.placeholder = placeholder;
  input.spellcheck = false;
  return input;
}

function modeSelect(initial: QuickCommand["mode"]): HTMLSelectElement {
  const select = document.createElement("select");
  for (const mode of QUICK_COMMAND_MODES) {
    select.add(new Option(QUICK_COMMAND_MODE_LABELS[mode], mode, false, mode === initial));
  }
  return select;
}

export function quickCommandFields(initial: QuickCommand | undefined): QuickCommandFields {
  const emoji = createEmojiPicker(initial?.emoji);
  const name = textInput(initial?.name ?? "", "ex. Login AWS (affiché au survol)");
  const command = textInput(initial?.command ?? "", "ex. aws sso login --profile dev");
  command.className = "quick-command-fields__command";
  const mode = modeSelect(initial?.mode ?? "run");
  const notify = document.createElement("input");
  notify.type = "checkbox";
  notify.checked = initial?.notify ?? false;
  const notifyRow = labelled("Notifier le résultat", notify, "toggle");

  const syncNotify = () => {
    const background = mode.value === "background";
    notifyRow.hidden = background || mode.value === "type";
  };
  mode.addEventListener("change", syncNotify);
  syncNotify();

  const element = document.createElement("div");
  element.className = "quick-command-fields";
  element.append(
    labelled("Emoji du bouton", emoji.element, "text"),
    labelled("Commande à exécuter", command, "text"),
    labelled("Nom (infobulle)", name, "text"),
    labelled("Lancer dans", mode, "select"),
    notifyRow,
  );
  return {
    element,
    read: () =>
      createQuickCommand({
        emoji: emoji.value(),
        name: name.value,
        command: command.value,
        mode: isQuickCommandMode(mode.value) ? mode.value : "run",
        notify: notify.checked,
      }),
  };
}

export function openQuickCommandForm(onCreate: (quickCommand: QuickCommand) => void, onClose: () => void): void {
  let created: QuickCommand | undefined;
  const overlay = openOverlay(
    "Nouvelle commande rapide",
    () => {
      onClose();
      if (created) onCreate(created);
    },
    "overlay__panel--settings",
  );
  const fields = quickCommandFields(undefined);
  const error = document.createElement("p");
  error.className = "settings__error";
  const save = document.createElement("button");
  save.className = "button--primary";
  save.textContent = "Créer";
  const submit = () => {
    created = fields.read();
    if (!created) {
      error.textContent = "Le nom et la commande sont obligatoires.";
      return;
    }
    overlay.close();
  };
  save.addEventListener("click", submit);
  fields.element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      submit();
    }
  });
  const actions = document.createElement("div");
  actions.className = "settings__actions";
  actions.append(save);
  overlay.body.append(fields.element, error, actions);
  fields.element.querySelector("input")?.focus();
}
