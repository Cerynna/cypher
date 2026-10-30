import { copyText } from "./clipboard";
import { openOverlay } from "./overlay";

export function openOutputViewer(title: string, output: string, onClose: () => void): void {
  const overlay = openOverlay(title, onClose, "overlay__panel--output");
  const content = document.createElement("pre");
  content.className = "output-viewer";
  content.tabIndex = 0;
  content.textContent = output.trim() === "" ? "(aucune sortie)" : output;

  const copy = document.createElement("button");
  copy.textContent = "Copier";
  copy.addEventListener("click", () => {
    void copyText(output).then(() => {
      copy.textContent = "Copié ✓";
    });
  });
  const actions = document.createElement("div");
  actions.className = "settings__actions";
  actions.append(copy);

  overlay.body.append(content, actions);
  content.focus();
  content.scrollTop = content.scrollHeight;
}
