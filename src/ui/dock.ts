import { QUICK_COMMAND_MODE_LABELS, type QuickCommand, type TabPosition } from "../domain/quick-commands";
import { attachTooltip, type TooltipContent } from "./tooltip";

export type DockLayout = {
  readonly frame: HTMLElement;
  readonly hud: HTMLElement;
  readonly hudAnchor: HTMLElement;
  readonly body: HTMLElement;
  readonly workspace: HTMLElement;
  readonly dock: HTMLElement;
};

export function placeDock(layout: DockLayout, position: TabPosition): void {
  layout.frame.dataset.tabs = position;
  if (position === "top") layout.hud.insertBefore(layout.dock, layout.hudAnchor);
  else if (position === "left") layout.body.insertBefore(layout.dock, layout.workspace);
  else layout.body.append(layout.dock);
}

export type QuickCommandRun = { readonly finished: () => void };

export type QuickCommandCallbacks = {
  readonly onRun: (quickCommand: QuickCommand, run: QuickCommandRun) => void;
  readonly onCreate: () => void;
};

function tooltip(quickCommand: QuickCommand): TooltipContent {
  const notice = quickCommand.notify && quickCommand.mode !== "background" ? " · notification" : "";
  return {
    title: `${quickCommand.emoji} ${quickCommand.name}`,
    lines: [
      { text: quickCommand.command, tone: "code" },
      { text: `${QUICK_COMMAND_MODE_LABELS[quickCommand.mode]}${notice}`, tone: "muted" },
    ],
  };
}

export function renderQuickCommands(
  host: HTMLElement,
  commands: readonly QuickCommand[],
  callbacks: QuickCommandCallbacks,
): void {
  const buttons = commands.map((quickCommand) => {
    const button = document.createElement("button");
    button.className = "quick-command";
    button.textContent = quickCommand.emoji;
    button.setAttribute("aria-label", quickCommand.name);
    attachTooltip(button, () => tooltip(quickCommand));
    button.addEventListener("click", () => {
      button.classList.add("quick-command--running");
      callbacks.onRun(quickCommand, { finished: () => button.classList.remove("quick-command--running") });
    });
    return button;
  });
  const add = document.createElement("button");
  add.className = "quick-command quick-command--add";
  add.textContent = "+";
  add.setAttribute("aria-label", "Créer une commande rapide");
  attachTooltip(add, () => ({ title: "Nouvelle commande rapide", lines: [] }));
  add.addEventListener("click", () => callbacks.onCreate());
  host.replaceChildren(...buttons, add);
}
