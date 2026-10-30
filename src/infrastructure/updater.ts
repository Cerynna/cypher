import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

export type AvailableUpdate = {
  readonly version: string;
  readonly install: (beforeRestart: () => void) => Promise<void>;
};

export async function findUpdate(): Promise<AvailableUpdate | undefined> {
  const update = await check();
  if (!update) return undefined;
  return {
    version: update.version,
    install: async (beforeRestart) => {
      await update.download();
      beforeRestart();
      await update.install();
      await relaunch();
    },
  };
}
