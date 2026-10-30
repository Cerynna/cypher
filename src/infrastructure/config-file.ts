import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { parse, stringify } from "smol-toml";
import { type Config, DEFAULT_CONFIG, type ParsedConfig, parseConfig, serializeConfig } from "../domain/config";

const CONFIG_CHANGED_EVENT = "config-changed";
const RELOAD_DEBOUNCE_MS = 150;

type ConfigFile = { readonly path: string; readonly content: string | null };

export type LoadedConfig = ParsedConfig & { readonly path: string; readonly exists: boolean };

export async function loadConfig(): Promise<LoadedConfig> {
  const file = await invoke<ConfigFile>("config_read");
  if (file.content === null) return { ...parseConfig(undefined), path: file.path, exists: false };
  try {
    return { ...parseConfig(parse(file.content)), path: file.path, exists: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { config: DEFAULT_CONFIG, problems: [`config.toml illisible : ${reason}`], path: file.path, exists: true };
  }
}

export function saveConfig(config: Config): Promise<void> {
  return invoke("config_write", { content: stringify(serializeConfig(config)) });
}

export function watchConfig(onChange: () => void): Promise<UnlistenFn> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return listen(CONFIG_CHANGED_EVENT, () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, RELOAD_DEBOUNCE_MS);
  });
}
