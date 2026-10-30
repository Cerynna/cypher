export type FileLink = {
  readonly start: number;
  readonly length: number;
  readonly path: string;
  readonly line: number | undefined;
  readonly column: number | undefined;
};

const FILE_REFERENCE =
  /(?<=^|[\s'"`(\[<=])((?:~|\.{1,2})?\/?(?:[\w.@-]+\/)*[\w@-][\w.@-]*\.[A-Za-z0-9]+)(?::(\d+))?(?::(\d+))?/g;

export function findFileLinks(line: string): readonly FileLink[] {
  return [...line.matchAll(FILE_REFERENCE)]
    .filter((match) => !line.slice(0, match.index).endsWith("://") && !/^v?\d+(\.\d+)+$/.test(match[1]))
    .map((match) => ({
      start: match.index,
      length: match[0].length,
      path: match[1],
      line: match[2] === undefined ? undefined : Number(match[2]),
      column: match[3] === undefined ? undefined : Number(match[3]),
    }));
}

export type EditorInvocation = { readonly program: string; readonly args: readonly string[] };

const REMOTE_CAPABLE_EDITORS = new Set(["code", "code-insiders", "codium", "cursor"]);

export function editorInvocation(
  template: string,
  file: string,
  line: number | undefined,
  column: number | undefined,
  wslDistro?: string,
): EditorInvocation | undefined {
  const [program, ...rawArgs] = template.trim().split(/\s+/);
  if (!program) return undefined;
  const args = rawArgs.map((arg) =>
    arg
      .replaceAll("{file}", file)
      .replaceAll("{line}", String(line ?? 1))
      .replaceAll("{column}", String(column ?? 1)),
  );
  const remote =
    wslDistro !== undefined && REMOTE_CAPABLE_EDITORS.has(program.toLowerCase()) && !args.includes("--remote")
      ? ["--remote", `wsl+${wslDistro}`]
      : [];
  return { program, args: [...remote, ...args] };
}
