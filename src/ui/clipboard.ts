import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ask } from "@tauri-apps/plugin-dialog";
import { ClipboardAddon, type IClipboardProvider } from "@xterm/addon-clipboard";
import type { Terminal } from "@xterm/xterm";
import { planPaste } from "../domain/paste";

const writeOnlyProvider: IClipboardProvider = {
  readText: () => "",
  writeText: (_selection, text) => writeText(text),
};

export function copyText(text: string): Promise<void> {
  return writeText(text);
}

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
    await writeText(selection);
    this.terminal.clearSelection();
  }

  async pasteFromClipboard(): Promise<void> {
    const text = await readText();
    if (text) await this.paste(text);
  }

  private async paste(rawText: string): Promise<void> {
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
