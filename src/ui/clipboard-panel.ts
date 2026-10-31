import type { ClipboardEntry, ClipboardHistory } from "../domain/clipboard-history";
import { actionButton, element, textElement } from "./dom";
import type { SidebarView } from "./sidebar";

const PREVIEW_LINES = 4;
const LINE_BREAK = /\r\n|\r|\n/;

export type ClipboardViewCallbacks = {
  readonly onPaste: (text: string) => void;
  readonly onRemove: (text: string) => void;
  readonly onClear: () => void;
};

function describe(entry: ClipboardEntry): string {
  const lineCount = entry.text.split(LINE_BREAK).length;
  const time = new Date(entry.copiedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return lineCount > 1 ? `${lineCount} lignes · ${time}` : time;
}

export class ClipboardView {
  private constructor(
    readonly view: SidebarView,
    private readonly list: HTMLElement,
    private readonly callbacks: ClipboardViewCallbacks,
  ) {}

  static create(callbacks: ClipboardViewCallbacks): ClipboardView {
    const list = element("ol", "sidebar__list");
    const view: SidebarView = {
      tool: "clipboard",
      label: "Presse-papiers",
      element: list,
      actions: [actionButton("Vider", callbacks.onClear)],
      onShow: () => undefined,
    };
    return new ClipboardView(view, list, callbacks);
  }

  render(history: ClipboardHistory): void {
    if (history.entries.length === 0) {
      return this.list.replaceChildren(textElement("li", "sidebar__empty", "Rien de copié pour l'instant."));
    }
    this.list.replaceChildren(...history.entries.map((entry) => this.renderEntry(entry)));
  }

  private renderEntry(entry: ClipboardEntry): HTMLElement {
    const item = element("li", "card");
    const paste = element("button", "card__main");
    paste.title = "Coller dans le terminal actif";
    paste.append(
      textElement("pre", "card__preview", entry.text.split(LINE_BREAK).slice(0, PREVIEW_LINES).join("\n")),
      textElement("span", "card__meta", describe(entry)),
    );
    paste.addEventListener("click", () => this.callbacks.onPaste(entry.text));
    const remove = textElement("button", "card__remove", "×");
    remove.setAttribute("aria-label", "Retirer de l'historique");
    remove.addEventListener("click", () => this.callbacks.onRemove(entry.text));
    item.append(paste, remove);
    return item;
  }
}
