import { describe, expect, it } from "vitest";
import { clampSidebarWidth, SIDEBAR_WIDTH } from "./sidebar-width";

describe("clampSidebarWidth", () => {
  it("garde une largeur lisible sans manger plus de 60 % de la fenêtre", () => {
    expect(clampSidebarWidth(400.4, 1200)).toBe(400);
    expect(clampSidebarWidth(80, 1200)).toBe(SIDEBAR_WIDTH.min);
    expect(clampSidebarWidth(1100, 1200)).toBe(720);
  });

  it("garde la largeur minimale sur une fenêtre étroite", () => {
    expect(clampSidebarWidth(300, 300)).toBe(SIDEBAR_WIDTH.min);
  });
});
