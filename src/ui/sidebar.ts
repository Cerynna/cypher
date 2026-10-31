import { clampSidebarWidth, SIDEBAR_WIDTH } from "../domain/sidebar-width";
import { actionButton, element } from "./dom";

const WIDTH_KEY = "cypher.sidebarWidth";

function savedWidth(): number {
  try {
    return clampSidebarWidth(Number(localStorage.getItem(WIDTH_KEY)) || SIDEBAR_WIDTH.default, window.innerWidth);
  } catch {
    return SIDEBAR_WIDTH.default;
  }
}

function persistWidth(width: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(width));
  } catch {}
}

export type SidebarTool = "clipboard" | "claude" | "project";

export type SidebarView = {
  readonly tool: SidebarTool;
  readonly label: string;
  readonly element: HTMLElement;
  readonly actions: readonly HTMLElement[];
  readonly onShow: () => void;
};

export class Sidebar {
  private shown: SidebarView | undefined;
  private lastTool: SidebarTool;

  private constructor(
    readonly element: HTMLElement,
    private readonly tabs: HTMLElement,
    private readonly actions: HTMLElement,
    private readonly content: HTMLElement,
    private readonly views: readonly SidebarView[],
  ) {
    this.lastTool = views[0]?.tool ?? "clipboard";
  }

  static create(views: readonly SidebarView[], onClose: () => void): Sidebar {
    const root = element("aside", "sidebar");
    root.hidden = true;
    const header = element("header", "sidebar__header");
    const tabs = element("nav", "sidebar__tabs");
    const actions = element("div", "sidebar__actions");
    header.append(tabs, actions, actionButton("✕", onClose, "Fermer le panneau"));
    const content = element("div", "sidebar__content");
    const handle = element("div", "sidebar__resize");
    handle.setAttribute("aria-hidden", "true");
    root.append(handle, header, content);
    const sidebar = new Sidebar(root, tabs, actions, content, views);
    sidebar.setWidth(savedWidth());
    sidebar.bindResize(handle);
    tabs.append(
      ...views.map((view) => {
        const tab = element("button", "sidebar__tab");
        tab.textContent = view.label;
        tab.dataset.tool = view.tool;
        tab.addEventListener("click", () => sidebar.show(view.tool));
        return tab;
      }),
    );
    return sidebar;
  }

  get showing(): SidebarTool | undefined {
    return this.shown?.tool;
  }

  toggle(tool: SidebarTool = this.lastTool): void {
    if (this.showing === tool) this.close();
    else this.show(tool);
  }

  show(tool: SidebarTool): void {
    const view = this.views.find((candidate) => candidate.tool === tool);
    if (!view) return;
    this.shown = view;
    this.lastTool = tool;
    this.element.hidden = false;
    for (const tab of this.tabs.querySelectorAll<HTMLElement>(".sidebar__tab")) {
      tab.classList.toggle("sidebar__tab--active", tab.dataset.tool === tool);
    }
    this.actions.replaceChildren(...view.actions);
    this.content.replaceChildren(view.element);
    view.onShow();
  }

  private setWidth(width: number): void {
    this.element.style.width = `${width}px`;
  }

  private bindResize(handle: HTMLElement): void {
    handle.addEventListener("dblclick", () => {
      this.setWidth(SIDEBAR_WIDTH.default);
      persistWidth(SIDEBAR_WIDTH.default);
    });
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      this.element.classList.add("sidebar--resizing");
      const right = this.element.getBoundingClientRect().right;
      let width = this.element.offsetWidth;
      const move = (moved: PointerEvent) => {
        width = clampSidebarWidth(right - moved.clientX, window.innerWidth);
        this.setWidth(width);
      };
      const stop = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", stop);
        this.element.classList.remove("sidebar--resizing");
        persistWidth(width);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", stop);
    });
  }

  close(): void {
    this.shown = undefined;
    this.element.hidden = true;
  }
}
