import type { ChangedFile, FileChange, RepositoryStatus } from "../domain/git-status";
import type { Project, ProjectScript } from "../domain/project-scripts";
import { actionButton, element, textElement } from "./dom";
import type { SidebarView } from "./sidebar";

export type ProjectPanelState =
  | { readonly kind: "loading" }
  | { readonly kind: "none" }
  | { readonly kind: "ready"; readonly repository: RepositoryStatus | undefined; readonly project: Project | undefined }
  | { readonly kind: "error"; readonly message: string };

export type ProjectViewCallbacks = {
  readonly onRefresh: () => void;
  readonly onShow: () => void;
  readonly onRunScript: (script: ProjectScript) => void;
  readonly onShowDiff: (root: string, file: ChangedFile) => void;
  readonly onOpenFile: (root: string, file: ChangedFile) => void;
};

const CHANGE_MARKS: Readonly<Record<FileChange, string>> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  untracked: "?",
  conflicted: "!",
};

function section(title: string, ...children: HTMLElement[]): HTMLElement {
  const block = element("section", "sidebar__section");
  block.append(textElement("h3", "sidebar__heading", title), ...children);
  return block;
}

function syncLabel(repository: RepositoryStatus): string {
  const { upstream, ahead, behind } = repository.status;
  if (!upstream) return "pas de branche distante";
  if (ahead === 0 && behind === 0) return `à jour avec ${upstream}`;
  return [ahead > 0 ? `↑${ahead}` : "", behind > 0 ? `↓${behind}` : ""].filter(Boolean).join(" ") + ` ${upstream}`;
}

export class ProjectView {
  private constructor(
    readonly view: SidebarView,
    private readonly content: HTMLElement,
    private readonly callbacks: ProjectViewCallbacks,
  ) {}

  static create(callbacks: ProjectViewCallbacks): ProjectView {
    const content = element("div", "sidebar__stack");
    const view: SidebarView = {
      tool: "project",
      label: "Projet",
      element: content,
      actions: [actionButton("↻", callbacks.onRefresh, "Actualiser")],
      onShow: callbacks.onShow,
    };
    return new ProjectView(view, content, callbacks);
  }

  render(state: ProjectPanelState): void {
    if (state.kind === "loading") return this.content.replaceChildren(textElement("p", "sidebar__empty", "Lecture…"));
    if (state.kind === "error") return this.content.replaceChildren(textElement("p", "sidebar__error", state.message));
    if (state.kind === "none" || (!state.repository && !state.project)) {
      return this.content.replaceChildren(textElement("p", "sidebar__empty", "Ni dépôt git ni package.json ici."));
    }
    this.content.replaceChildren(
      ...(state.repository ? [this.renderRepository(state.repository)] : []),
      ...(state.project ? [this.renderScripts(state.project)] : []),
    );
  }

  private renderRepository(repository: RepositoryStatus): HTMLElement {
    const branch = element("p", "project__branch");
    branch.append(
      textElement("span", "project__branch-name", `⎇ ${repository.status.branch}`),
      textElement("span", "card__meta", syncLabel(repository)),
    );
    const files = repository.status.files;
    const list = element("ol", "sidebar__list");
    list.append(
      ...(files.length === 0
        ? [textElement("li", "sidebar__empty", "Rien à commiter.")]
        : files.map((file) => this.renderFile(repository.root, file))),
    );
    return section(`Git · ${files.length} fichier${files.length > 1 ? "s" : ""}`, branch, list);
  }

  private renderFile(root: string, file: ChangedFile): HTMLElement {
    const item = element("li", `file file--${file.change}`);
    const diff = element("button", "file__main");
    diff.title = file.change === "untracked" ? "Ouvrir le fichier" : "Voir le diff";
    diff.append(
      textElement("span", "file__mark", CHANGE_MARKS[file.change]),
      textElement("span", "file__path", file.path),
      ...(file.staged ? [textElement("span", "file__staged", "indexé")] : []),
    );
    diff.addEventListener("click", () =>
      file.change === "untracked" ? this.callbacks.onOpenFile(root, file) : this.callbacks.onShowDiff(root, file),
    );
    const open = textElement("button", "file__open", "↗");
    open.setAttribute("aria-label", "Ouvrir dans l'éditeur");
    open.addEventListener("click", () => this.callbacks.onOpenFile(root, file));
    item.append(diff, open);
    return item;
  }

  private renderScripts(project: Project): HTMLElement {
    const list = element("ol", "sidebar__list");
    list.append(
      ...(project.scripts.length === 0
        ? [textElement("li", "sidebar__empty", "Aucun script.")]
        : project.scripts.map((script) => {
            const item = element("li", "script");
            const run = element("button", "script__run");
            run.title = script.body;
            run.append(textElement("span", "script__name", `▸ ${script.name}`), textElement("span", "card__meta", script.body));
            run.addEventListener("click", () => this.callbacks.onRunScript(script));
            item.append(run);
            return item;
          })),
    );
    return section(`Scripts · ${project.name ?? project.packageManager}`, list);
  }
}
