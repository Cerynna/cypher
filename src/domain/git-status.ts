export type FileChange = "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflicted";

export type ChangedFile = {
  readonly path: string;
  readonly change: FileChange;
  readonly staged: boolean;
};

export type GitStatus = {
  readonly branch: string;
  readonly upstream: string | undefined;
  readonly ahead: number;
  readonly behind: number;
  readonly files: readonly ChangedFile[];
};

export type RepositoryStatus = { readonly root: string; readonly status: GitStatus };

const CHANGE_BY_CODE: Readonly<Record<string, FileChange>> = {
  M: "modified",
  T: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "added",
};

function changeOf(code: string): FileChange {
  return CHANGE_BY_CODE[code] ?? "modified";
}

function trackedFile(xy: string, path: string): ChangedFile {
  const [index = ".", worktree = "."] = xy;
  const staged = index !== ".";
  return { path, change: changeOf(staged ? index : worktree), staged: staged && worktree === "." };
}

function parseEntry(line: string): ChangedFile | undefined {
  const fields = line.split(" ");
  switch (fields[0]) {
    case "1":
      return trackedFile(fields[1] ?? "..", fields.slice(8).join(" "));
    case "2":
      return trackedFile(fields[1] ?? "..", fields.slice(9).join(" ").split("\t")[0] ?? "");
    case "u":
      return { path: fields.slice(10).join(" "), change: "conflicted", staged: false };
    case "?":
      return { path: line.slice(2), change: "untracked", staged: false };
    default:
      return undefined;
  }
}

export function parseGitStatus(porcelain: string): GitStatus {
  let branch = "";
  let upstream: string | undefined;
  let ahead = 0;
  let behind = 0;
  const files: ChangedFile[] = [];
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("# branch.head ")) branch = line.slice("# branch.head ".length);
    else if (line.startsWith("# branch.upstream ")) upstream = line.slice("# branch.upstream ".length);
    else if (line.startsWith("# branch.ab ")) {
      const [, , aheadField = "+0", behindField = "-0"] = line.split(" ");
      ahead = Number(aheadField.slice(1));
      behind = Number(behindField.slice(1));
    } else {
      const file = parseEntry(line);
      if (file) files.push(file);
    }
  }
  return { branch: branch === "(detached)" ? "HEAD détachée" : branch, upstream, ahead, behind, files };
}
