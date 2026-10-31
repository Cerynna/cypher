export type ClipboardEntry = { readonly text: string; readonly copiedAt: number };

export class ClipboardHistory {
  static readonly CAPACITY = 50;

  private constructor(readonly entries: readonly ClipboardEntry[]) {}

  static create(): ClipboardHistory {
    return new ClipboardHistory([]);
  }

  get latest(): ClipboardEntry | undefined {
    return this.entries[0];
  }

  record(text: string, copiedAt: number): ClipboardHistory {
    if (text.trim() === "" || this.latest?.text === text) return this;
    const others = this.entries.filter((entry) => entry.text !== text);
    return new ClipboardHistory([{ text, copiedAt }, ...others].slice(0, ClipboardHistory.CAPACITY));
  }

  remove(text: string): ClipboardHistory {
    return new ClipboardHistory(this.entries.filter((entry) => entry.text !== text));
  }

  clear(): ClipboardHistory {
    return ClipboardHistory.create();
  }
}
