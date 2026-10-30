import { getCurrentWindow, type Window } from "@tauri-apps/api/window";

type WindowAction = "minimize" | "maximize" | "close";
type ResizeDirection = Parameters<Window["startResizeDragging"]>[0];

const RESIZE_DIRECTIONS: readonly ResizeDirection[] = [
  "North",
  "South",
  "East",
  "West",
  "NorthEast",
  "NorthWest",
  "SouthEast",
  "SouthWest",
];

function isWindowAction(value: string | undefined): value is WindowAction {
  return value === "minimize" || value === "maximize" || value === "close";
}

export function attachTitleBar(titleBar: HTMLElement): void {
  const appWindow = getCurrentWindow();
  const actions: Readonly<Record<WindowAction, () => Promise<void>>> = {
    minimize: () => appWindow.minimize(),
    maximize: () => appWindow.toggleMaximize(),
    close: () => appWindow.close(),
  };

  for (const button of titleBar.querySelectorAll<HTMLButtonElement>("[data-window-action]")) {
    const action = button.dataset.windowAction;
    if (isWindowAction(action)) button.addEventListener("click", () => void actions[action]());
  }
}

export function attachResizeHandles(host: HTMLElement): void {
  const appWindow = getCurrentWindow();
  for (const direction of RESIZE_DIRECTIONS) {
    const handle = document.createElement("div");
    handle.className = `resize-handle resize-handle--${direction}`;
    handle.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      void appWindow.startResizeDragging(direction);
    });
    host.append(handle);
  }
}
