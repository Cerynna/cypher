export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  created.className = className;
  return created;
}

export function textElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] {
  const created = element(tag, className);
  created.textContent = text;
  return created;
}

export function actionButton(label: string, onClick: () => void, ariaLabel?: string): HTMLButtonElement {
  const button = textElement("button", "sidebar__action", label);
  if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", onClick);
  return button;
}
