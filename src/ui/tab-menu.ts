import { TAB_COLORS, type TabColor } from "../domain/workspace";

export type TabMenuActions = {
  readonly onRename: () => void;
  readonly onColor: (color: TabColor | undefined) => void;
  readonly onClose: () => void;
};

const COLOR_NAMES: Readonly<Record<TabColor, string>> = {
  cyan: "Cyan",
  magenta: "Magenta",
  blue: "Bleu",
  green: "Vert",
  yellow: "Jaune",
  red: "Rouge",
};

let openMenu: HTMLElement | undefined;

function closeMenu(): void {
  openMenu?.remove();
  openMenu = undefined;
}

function menuItem(label: string, run: () => void, className = "tab-menu__item"): HTMLButtonElement {
  const item = document.createElement("button");
  item.className = className;
  item.textContent = label;
  item.addEventListener("click", () => {
    closeMenu();
    run();
  });
  return item;
}

export function openTabMenu(x: number, y: number, current: TabColor | undefined, actions: TabMenuActions): void {
  closeMenu();
  const menu = document.createElement("div");
  menu.className = "tab-menu";
  menu.setAttribute("role", "menu");

  const swatches = document.createElement("div");
  swatches.className = "tab-menu__swatches";
  for (const color of TAB_COLORS) {
    const swatch = menuItem("", () => actions.onColor(color), `tab-menu__swatch tab-color--${color}`);
    swatch.title = COLOR_NAMES[color];
    swatch.setAttribute("aria-label", `Couleur ${COLOR_NAMES[color]}`);
    swatch.classList.toggle("tab-menu__swatch--current", color === current);
    swatches.append(swatch);
  }
  const reset = menuItem("∅", () => actions.onColor(undefined), "tab-menu__swatch tab-menu__swatch--reset");
  reset.title = "Couleur par défaut";
  reset.setAttribute("aria-label", "Couleur par défaut");
  swatches.append(reset);

  menu.append(
    menuItem("Renommer…", actions.onRename),
    swatches,
    menuItem("Fermer l'onglet", actions.onClose, "tab-menu__item tab-menu__item--danger"),
  );
  document.body.append(menu);
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, window.innerWidth - width - 8)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - height - 8)}px`;
  openMenu = menu;
  menu.querySelector("button")?.focus();

  const dismiss = (event: Event) => {
    if (event instanceof KeyboardEvent && event.key !== "Escape") return;
    if (event instanceof MouseEvent && menu.contains(event.target as Node)) return;
    closeMenu();
    document.removeEventListener("mousedown", dismiss, true);
    document.removeEventListener("keydown", dismiss, true);
  };
  document.addEventListener("mousedown", dismiss, true);
  document.addEventListener("keydown", dismiss, true);
}
