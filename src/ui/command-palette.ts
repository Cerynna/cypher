import { rankByFuzzy } from "../domain/fuzzy";
import { openOverlay } from "./overlay";

export type PaletteCommand = { readonly label: string; readonly hint: string; readonly run: () => void };

export function openCommandPalette(commands: readonly PaletteCommand[], onClose: () => void): void {
  let chosen: PaletteCommand | undefined;
  const overlay = openOverlay(
    "Palette de commandes",
    () => {
      onClose();
      chosen?.run();
    },
    "overlay__panel--palette",
  );
  const input = document.createElement("input");
  input.className = "palette__input";
  input.placeholder = "Tapez une commande…";
  input.setAttribute("aria-label", "Rechercher une commande");
  const list = document.createElement("ul");
  list.className = "palette__list";
  list.setAttribute("role", "listbox");
  overlay.body.append(input, list);

  let visible: readonly PaletteCommand[] = commands;
  let selected = 0;

  const run = (command: PaletteCommand | undefined) => {
    if (!command) return;
    chosen = command;
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
          run(command);
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
      run(visible[selected]);
    }
  });
  render();
  input.focus();
}
