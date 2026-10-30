export type Overlay = {
  readonly panel: HTMLElement;
  readonly body: HTMLElement;
  readonly close: () => void;
};

let current: Overlay | undefined;

export function openOverlay(title: string, onClose: () => void, variant = ""): Overlay {
  current?.close();
  const backdrop = document.createElement("div");
  backdrop.className = "overlay";
  const panel = document.createElement("section");
  panel.className = `overlay__panel ${variant}`.trim();
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", title);
  const heading = document.createElement("header");
  heading.className = "overlay__title";
  heading.textContent = title;
  const body = document.createElement("div");
  body.className = "overlay__body";
  panel.append(heading, body);
  backdrop.append(panel);

  const overlay: Overlay = {
    panel,
    body,
    close: () => {
      if (current !== overlay) return;
      current = undefined;
      backdrop.remove();
      onClose();
    },
  };
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) overlay.close();
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      overlay.close();
    }
  });
  document.body.append(backdrop);
  current = overlay;
  return overlay;
}

function toastStack(): HTMLElement {
  const existing = document.querySelector<HTMLElement>(".toast-stack");
  if (existing) return existing;
  const stack = document.createElement("div");
  stack.className = "toast-stack";
  document.body.append(stack);
  return stack;
}

export type ToastAction = { readonly label: string; readonly run: () => void };

const TOAST_DURATION_MS = { info: 4000, error: 8000, withAction: 12000 } as const;

export function showToast(message: string, kind: "info" | "error" = "info", action?: ToastAction): void {
  const toast = document.createElement("div");
  toast.className = `toast toast--${kind}`;
  toast.setAttribute("role", kind === "error" ? "alert" : "status");
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(text);

  const duration = action ? TOAST_DURATION_MS.withAction : TOAST_DURATION_MS[kind];
  let timer = setTimeout(() => toast.remove(), duration);
  if (action) {
    const button = document.createElement("button");
    button.className = "toast__action";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      toast.remove();
      action.run();
    });
    toast.append(button);
    toast.addEventListener("mouseenter", () => clearTimeout(timer));
    toast.addEventListener("mouseleave", () => {
      timer = setTimeout(() => toast.remove(), duration / 2);
    });
  }
  toastStack().append(toast);
}
