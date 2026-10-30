import { directoryName } from "./shell-integration";

export type PaneTitleSource = {
  readonly runningCommand: string | undefined;
  readonly repoRoot: string | undefined;
  readonly cwd: string | undefined;
  readonly shellTitle: string;
};

export function paneTitle(source: PaneTitleSource): string {
  if (source.runningCommand) return source.runningCommand;
  if (source.repoRoot) return directoryName(source.repoRoot);
  if (source.cwd) return directoryName(source.cwd);
  return source.shellTitle || "shell";
}
