import { EMOJI_CATEGORIES, type EmojiEntry, searchEmojis } from "../domain/emoji-catalog";
import { DEFAULT_EMOJI } from "../domain/quick-commands";

export type EmojiPicker = {
  readonly element: HTMLElement;
  readonly value: () => string;
};

const GRID_COLUMNS = 8;
const POPOVER_GAP = 6;

function emojiButton(candidate: EmojiEntry, choose: (emoji: string) => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "emoji-picker__emoji";
  button.textContent = candidate.emoji;
  button.title = candidate.keywords.split(" ").slice(0, 3).join(" · ");
  button.setAttribute("aria-label", candidate.keywords.split(" ")[0] || candidate.emoji);
  button.addEventListener("click", () => choose(candidate.emoji));
  return button;
}

function moveFocus(grid: HTMLElement, current: HTMLElement, key: string): boolean {
  const buttons = [...grid.querySelectorAll<HTMLButtonElement>(".emoji-picker__emoji")];
  const index = buttons.indexOf(current as HTMLButtonElement);
  if (index === -1) return false;
  const offset = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: GRID_COLUMNS, ArrowUp: -GRID_COLUMNS }[key];
  if (offset === undefined) return false;
  buttons[Math.min(buttons.length - 1, Math.max(0, index + offset))]?.focus();
  return true;
}

export function createEmojiPicker(initial: string | undefined): EmojiPicker {
  let selected = initial ?? DEFAULT_EMOJI;

  const element = document.createElement("div");
  element.className = "emoji-picker";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "emoji-picker__trigger";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  trigger.title = "Choisir un emoji";

  const popover = document.createElement("div");
  popover.className = "emoji-picker__popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", "Choisir un emoji");
  popover.hidden = true;
  const search = document.createElement("input");
  search.type = "text";
  search.className = "emoji-picker__search";
  search.placeholder = "Rechercher (fusée, docker, test…) ou coller un emoji";
  search.setAttribute("aria-label", "Rechercher un emoji");
  const grid = document.createElement("div");
  grid.className = "emoji-picker__grid";
  popover.append(search, grid);
  element.append(trigger);

  const renderTrigger = () => {
    trigger.textContent = selected;
    trigger.setAttribute("aria-label", `Emoji du bouton : ${selected}, cliquer pour changer`);
  };

  const place = () => {
    const anchor = trigger.getBoundingClientRect();
    const { width, height } = popover.getBoundingClientRect();
    const below = anchor.bottom + POPOVER_GAP;
    const top = below + height <= window.innerHeight ? below : Math.max(POPOVER_GAP, anchor.top - POPOVER_GAP - height);
    const left = Math.min(anchor.left, window.innerWidth - width - POPOVER_GAP);
    popover.style.top = `${top}px`;
    popover.style.left = `${Math.max(POPOVER_GAP, left)}px`;
  };

  const close = (focusTrigger: boolean) => {
    popover.hidden = true;
    popover.remove();
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", onOutsideClick, true);
    if (focusTrigger) trigger.focus();
  };

  const choose = (emoji: string) => {
    selected = emoji;
    renderTrigger();
    element.dispatchEvent(new Event("change", { bubbles: true }));
    close(true);
  };

  const renderGrid = () => {
    const query = search.value;
    if (query.trim() === "") {
      grid.replaceChildren(
        ...EMOJI_CATEGORIES.flatMap((category) => {
          const title = document.createElement("p");
          title.className = "emoji-picker__category";
          title.textContent = category.name;
          return [title, ...category.entries.map((candidate) => emojiButton(candidate, choose))];
        }),
      );
      return;
    }
    const results = searchEmojis(query);
    if (results.length === 0) {
      const empty = document.createElement("p");
      empty.className = "emoji-picker__empty";
      empty.textContent = "Aucun emoji trouvé. Colle-le directement ici.";
      grid.replaceChildren(empty);
      return;
    }
    grid.replaceChildren(...results.map((candidate) => emojiButton(candidate, choose)));
  };

  const onOutsideClick = (event: MouseEvent) => {
    const target = event.target as Node;
    if (!element.contains(target) && !popover.contains(target)) close(false);
  };

  const open = () => {
    search.value = "";
    renderGrid();
    document.body.append(popover);
    popover.hidden = false;
    place();
    trigger.setAttribute("aria-expanded", "true");
    document.addEventListener("mousedown", onOutsideClick, true);
    search.focus();
  };

  trigger.addEventListener("click", () => (popover.hidden ? open() : close(true)));
  search.addEventListener("input", renderGrid);
  popover.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Enter" && event.target === search) {
      event.preventDefault();
      event.stopPropagation();
      const first = searchEmojis(search.value)[0];
      if (first) choose(first.emoji);
    } else if (event.key === "ArrowDown" && event.target === search) {
      event.preventDefault();
      grid.querySelector<HTMLButtonElement>(".emoji-picker__emoji")?.focus();
    } else if (event.target instanceof HTMLElement && moveFocus(grid, event.target, event.key)) {
      event.preventDefault();
    }
  });

  renderTrigger();
  return { element, value: () => selected };
}
