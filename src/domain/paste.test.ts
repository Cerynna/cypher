import { describe, expect, it } from "vitest";
import { planPaste } from "./paste";

describe("planPaste", () => {
  it("colle directement une seule ligne", () => {
    expect(planPaste("ls -la", false)).toEqual({ kind: "direct", text: "ls -la" });
  });

  it("demande confirmation pour plusieurs lignes hors bracketed paste", () => {
    expect(planPaste("cd /tmp\nrm -rf x\n", false)).toEqual({
      kind: "confirm",
      text: "cd /tmp\nrm -rf x\n",
      lineCount: 3,
    });
  });

  it("colle directement plusieurs lignes quand le shell est en bracketed paste", () => {
    expect(planPaste("a\nb", true).kind).toBe("direct");
  });

  it("retire les séquences d'échappement qui permettraient de sortir du bracketed paste", () => {
    expect(planPaste("echo ok\x1b[201~rm -rf ~\n", true)).toEqual({
      kind: "direct",
      text: "echo ok[201~rm -rf ~\n",
    });
  });

  it("retire les CSI 8 bits mais garde les tabulations", () => {
    expect(planPaste("a\tb\x9b31m", false)).toEqual({ kind: "direct", text: "a\tb31m" });
  });
});
