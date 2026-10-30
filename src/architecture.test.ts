/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;
const FRAMEWORK_IMPORT = /from\s+["'](@tauri-apps|@xterm|smol-toml)/;
const OUTER_LAYER_IMPORT = /from\s+["']\.\.\/(infrastructure|ui)\//;

const sources = (layer: string) =>
  readdirSync(join(SRC, layer))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => [`src/${layer}/${file}`, readFileSync(join(SRC, layer, file), "utf8")] as const);

describe("architecture", () => {
  it.each([...sources("domain"), ...sources("application")])(
    "%s ne dépend ni des frameworks ni des couches externes",
    (_file, content) => {
      expect(content).not.toMatch(FRAMEWORK_IMPORT);
      expect(content).not.toMatch(OUTER_LAYER_IMPORT);
    },
  );

  it.each(sources("domain"))("%s n'importe pas la couche application", (_file, content) => {
    expect(content).not.toMatch(/from\s+["']\.\.\/application\//);
  });
});
