export const SIDEBAR_WIDTH = { default: 320, min: 220, maxShare: 0.6 } as const;

export function clampSidebarWidth(width: number, viewportWidth: number): number {
  const max = Math.max(SIDEBAR_WIDTH.min, Math.round(viewportWidth * SIDEBAR_WIDTH.maxShare));
  return Math.min(max, Math.max(SIDEBAR_WIDTH.min, Math.round(width)));
}
