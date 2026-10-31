import { rankByFuzzy } from "../domain/fuzzy";
import { openOverlay } from "./overlay";

export type PaletteCommand = {
  readonly label: string;
  readonly hint: string;
  readonly run: () => void;
  readonly runAlternate?: () => void;
};

export type PaletteOptions = { readonly title: string; readonly placeholder: string; readonly footer?: string };

const COMMAND_PALETTE: PaletteOptions = { title: "Palette de commandes", placeholder: "Tapez une commande…" };

export function openCommandPalette(
  commands: readonly PaletteCommand[],
  onClose: () => void,
  options: PaletteOptions = COMMAND_PALETTE,
): void {
  let chosen: (() => void) | undefined;
  const overlay = openOverlay(
    options.title,
    () => {
      onClose();
      chosen?.();
    },
    "overlay__panel--palette",
  );
  const input = document.createElement("input");
  input.className = "palette__input";
  input.placeholder = options.placeholder;
  input.setAttribute("aria-label", options.placeholder);
  const list = document.createElement("ul");
  list.className = "palette__list";
  list.setAttribute("role", "listbox");
  overlay.body.append(input, list);
  if (options.footer) {
    const footer = document.createElement("p");
    footer.className = "palette__footer";
    footer.textContent = options.footer;
    overlay.body.append(footer);
  }

  let visible: readonly PaletteCommand[] = commands;
  let selected = 0;

  const run = (command: PaletteCommand | undefined, alternate = false) => {
    if (!command) return;
    chosen = alternate && command.runAlternate ? command.runAlternate : command.run;
    overlay.close();
  };

  const render = () => {
    list.replaceChildren(
      ...visible.map((command, index) => {
        const item = document.createElement("li");
        item.className = "palette__item";
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(index === selected));
        const label = document.createElement("span");
        label.textContent = command.label;
        const hint = document.createElement("kbd");
        hint.textContent = command.hint;
        item.append(label, hint);
        item.addEventListener("mousedown", (event) => {
          event.preventDefault();
          run(command, event.shiftKey);
        });
        return item;
      }),
    );
    list.children[selected]?.scrollIntoView({ block: "nearest" });
  };

  input.addEventListener("input", () => {
    visible = rankByFuzzy(input.value, commands, (command) => command.label);
    selected = 0;
    render();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      selected = (selected + step + visible.length) % Math.max(visible.length, 1);
      render();
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(visible[selected], event.shiftKey);
    }
  });
  render();
  input.focus();
}
