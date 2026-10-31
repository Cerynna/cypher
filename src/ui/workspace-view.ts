import type { WorkspaceRenderer } from "../application/ports";
import {
  paneIds,
  clampRatio,
  DEFAULT_RATIO,
  type PaneId,
  type PaneNode,
  type SplitNode,
  type SplitPath,
  splitRatio,
} from "../domain/pane-tree";
import type { TabColor, TabId, Workspace } from "../domain/workspace";
import { openTabMenu } from "./tab-menu";
import type { TerminalPane } from "./terminal-pane";

export type WorkspaceViewCallbacks = {
  readonly onActivateTab: (id: TabId) => void;
  readonly onCloseTab: (id: TabId) => void;
  readonly onNewTab: () => void;
  readonly onClosePane: (id: PaneId) => void;
  readonly onRenameTab: (id: TabId, label: string) => void;
  readonly onColorTab: (id: TabId, color: TabColor | undefined) => void;
  readonly onTabEditEnd: () => void;
  readonly onResizeSplit: (path: SplitPath, ratio: number) => void;
  readonly onRendered: (focused: TerminalPane | undefined) => void;
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  created.className = className;
  return created;
}

export class WorkspaceView implements WorkspaceRenderer<TerminalPane> {
  private editingTab: TabId | undefined;
  private lastRender: { workspace: Workspace; panes: ReadonlyMap<PaneId, TerminalPane> } | undefined;

  private constructor(
    private readonly tabsHost: HTMLElement,
    private readonly panesHost: HTMLElement,
    private readonly callbacks: WorkspaceViewCallbacks,
  ) {}

  static create(tabsHost: HTMLElement, panesHost: HTMLElement, callbacks: WorkspaceViewCallbacks): WorkspaceView {
    return new WorkspaceView(tabsHost, panesHost, callbacks);
  }

  render(workspace: Workspace, panes: ReadonlyMap<PaneId, TerminalPane>): void {
    this.lastRender = { workspace, panes };
    if (this.editingTab === undefined) this.renderTabs(workspace, panes);
    const active = workspace.activeTab;
    if (!active) return this.panesHost.replaceChildren();
    const showFocus = active.root.kind === "split";
    const focused = document.activeElement;
    this.panesHost.replaceChildren(this.renderNode(active.root, [], panes, active.focusedPane, showFocus));
    for (const pane of panes.values()) {
      if (!pane.element.isConnected) continue;
      pane.mount();
      pane.fit();
    }
    if (focused instanceof HTMLElement && focused !== document.activeElement && focused.isConnected) {
      focused.focus({ preventScroll: true });
    }
    this.callbacks.onRendered(panes.get(active.focusedPane));
  }

  startRename(tabId: TabId): void {
    const button = this.tabsHost.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(tabId)}"]`);
    const label = button?.querySelector<HTMLElement>(".tab__label");
    const tab = this.lastRender?.workspace.tabs.find((candidate) => candidate.id === tabId);
    if (!button || !label || !tab) return;
    this.editingTab = tabId;
    const input = element("input", "tab__rename");
    input.value = tab.label ?? "";
    input.placeholder = label.dataset.automatic ?? "";
    input.maxLength = 40;
    input.setAttribute("aria-label", "Nom de l'onglet");
    label.replaceWith(input);

    let finished = false;
    const finish = (commit: boolean) => {
      if (finished) return;
      finished = true;
      this.editingTab = undefined;
      if (commit) this.callbacks.onRenameTab(tabId, input.value);
      else if (this.lastRender) this.renderTabs(this.lastRender.workspace, this.lastRender.panes);
      this.callbacks.onTabEditEnd();
    };
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") finish(true);
      else if (event.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("click", (event) => event.stopPropagation());
    input.focus();
    input.select();
  }

