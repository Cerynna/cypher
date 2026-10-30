import { invoke } from "@tauri-apps/api/core";
import { Effect, getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ClaudeSession } from "../domain/claude-sessions";
import type { EditorInvocation } from "../domain/links";

export function existingPaths(cwd: string | undefined, paths: readonly string[]): Promise<readonly (string | null)[]> {
  return invoke("existing_paths", { cwd: cwd ?? null, paths });
}

export function openInEditor(invocation: EditorInvocation): Promise<void> {
  return invoke("open_in_editor", { program: invocation.program, args: invocation.args });
}

export function openExternalUrl(url: string): Promise<void> {
  return openUrl(url);
}

export type BackgroundResult = {
  readonly exitCode: number | null;
  readonly durationMs: number;
  readonly output: string;
};

export function runBackground(command: string, cwd: string | undefined): Promise<BackgroundResult> {
  return invoke("run_background", { command, cwd: cwd ?? null });
}

export function claudeSessions(cwd: string, limit: number): Promise<readonly ClaudeSession[]> {
  return invoke("claude_sessions", { cwd, limit });
}

export function onWindowClosing(handler: () => void): Promise<() => void> {
  return getCurrentWindow().onCloseRequested(handler);
}

export function askClaude(model: string, system: string, prompt: string): Promise<string> {
  return invoke("ai_ask", { request: { model, system, prompt } });
}

export async function notify(title: string, body: string): Promise<void> {
  const granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
  if (granted) sendNotification({ title, body });
}

export function platformName(): string {
  const agent = navigator.userAgent;
  if (agent.includes("Windows")) return "Windows";
  if (agent.includes("Mac")) return "macOS";
  return "Linux";
}

let blurApplied = false;
let quakeShortcut: string | undefined;

export async function applyWindowBlur(enabled: boolean): Promise<void> {
  if (enabled === blurApplied) return;
  const appWindow = getCurrentWindow();
  blurApplied = enabled;
  if (!enabled) return appWindow.clearEffects();
  const effect = platformName() === "macOS" ? Effect.HudWindow : Effect.Acrylic;
  return appWindow.setEffects({ effects: [effect] });
}

export async function bindQuakeShortcut(enabled: boolean, shortcut: string): Promise<void> {
  if (enabled && shortcut === quakeShortcut) return;
  if (quakeShortcut) await unregister(quakeShortcut);
  quakeShortcut = undefined;
  if (!enabled) return;
  const appWindow = getCurrentWindow();
  quakeShortcut = shortcut;
  await register(shortcut, async (event) => {
    if (event.state !== "Pressed") return;
    const visible = (await appWindow.isVisible()) && (await appWindow.isFocused());
    if (visible) return appWindow.hide();
    await appWindow.show();
    await appWindow.setFocus();
  });
}

export function setWindowTitle(title: string): Promise<void> {
  return getCurrentWindow().setTitle(title);
}

export function closeWindow(): Promise<void> {
  return getCurrentWindow().close();
}
