import type { ClaudeSessionView } from "../domain/claude-dashboard";
import { formatDuration } from "../domain/command-history";
import { element, textElement } from "./dom";
import type { SidebarView } from "./sidebar";

const STATE_LABELS = { waiting: "attend ta réponse", working: "travaille" } as const;

export class ClaudeView {
  private constructor(
    readonly view: SidebarView,
    private readonly list: HTMLElement,
    private readonly onSelect: (paneId: string) => void,
  ) {}

  static create(onSelect: (paneId: string) => void, onShow: () => void): ClaudeView {
    const list = element("ol", "sidebar__list");
    return new ClaudeView({ tool: "claude", label: "Claude", element: list, actions: [], onShow }, list, onSelect);
  }

  render(sessions: readonly ClaudeSessionView[], now: number): void {
    if (sessions.length === 0) {
      return this.list.replaceChildren(textElement("li", "sidebar__empty", "Aucune session Claude ouverte."));
    }
    this.list.replaceChildren(...sessions.map((session) => this.renderSession(session, now)));
  }

  private renderSession(session: ClaudeSessionView, now: number): HTMLElement {
    const item = element("li", `card card--claude card--${session.state}`);
    const open = element("button", "card__main");
    open.title = "Aller à cet onglet";
    const status = textElement("span", "card__status", `● ${STATE_LABELS[session.state]}`);
    const duration = session.startedAt === undefined ? "" : ` · depuis ${formatDuration(now - session.startedAt)}`;
    open.append(
      textElement("span", "card__title", session.topic),
      status,
      ...(session.detail ? [textElement("span", "card__detail", session.detail)] : []),
      textElement("span", "card__meta", `${session.tabLabel}${duration}`),
    );
    open.addEventListener("click", () => this.onSelect(session.paneId));
    item.append(open);
    return item;
  }
}
