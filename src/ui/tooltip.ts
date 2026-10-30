export type TooltipContent = {
  readonly title: string;
  readonly lines: readonly { readonly text: string; readonly tone?: "code" | "muted" }[];
};

const GAP = 8;
const SHOW_DELAY_MS = 250;

let bubble: HTMLElement | undefined;
let showTimer: ReturnType<typeof setTimeout> | undefined;

function tooltipElement(): HTMLElement {
  if (bubble) return bubble;
  bubble = document.createElement("div");
  bubble.className = "tooltip";
  bubble.setAttribute("role", "tooltip");
  bubble.id = "cypher-tooltip";
  bubble.hidden = true;
  document.body.append(bubble);
  return bubble;
}

function render(content: TooltipContent): HTMLElement {
  const element = tooltipElement();
  const title = document.createElement("strong");
  title.className = "tooltip__title";
  title.textContent = content.title;
  const lines = content.lines.map((line) => {
    const row = document.createElement("span");
    row.className = `tooltip__line${line.tone ? ` tooltip__line--${line.tone}` : ""}`;
    row.textContent = line.text;
    return row;
  });
  element.replaceChildren(title, ...lines);
  return element;
}

function position(element: HTMLElement, anchor: HTMLElement): void {
  const target = anchor.getBoundingClientRect();
  const { width, height } = element.getBoundingClientRect();
  const fitsBelow = target.bottom + GAP + height <= window.innerHeight;
  const top = fitsBelow ? target.bottom + GAP : target.top - GAP - height;
  const centered = target.left + target.width / 2 - width / 2;
  const left = Math.min(Math.max(GAP, centered), window.innerWidth - width - GAP);
  element.style.top = `${Math.max(GAP, top)}px`;
  element.style.left = `${left}px`;
}

function hide(): void {
  clearTimeout(showTimer);
  if (bubble) bubble.hidden = true;
}

export function attachTooltip(anchor: HTMLElement, content: () => TooltipContent): void {
  anchor.removeAttribute("title");
  anchor.setAttribute("aria-describedby", "cypher-tooltip");
  const show = () => {
    clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      if (!anchor.isConnected) return;
      const element = render(content());
      element.hidden = false;
      position(element, anchor);
    }, SHOW_DELAY_MS);
  };
  anchor.addEventListener("mouseenter", show);
  anchor.addEventListener("focus", show);
  anchor.addEventListener("mouseleave", hide);
  anchor.addEventListener("blur", hide);
  anchor.addEventListener("mousedown", hide);
}
