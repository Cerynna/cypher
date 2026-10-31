import DOMPurify from "dompurify";
import { marked } from "marked";
import { defaultFrame, type Frame, fitFrame } from "../domain/floating-frame";
import { actionButton, element, textElement } from "./dom";

const FRAME_KEY = "cypher.notesFrame";
const SAVE_DELAY_MS = 400;

export type NotesWindowCallbacks = {
  readonly load: () => Promise<string>;
  readonly save: (content: string) => Promise<void>;
  readonly onSend: (text: string) => void;
  readonly onOpenUrl: (url: string) => void;
  readonly onClose: () => void;
  readonly onError: (error: unknown) => void;
};

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function savedFrame(): Frame {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(FRAME_KEY) ?? "null");
    if (saved && typeof saved === "object") return fitFrame(saved as Frame, viewport());
  } catch {}
  return defaultFrame(viewport());
}

function persistFrame(frame: Frame): void {
  try {
    localStorage.setItem(FRAME_KEY, JSON.stringify(frame));
  } catch {}
}

function lineAt(text: string, caret: number): string {
  const start = text.lastIndexOf("\n", caret - 1) + 1;
  const end = text.indexOf("\n", caret);
  return text.slice(start, end === -1 ? undefined : end);
}

export class NotesWindow {
  private frame = savedFrame();
  private loaded = false;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private previewing = false;

  private constructor(
    readonly element: HTMLElement,
    private readonly editor: HTMLTextAreaElement,
    private readonly preview: HTMLElement,
    private readonly modeButton: HTMLButtonElement,
    private readonly callbacks: NotesWindowCallbacks,
  ) {}

  static create(callbacks: NotesWindowCallbacks): NotesWindow {
    const root = element("section", "notes");
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Notes");
    const header = element("header", "notes__header");
    const editor = element("textarea", "notes__editor");
    editor.spellcheck = false;
    editor.placeholder = "Notes en Markdown…\nCtrl+Entrée envoie la ligne (ou la sélection) au terminal.";
    const preview = element("article", "notes__preview");
    preview.hidden = true;
    const modeButton = actionButton("Aperçu", () => undefined);
    const notes = new NotesWindow(root, editor, preview, modeButton, callbacks);
    modeButton.addEventListener("click", () => notes.setPreviewing(!notes.previewing));
    header.append(
      textElement("span", "notes__title", "NOTES"),
      modeButton,
      actionButton("↵ Terminal", () => notes.sendCurrent(), "Envoyer la ligne au terminal"),
      actionButton("✕", () => callbacks.onClose(), "Fermer les notes"),
    );
    root.append(header, editor, preview);
    notes.bind(header);
    return notes;
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }

  async open(): Promise<void> {
    this.element.hidden = false;
    this.place(fitFrame(this.frame, viewport()));
    if (!this.loaded) {
      this.editor.value = await this.callbacks.load().catch((error: unknown) => {
        this.callbacks.onError(error);
        return "";
      });
      this.loaded = true;
    }
    if (this.previewing) this.renderPreview();
    else this.editor.focus();
  }

  close(): void {
    this.flush();
    this.element.hidden = true;
  }

  private bind(header: HTMLElement): void {
    this.element.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        this.callbacks.onClose();
      } else if (event.key === "Enter" && event.ctrlKey) {
        event.preventDefault();
        this.sendCurrent();
      }
    });
    this.editor.addEventListener("input", () => this.scheduleSave());
    this.preview.addEventListener("click", (event) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link) return;
      event.preventDefault();
      if (/^https?:\/\//.test(link.href)) this.callbacks.onOpenUrl(link.href);
    });
    header.addEventListener("pointerdown", (event) => this.startDrag(event, header));
    new ResizeObserver(() => {
      if (this.element.hidden) return;
      const { width, height } = this.element.getBoundingClientRect();
      this.remember({ ...this.frame, width: Math.round(width), height: Math.round(height) });
    }).observe(this.element);
    window.addEventListener("resize", () => {
      if (!this.element.hidden) this.place(fitFrame(this.frame, viewport()));
    });
  }

  private startDrag(event: PointerEvent, header: HTMLElement): void {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
    event.preventDefault();
    const origin = { x: event.clientX - this.frame.x, y: event.clientY - this.frame.y };
    header.setPointerCapture(event.pointerId);
    const move = (moved: PointerEvent) =>
      this.place(fitFrame({ ...this.frame, x: moved.clientX - origin.x, y: moved.clientY - origin.y }, viewport()));
    const stop = () => {
      header.removeEventListener("pointermove", move);
      header.removeEventListener("pointerup", stop);
      persistFrame(this.frame);
    };
    header.addEventListener("pointermove", move);
    header.addEventListener("pointerup", stop);
  }

  private place(frame: Frame): void {
    this.frame = frame;
    Object.assign(this.element.style, {
      left: `${frame.x}px`,
      top: `${frame.y}px`,
      width: `${frame.width}px`,
      height: `${frame.height}px`,
    });
  }

  private remember(frame: Frame): void {
    this.frame = frame;
    persistFrame(frame);
  }

  private setPreviewing(previewing: boolean): void {
    this.previewing = previewing;
    this.modeButton.textContent = previewing ? "Éditer" : "Aperçu";
    this.editor.hidden = previewing;
    this.preview.hidden = !previewing;
    if (previewing) this.renderPreview();
    else this.editor.focus();
  }

  private renderPreview(): void {
    const html = marked.parse(this.editor.value, { async: false, gfm: true, breaks: true });
    this.preview.innerHTML = DOMPurify.sanitize(html);
  }

  private sendCurrent(): void {
    const { value, selectionStart, selectionEnd } = this.editor;
    const text = selectionStart === selectionEnd ? lineAt(value, selectionStart) : value.slice(selectionStart, selectionEnd);
    if (text.trim()) this.callbacks.onSend(text);
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  private flush(): void {
    if (this.saveTimer === undefined) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    this.callbacks.save(this.editor.value).catch(this.callbacks.onError);
  }
}
