export type Frame = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export type Viewport = { readonly width: number; readonly height: number };

export const MIN_FRAME = { width: 280, height: 180 } as const;

export function defaultFrame(viewport: Viewport): Frame {
  const width = Math.min(560, viewport.width - 40);
  const height = Math.min(420, viewport.height - 80);
  return fitFrame({ x: viewport.width - width - 24, y: 64, width, height }, viewport);
}

export function fitFrame(frame: Frame, viewport: Viewport): Frame {
  const width = Math.max(MIN_FRAME.width, Math.min(frame.width, viewport.width));
  const height = Math.max(MIN_FRAME.height, Math.min(frame.height, viewport.height));
  return {
    width,
    height,
    x: Math.max(0, Math.min(frame.x, viewport.width - width)),
    y: Math.max(0, Math.min(frame.y, viewport.height - height)),
  };
}
