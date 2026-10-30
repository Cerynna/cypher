import {
  type Direction,
  type Orientation,
  type PaneId,
  type PaneNode,
  containsPane,
  isPaneNode,
  leaf,
  neighbour,
  paneIds,
  removePane,
  resizeSplit,
  type SplitPath,
  splitPane,
} from "./pane-tree";

export type TabId = string;

export const TAB_COLORS = ["cyan", "magenta", "blue", "green", "yellow", "red"] as const;

export type TabColor = (typeof TAB_COLORS)[number];

export function isTabColor(value: unknown): value is TabColor {
  return typeof value === "string" && (TAB_COLORS as readonly string[]).includes(value);
}

const MAX_LABEL_LENGTH = 40;

export function normalizeTabLabel(label: string): string | undefined {
  const trimmed = label.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_LENGTH);
  return trimmed === "" ? undefined : trimmed;
}

export type Tab = {
  readonly id: TabId;
  readonly root: PaneNode;
  readonly focusedPane: PaneId;
  readonly label?: string;
  readonly color?: TabColor;
};

export type WorkspaceSnapshot = { readonly tabs: readonly Tab[]; readonly activeTab: TabId | undefined };

function isTab(value: unknown): value is Tab {
  if (typeof value !== "object" || value === null) return false;
  const tab = value as Record<string, unknown>;
  return (
    typeof tab.id === "string" &&
    isPaneNode(tab.root) &&
    typeof tab.focusedPane === "string" &&
    containsPane(tab.root, tab.focusedPane) &&
    (tab.label === undefined || (typeof tab.label === "string" && normalizeTabLabel(tab.label) === tab.label)) &&
    (tab.color === undefined || isTabColor(tab.color))
  );
}

export class Workspace {
  private constructor(
    readonly tabs: readonly Tab[],
    readonly activeTabId: TabId | undefined,
  ) {}

  static empty(): Workspace {
    return new Workspace([], undefined);
  }

  static restore(snapshot: unknown): Workspace | undefined {
    if (typeof snapshot !== "object" || snapshot === null) return undefined;
    const { tabs, activeTab } = snapshot as Record<string, unknown>;
    if (!Array.isArray(tabs) || tabs.length === 0 || !tabs.every(isTab)) return undefined;
    const allPanes = tabs.flatMap((tab) => paneIds(tab.root));
    if (new Set(allPanes).size !== allPanes.length) return undefined;
    const active = tabs.some((tab) => tab.id === activeTab) ? (activeTab as TabId) : tabs[0].id;
    return new Workspace(tabs, active);
  }

  get isEmpty(): boolean {
    return this.tabs.length === 0;
  }

  get activeTab(): Tab | undefined {
    return this.tabs.find((tab) => tab.id === this.activeTabId);
  }

  get focusedPane(): PaneId | undefined {
    return this.activeTab?.focusedPane;
  }

  get allPanes(): readonly PaneId[] {
    return this.tabs.flatMap((tab) => paneIds(tab.root));
  }

  snapshot(): WorkspaceSnapshot {
    return { tabs: this.tabs, activeTab: this.activeTabId };
  }

  openTab(tabId: TabId, paneId: PaneId): Workspace {
    const tab: Tab = { id: tabId, root: leaf(paneId), focusedPane: paneId };
    const activeIndex = this.tabs.findIndex((existing) => existing.id === this.activeTabId);
    const tabs = [...this.tabs];
    tabs.splice(activeIndex + 1, 0, tab);
    return new Workspace(tabs, tabId);
  }

  activateTab(tabId: TabId): Workspace {
    return this.tabs.some((tab) => tab.id === tabId) ? new Workspace(this.tabs, tabId) : this;
  }

  cycleTab(offset: number): Workspace {
    if (this.tabs.length < 2) return this;
    const index = this.tabs.findIndex((tab) => tab.id === this.activeTabId);
    const next = (index + offset + this.tabs.length) % this.tabs.length;
    return new Workspace(this.tabs, this.tabs[next].id);
  }

  renameTab(tabId: TabId, label: string): Workspace {
    return this.updateTab(tabId, (tab) => {
      const { label: _previous, ...rest } = tab;
      const normalized = normalizeTabLabel(label);
      return normalized === undefined ? rest : { ...rest, label: normalized };
    });
  }

  colorTab(tabId: TabId, color: TabColor | undefined): Workspace {
    return this.updateTab(tabId, (tab) => {
      const { color: _previous, ...rest } = tab;
      return color === undefined ? rest : { ...rest, color };
    });
  }

  resizeSplit(tabId: TabId, path: SplitPath, ratio: number): Workspace {
    return this.updateTab(tabId, (tab) => ({ ...tab, root: resizeSplit(tab.root, path, ratio) }));
  }

  split(newPane: PaneId, orientation: Orientation): Workspace {
    const active = this.activeTab;
    if (!active) return this;
    return this.replaceTab({
      ...active,
      root: splitPane(active.root, active.focusedPane, newPane, orientation),
      focusedPane: newPane,
    });
  }

  focusPane(paneId: PaneId): Workspace {
    const tab = this.tabs.find((candidate) => containsPane(candidate.root, paneId));
    if (!tab) return this;
    return new Workspace(
      this.tabs.map((candidate) => (candidate === tab ? { ...tab, focusedPane: paneId } : candidate)),
      tab.id,
    );
  }

  moveFocus(direction: Direction): Workspace {
    const active = this.activeTab;
    if (!active) return this;
    const target = neighbour(active.root, active.focusedPane, direction);
    return target ? this.focusPane(target) : this;
  }

  closePane(paneId: PaneId): Workspace {
    const index = this.tabs.findIndex((tab) => containsPane(tab.root, paneId));
    if (index === -1) return this;
    const tab = this.tabs[index];
    const root = removePane(tab.root, paneId);
    if (root) {
      const focusedPane = tab.focusedPane === paneId ? paneIds(root)[0] : tab.focusedPane;
      return this.replaceTab({ ...tab, root, focusedPane });
    }
    const tabs = this.tabs.filter((candidate) => candidate !== tab);
    const activeTab =
      tab.id === this.activeTabId ? tabs[Math.min(index, tabs.length - 1)]?.id : this.activeTabId;
    return new Workspace(tabs, activeTab);
  }

  private updateTab(tabId: TabId, update: (tab: Tab) => Tab): Workspace {
    const tab = this.tabs.find((candidate) => candidate.id === tabId);
    return tab ? this.replaceTab(update(tab)) : this;
  }

  private replaceTab(next: Tab): Workspace {
    return new Workspace(
      this.tabs.map((tab) => (tab.id === next.id ? next : tab)),
      this.activeTabId,
    );
  }
}
