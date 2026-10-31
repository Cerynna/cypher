import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ask } from "@tauri-apps/plugin-dialog";
import { ClipboardAddon, type IClipboardProvider } from "@xterm/addon-clipboard";
import type { Terminal } from "@xterm/xterm";
import { planPaste } from "../domain/paste";

type CopyListener = (text: string) => void;

const copyListeners = new Set<CopyListener>();

export function onCopy(listener: CopyListener): () => void {
  copyListeners.add(listener);
  return () => copyListeners.delete(listener);
}

function announceCopy(text: string): void {
  for (const listener of copyListeners) listener(text);
}

export async function copyText(text: string): Promise<void> {
  await writeText(text);
  announceCopy(text);
}

export async function readClipboardText(): Promise<string | undefined> {
  const text = await readText().catch(() => undefined);
  if (text) announceCopy(text);
  return text || undefined;
}

const writeOnlyProvider: IClipboardProvider = {
  readText: () => "",
  writeText: (_selection, text) => copyText(text),
};

export class TerminalClipboard {
  private constructor(private readonly terminal: Terminal) {}

  static attach(terminal: Terminal, container: HTMLElement): TerminalClipboard {
    const clipboard = new TerminalClipboard(terminal);
    terminal.loadAddon(new ClipboardAddon(undefined, writeOnlyProvider));
    container.addEventListener(
      "paste",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const text = event.clipboardData?.getData("text/plain");
        if (text) void clipboard.paste(text);
      },
      { capture: true },
    );
    return clipboard;
  }

  async copySelection(): Promise<void> {
    const selection = this.terminal.getSelection();
    if (!selection) return;
    await copyText(selection);
    this.terminal.clearSelection();
  }

  async pasteFromClipboard(): Promise<void> {
    const text = await readClipboardText();
    if (text) await this.paste(text);
  }

  async paste(rawText: string): Promise<void> {
    const plan = planPaste(rawText, this.terminal.modes.bracketedPasteMode);
    if (plan.kind === "confirm") {
      const confirmed = await ask(`Coller ${plan.lineCount} lignes ? Elles seront exécutées.`, {
        title: "CYPHER",
        kind: "warning",
      });
      if (!confirmed) return;
    }
    this.terminal.paste(plan.text);
    this.terminal.focus();
  }
}
