import { describe, expect, it } from "vitest";
import { parseGitStatus } from "./git-status";

const PORCELAIN = [
  "# branch.oid 1e4cdb1",
  "# branch.head main",
  "# branch.upstream origin/main",
  "# branch.ab +2 -1",
  "1 .M N... 100644 100644 100644 aaa bbb src/main.ts",
  "1 A. N... 000000 100644 100644 000 ccc src/domain/git status.ts",
  "1 D. N... 100644 000000 000000 ddd 000 old.ts",
  "2 R. N... 100644 100644 100644 eee eee R100 src/new.ts\tsrc/old.ts",
  "u UU N... 100644 100644 100644 100644 a b c conflit.ts",
  "? notes/idée.md",
  "",
].join("\n");

describe("parseGitStatus", () => {
  it("lit la branche, l'upstream et l'avance ou le retard", () => {
    const status = parseGitStatus(PORCELAIN);
    expect(status).toMatchObject({ branch: "main", upstream: "origin/main", ahead: 2, behind: 1 });
  });

  it("classe les fichiers modifiés, indexés, renommés, en conflit et non suivis", () => {
    expect(parseGitStatus(PORCELAIN).files).toEqual([
      { path: "src/main.ts", change: "modified", staged: false },
      { path: "src/domain/git status.ts", change: "added", staged: true },
      { path: "old.ts", change: "deleted", staged: true },
      { path: "src/new.ts", change: "renamed", staged: true },
      { path: "conflit.ts", change: "conflicted", staged: false },
      { path: "notes/idée.md", change: "untracked", staged: false },
    ]);
  });

  it("gère une branche sans upstream ou une HEAD détachée", () => {
    expect(parseGitStatus("# branch.head feature\n")).toEqual({
      branch: "feature",
      upstream: undefined,
      ahead: 0,
      behind: 0,
      files: [],
    });
    expect(parseGitStatus("# branch.head (detached)\n").branch).toBe("HEAD détachée");
  });

  it("considère comme non indexé un fichier modifié des deux côtés", () => {
    expect(parseGitStatus("1 MM N... 1 1 1 a b both.ts").files).toEqual([
      { path: "both.ts", change: "modified", staged: false },
    ]);
  });
});
