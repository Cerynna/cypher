import { invoke } from "@tauri-apps/api/core";
import { parseGitStatus, type RepositoryStatus } from "../domain/git-status";
import { type Project, readProject } from "../domain/project-scripts";

type RawGitStatus = { readonly root: string; readonly porcelain: string };
type RawManifest = { readonly dir: string; readonly packageJson: string; readonly lockfiles: readonly string[] };

export async function repositoryStatus(cwd: string): Promise<RepositoryStatus | undefined> {
  const raw = await invoke<RawGitStatus | null>("git_status", { cwd });
  return raw ? { root: raw.root, status: parseGitStatus(raw.porcelain) } : undefined;
}

export function fileDiff(root: string, path: string): Promise<string> {
  return invoke("git_diff", { root, path });
}

export async function projectAt(cwd: string): Promise<Project | undefined> {
  const raw = await invoke<RawManifest | null>("project_manifest", { cwd });
  return raw ? readProject(raw.dir, raw.packageJson, raw.lockfiles) : undefined;
}
