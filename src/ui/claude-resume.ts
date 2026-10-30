import { formatAgo } from "../domain/claude-sessions";
import { openOverlay } from "./overlay";

export type ResumeEntry = {
  readonly title: string;
  readonly cwd: string | undefined;
  readonly preview: string | null;
  readonly lastActivity: number | undefined;
  readonly sessionFound: boolean;
  readonly resume: () => void;
};

export type ResumeListOptions = {
  readonly heading: string;
  readonly intro: string;
  readonly emptyText: string;
  readonly onClose: () => void;
};

function shortPath(path: string | undefined): string {
  if (!path) return "dossier inconnu";
  return path.replace(/^\/home\/[^/]+/, "~");
}

function entryRow(entry: ResumeEntry, run: (entry: ResumeEntry) => void, now: number): HTMLElement {
  const row = document.createElement("li");
  row.className = "resume__entry";
  const text = document.createElement("div");
  text.className = "resume__text";
  const title = document.createElement("strong");
  title.textContent = entry.title;
  const meta = document.createElement("span");
  meta.className = "resume__meta";
  const when = entry.lastActivity === undefined ? "" : ` · ${formatAgo(entry.lastActivity, now)}`;
  meta.textContent = `${shortPath(entry.cwd)}${when}${entry.sessionFound ? "" : " · reprise de la plus récente"}`;
  const preview = document.createElement("span");
  preview.className = "resume__preview";
  preview.textContent = entry.preview ?? "(pas d'aperçu)";
  text.append(title, meta, preview);
  const button = document.createElement("button");
  button.className = "button--primary";
  button.textContent = "Reprendre";
  button.addEventListener("click", () => run(entry));
  row.append(text, button);
  return row;
}

export function openResumeList(entries: readonly ResumeEntry[], options: ResumeListOptions): void {
  const chosen: ResumeEntry[] = [];
  const overlay = openOverlay(
    options.heading,
    () => {
      options.onClose();
      for (const entry of chosen) entry.resume();
    },
    "overlay__panel--resume",
  );
  const intro = document.createElement("p");
  intro.className = "resume__intro";
  intro.textContent = entries.length === 0 ? options.emptyText : options.intro;
  const list = document.createElement("ul");
  list.className = "resume__list";
  const now = Date.now();
  list.append(
    ...entries.map((entry) =>
      entryRow(
        entry,
        (picked) => {
          chosen.push(picked);
          overlay.close();
        },
        now,
      ),
    ),
  );

  const actions = document.createElement("div");
  actions.className = "settings__actions";
  const dismiss = document.createElement("button");
  dismiss.textContent = entries.length === 0 ? "Fermer" : "Ignorer";
  dismiss.addEventListener("click", () => overlay.close());
  actions.append(dismiss);
  if (entries.length > 1) {
    const all = document.createElement("button");
    all.className = "button--primary";
    all.textContent = "Tout reprendre";
    all.addEventListener("click", () => {
      chosen.push(...entries);
      overlay.close();
    });
    actions.append(all);
  }
  overlay.body.append(intro, list, actions);
  overlay.body.querySelector<HTMLButtonElement>(".resume__entry button, .settings__actions button")?.focus();
}
