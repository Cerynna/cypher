import type { QuickCommandExecution } from "../application/quick-command-runner";
import { QUICK_COMMAND_MODE_LABELS, type QuickCommand, type TabPosition } from "../domain/quick-commands";
import { attachTooltip, type TooltipContent } from "./tooltip";

export type DockLayout = {
  readonly frame: HTMLElement;
  readonly hud: HTMLElement;
  readonly hudAnchor: HTMLElement;
  readonly body: HTMLElement;
  readonly main: HTMLElement;
  readonly dock: HTMLElement;
};

export function placeDock(layout: DockLayout, position: TabPosition): void {
  layout.frame.dataset.tabs = position;
  if (position === "top") layout.hud.insertBefore(layout.dock, layout.hudAnchor);
  else if (position === "left") layout.body.insertBefore(layout.dock, layout.main);
  else layout.body.append(layout.dock);
}

export type QuickCommandCallbacks = {
  readonly onRun: (quickCommand: QuickCommand) => QuickCommandExecution;
  readonly onCreate: () => void;
};

function tooltip(quickCommand: QuickCommand, execution: QuickCommandExecution | undefined): TooltipContent {
  const notice = quickCommand.notify && quickCommand.mode !== "background" ? " · notification" : "";
  const status = execution?.cancel ? [{ text: "En cours · clic pour arrêter", tone: "code" as const }] : [];
  return {
    title: `${quickCommand.emoji} ${quickCommand.name}`,
    lines: [
      { text: quickCommand.command, tone: "code" },
      { text: `${QUICK_COMMAND_MODE_LABELS[quickCommand.mode]}${notice}`, tone: "muted" },
      ...status,
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
    let execution: QuickCommandExecution | undefined;
    attachTooltip(button, () => tooltip(quickCommand, execution));
    button.addEventListener("click", () => {
      if (execution?.cancel) return execution.cancel();
      const current = callbacks.onRun(quickCommand);
      execution = current;
      button.classList.add("quick-command--running");
      button.setAttribute("aria-busy", "true");
      void current.finished
        .catch(() => undefined)
        .finally(() => {
          if (execution !== current) return;
          execution = undefined;
          button.classList.remove("quick-command--running");
          button.removeAttribute("aria-busy");
        });
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
