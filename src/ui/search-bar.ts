import type { ISearchOptions, SearchAddon } from "@xterm/addon-search";

export type SearchTarget = { readonly search: SearchAddon; focus(): void };

export class SearchBar {
  private target: SearchTarget | undefined;

  private constructor(
    private readonly root: HTMLElement,
    private readonly input: HTMLInputElement,
    private readonly decorations: () => ISearchOptions["decorations"],
  ) {}

  static attach(root: HTMLElement, decorations: () => ISearchOptions["decorations"]): SearchBar {
    const input = root.querySelector("input");
    if (!input) throw new Error("champ de recherche introuvable");
    const bar = new SearchBar(root, input, decorations);
    input.addEventListener("input", () => bar.find("next", true));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") bar.close();
      else if (event.key === "Enter") bar.find(event.shiftKey ? "previous" : "next", false);
    });
    return bar;
  }

  open(target: SearchTarget): void {
    if (this.target && this.target !== target) this.target.search.clearDecorations();
    this.target = target;
    this.root.hidden = false;
    this.input.focus();
    this.input.select();
  }

  private close(): void {
    this.target?.search.clearDecorations();
    this.root.hidden = true;
    this.target?.focus();
  }

  private find(direction: "next" | "previous", incremental: boolean): void {
    const options: ISearchOptions = { decorations: this.decorations(), incremental };
    if (direction === "next") this.target?.search.findNext(this.input.value, options);
    else this.target?.search.findPrevious(this.input.value, options);
  }
}
