import { describe, expect, it } from "vitest";
import { readProject } from "./project-scripts";

const MANIFEST = JSON.stringify({ name: "cypher", scripts: { dev: "vite", test: "vitest run", broken: 3 } });

describe("readProject", () => {
  it("liste les scripts lancés avec le gestionnaire du lockfile", () => {
    expect(readProject("/srv/app", MANIFEST, ["yarn.lock"])).toEqual({
      name: "cypher",
      dir: "/srv/app",
      packageManager: "yarn",
      scripts: [
        { name: "dev", body: "vite", command: "yarn dev" },
        { name: "test", body: "vitest run", command: "yarn test" },
      ],
    });
  });

  it("préfère le champ packageManager et retombe sur npm run", () => {
    const declared = JSON.stringify({ packageManager: "pnpm@9.1.0", scripts: { build: "tsc" } });
    expect(readProject("/a", declared, ["yarn.lock"])?.scripts[0]?.command).toBe("pnpm build");
    expect(readProject("/a", JSON.stringify({ scripts: { build: "tsc" } }), [])?.scripts[0]?.command).toBe(
      "npm run build",
    );
  });

  it("ignore un package.json illisible ou sans scripts", () => {
    expect(readProject("/a", "{ pas du json", [])).toBeUndefined();
    expect(readProject("/a", "{}", [])?.scripts).toEqual([]);
  });
});
