import { invoke } from "@tauri-apps/api/core";
import { Effect, getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { BackgroundOutcome } from "../application/ports";
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

type BackgroundResult = {
  readonly exitCode: number | null;
  readonly durationMs: number;
  readonly output: string;
  readonly cancelled: boolean;
};

export async function runBackground(id: string, command: string, cwd: string | undefined): Promise<BackgroundOutcome> {
  const result = await invoke<BackgroundResult>("run_background", { id, command, cwd: cwd ?? null });
  return { ...result, exitCode: result.exitCode ?? undefined };
}

export function cancelBackground(id: string): Promise<void> {
  return invoke("cancel_background", { id });
}

const repoRoots = new Map<string, Promise<string | undefined>>();

export function repoRootOf(cwd: string): Promise<string | undefined> {
  const cached = repoRoots.get(cwd);
  if (cached) return cached;
  const lookup = invoke<string | null>("repo_root", { cwd })
    .then((root) => {
      if (root === null) repoRoots.delete(cwd);
      return root ?? undefined;
    })
    .catch(() => {
      repoRoots.delete(cwd);
      return undefined;
    });
  repoRoots.set(cwd, lookup);
  return lookup;
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

export type HostInfo = { readonly kind: "native" | "wsl"; readonly distro: string | null };

export const NATIVE_HOST: HostInfo = { kind: "native", distro: null };

export function configureHost(mode: string): Promise<HostInfo> {
  return invoke("host_configure", { mode });
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
