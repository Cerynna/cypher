import type { ClipboardEntry, ClipboardHistory } from "../domain/clipboard-history";

const PREVIEW_LINES = 4;
const LINE_BREAK = /\r\n|\r|\n/;

export type ClipboardPanelCallbacks = {
  readonly onPaste: (text: string) => void;
  readonly onRemove: (text: string) => void;
  readonly onClear: () => void;
  readonly onClose: () => void;
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  created.className = className;
  return created;
}

function describe(entry: ClipboardEntry): string {
  const lineCount = entry.text.split(LINE_BREAK).length;
  const time = new Date(entry.copiedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return lineCount > 1 ? `${lineCount} lignes · ${time}` : time;
}

export class ClipboardPanel {
  private constructor(
    readonly element: HTMLElement,
    private readonly list: HTMLElement,
    private readonly callbacks: ClipboardPanelCallbacks,
  ) {}

  static create(callbacks: ClipboardPanelCallbacks): ClipboardPanel {
    const panel = element("aside", "clipboard-panel");
    panel.hidden = true;
    panel.setAttribute("aria-label", "Historique du presse-papiers");
    const header = element("header", "clipboard-panel__header");
    const title = element("span", "clipboard-panel__title");
    title.textContent = "PRESSE-PAPIERS";
    const clear = element("button", "clipboard-panel__action");
    clear.textContent = "Vider";
    clear.addEventListener("click", () => callbacks.onClear());
    const close = element("button", "clipboard-panel__action");
    close.textContent = "✕";
    close.setAttribute("aria-label", "Fermer l'historique");
    close.addEventListener("click", () => callbacks.onClose());
    header.append(title, clear, close);
    const list = element("ol", "clipboard-panel__list");
    panel.append(header, list);
    return new ClipboardPanel(panel, list, callbacks);
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }

  setOpen(open: boolean): void {
    this.element.hidden = !open;
  }

  render(history: ClipboardHistory): void {
    if (history.entries.length === 0) {
      const empty = element("li", "clipboard-panel__empty");
      empty.textContent = "Rien de copié pour l'instant.";
      return this.list.replaceChildren(empty);
    }
    this.list.replaceChildren(...history.entries.map((entry) => this.renderEntry(entry)));
  }

  private renderEntry(entry: ClipboardEntry): HTMLElement {
    const item = element("li", "clip");
    const paste = element("button", "clip__paste");
    paste.title = "Coller dans le terminal actif";
    const preview = element("pre", "clip__preview");
    preview.textContent = entry.text.split(LINE_BREAK).slice(0, PREVIEW_LINES).join("\n");
    const meta = element("span", "clip__meta");
    meta.textContent = describe(entry);
    paste.append(preview, meta);
    paste.addEventListener("click", () => this.callbacks.onPaste(entry.text));
    const remove = element("button", "clip__remove");
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Retirer de l'historique");
    remove.addEventListener("click", () => this.callbacks.onRemove(entry.text));
    item.append(paste, remove);
    return item;
  }
}
