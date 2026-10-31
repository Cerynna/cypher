export type PackageManager = "yarn" | "pnpm" | "bun" | "npm";

export type ProjectScript = { readonly name: string; readonly body: string; readonly command: string };

export type Project = {
  readonly name: string | undefined;
  readonly dir: string;
  readonly packageManager: PackageManager;
  readonly scripts: readonly ProjectScript[];
};

const MANAGER_BY_LOCKFILE: ReadonlyArray<readonly [string, PackageManager]> = [
  ["yarn.lock", "yarn"],
  ["pnpm-lock.yaml", "pnpm"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"],
];

type PackageJson = { readonly name?: unknown; readonly scripts?: unknown; readonly packageManager?: unknown };

function declaredManager(packageManager: unknown): PackageManager | undefined {
  if (typeof packageManager !== "string") return undefined;
  const name = packageManager.split("@")[0];
  return MANAGER_BY_LOCKFILE.find(([, manager]) => manager === name)?.[1];
}

function detectManager(manifest: PackageJson, lockfiles: readonly string[]): PackageManager {
  return (
    declaredManager(manifest.packageManager) ??
    MANAGER_BY_LOCKFILE.find(([lockfile]) => lockfiles.includes(lockfile))?.[1] ??
    "npm"
  );
}

function runCommand(manager: PackageManager, script: string): string {
  return manager === "npm" ? `npm run ${script}` : `${manager} ${script}`;
}

export function readProject(dir: string, packageJson: string, lockfiles: readonly string[]): Project | undefined {
  let manifest: PackageJson;
  try {
    manifest = JSON.parse(packageJson) as PackageJson;
  } catch {
    return undefined;
  }
  const packageManager = detectManager(manifest, lockfiles);
  const declared = typeof manifest.scripts === "object" && manifest.scripts !== null ? manifest.scripts : {};
  const scripts = Object.entries(declared)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name, body]) => ({ name, body, command: runCommand(packageManager, name) }));
  return { name: typeof manifest.name === "string" ? manifest.name : undefined, dir, packageManager, scripts };
}