  private renderTabs(workspace: Workspace, panes: ReadonlyMap<PaneId, TerminalPane>): void {
    const tabs = workspace.tabs.map((tab) => {
      const button = element("button", "tab");
      button.dataset.tabId = tab.id;
      button.classList.toggle("tab--active", tab.id === workspace.activeTabId);
      const attention = paneIds(tab.root)
        .map((id) => panes.get(id)?.attention)
        .find((signal) => signal !== undefined);
      button.classList.toggle("tab--attention", attention !== undefined);
      if (attention) button.title = `🔔 ${attention.body}`;
      if (tab.color) button.classList.add("tab--colored", `tab-color--${tab.color}`);
      button.title = panes.get(tab.focusedPane)?.cwd ?? "";
      const automatic = panes.get(tab.focusedPane)?.title ?? "shell";
      const label = element("span", "tab__label");
      label.dataset.automatic = automatic;
      label.textContent = tab.label ?? automatic;
      const close = element("span", "tab__close");
      close.textContent = "×";
      close.setAttribute("aria-label", "Fermer l'onglet");
      close.addEventListener("click", (event) => {
        event.stopPropagation();
        this.callbacks.onCloseTab(tab.id);
      });
      button.addEventListener("click", () => this.callbacks.onActivateTab(tab.id));
      button.addEventListener("dblclick", (event) => {
        event.preventDefault();
        this.startRename(tab.id);
      });
      button.addEventListener("auxclick", (event) => {
        if (event.button === 1) this.callbacks.onCloseTab(tab.id);
      });
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openTabMenu(event.clientX, event.clientY, tab.color, {
          onRename: () => this.startRename(tab.id),
          onColor: (color) => this.callbacks.onColorTab(tab.id, color),
          onClose: () => this.callbacks.onCloseTab(tab.id),
        });
      });
      button.append(label, close);
      return button;
    });
    const add = element("button", "tab tab--new");
    add.textContent = "+";
    add.setAttribute("aria-label", "Nouvel onglet");
    add.addEventListener("click", () => this.callbacks.onNewTab());
    this.tabsHost.replaceChildren(...tabs, add);
  }

  private ensureCloseButton(host: HTMLElement, id: PaneId): void {
    if (host.querySelector(":scope > .pane__close")) return;
    const close = element("button", "pane__close");
    close.textContent = "✕";
    close.title = "Fermer le panneau";
    close.setAttribute("aria-label", "Fermer le panneau");
    close.addEventListener("mousedown", (event) => event.stopPropagation());
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      this.callbacks.onClosePane(id);
    });
    host.append(close);
  }

  private renderNode(
    node: PaneNode,
    path: SplitPath,
    panes: ReadonlyMap<PaneId, TerminalPane>,
    focused: PaneId,
    showFocus: boolean,
  ): HTMLElement {
    if (node.kind === "pane") {
      const pane = panes.get(node.id);
      const host = pane?.element ?? element("div", "pane pane--missing");
      host.classList.toggle("pane--focused", showFocus && node.id === focused);
      host.classList.toggle("pane--split", showFocus);
      this.ensureCloseButton(host, node.id);
      return host;
    }
    const split = element("div", `split split--${node.orientation}`);
    const first = this.renderNode(node.first, [...path, "first"], panes, focused, showFocus);
    const second = this.renderNode(node.second, [...path, "second"], panes, focused, showFocus);
    applyRatio(first, second, splitRatio(node));
    split.append(first, this.divider(node, path, split, first, second), second);
    return split;
  }

  private divider(
    node: SplitNode,
    path: SplitPath,
    split: HTMLElement,
    first: HTMLElement,
    second: HTMLElement,
  ): HTMLElement {
    const divider = element("div", `split__divider split__divider--${node.orientation}`);
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-orientation", node.orientation === "horizontal" ? "vertical" : "horizontal");
    divider.title = "Glisser pour redimensionner · double-clic pour 50/50";
    let ratio = splitRatio(node);

    divider.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      divider.setPointerCapture(event.pointerId);
      split.classList.add("split--resizing");
    });
    divider.addEventListener("pointermove", (event) => {
      if (!divider.hasPointerCapture(event.pointerId)) return;
      const box = split.getBoundingClientRect();
      const position =
        node.orientation === "horizontal" ? (event.clientX - box.left) / box.width : (event.clientY - box.top) / box.height;
      ratio = clampRatio(position);
      applyRatio(first, second, ratio);
    });
    const release = (event: PointerEvent) => {
      if (!divider.hasPointerCapture(event.pointerId)) return;
      divider.releasePointerCapture(event.pointerId);
      split.classList.remove("split--resizing");
      this.callbacks.onResizeSplit(path, ratio);
    };
    divider.addEventListener("pointerup", release);
    divider.addEventListener("pointercancel", release);
    divider.addEventListener("dblclick", () => this.callbacks.onResizeSplit(path, DEFAULT_RATIO));
    return divider;
  }
}

function applyRatio(first: HTMLElement, second: HTMLElement, ratio: number): void {
  first.style.flex = `${ratio} 1 0`;
  second.style.flex = `${1 - ratio} 1 0`;
}
