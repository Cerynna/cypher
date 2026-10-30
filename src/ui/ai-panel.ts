import { openOverlay } from "./overlay";

export type AiCommandActions = {
  readonly generate: (request: string) => Promise<string>;
  readonly insert: (command: string) => void;
  readonly onClose: () => void;
};

function resultBlock(): HTMLPreElement {
  const result = document.createElement("pre");
  result.className = "ai__result";
  result.setAttribute("aria-live", "polite");
  return result;
}

function describeError(error: unknown): string {
  return `Erreur : ${error instanceof Error ? error.message : String(error)}`;
}

export function openAiCommand(actions: AiCommandActions): void {
  let toInsert: string | undefined;
  const overlay = openOverlay(
    "IA · générer une commande",
    () => {
      actions.onClose();
      if (toInsert) actions.insert(toInsert);
    },
    "overlay__panel--ai",
  );
  const input = document.createElement("input");
  input.className = "palette__input";
  input.placeholder = "Décrivez ce que vous voulez faire…";
  input.setAttribute("aria-label", "Demande en langage naturel");
  const result = resultBlock();
  const insert = document.createElement("button");
  insert.className = "button--primary";
  insert.textContent = "Insérer dans le terminal";
  insert.hidden = true;
  let generated = "";
  insert.addEventListener("click", () => {
    toInsert = generated;
    overlay.close();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || input.value.trim() === "") return;
    event.preventDefault();
    result.textContent = "…";
    insert.hidden = true;
    actions
      .generate(input.value.trim())
      .then((command) => {
        generated = command;
        result.textContent = command;
        insert.hidden = false;
        insert.focus();
      })
      .catch((error: unknown) => {
        result.textContent = describeError(error);
      });
  });

  overlay.body.append(input, result, insert);
  input.focus();
}

export function openAiExplanation(title: string, explanation: Promise<string>, onClose: () => void): void {
  const overlay = openOverlay(`IA · ${title}`, onClose, "overlay__panel--ai");
  const result = resultBlock();
  result.textContent = "Analyse en cours…";
  overlay.body.append(result);
  overlay.panel.tabIndex = -1;
  overlay.panel.focus();
  explanation
    .then((text) => {
      result.textContent = text;
    })
    .catch((error: unknown) => {
      result.textContent = describeError(error);
    });
}
