const BASE_W = 384;
const BASE_H = 848;

export const SCREEN = { w: BASE_W, h: BASE_H, scale: 1 };

export function updateScreen(w: number, h: number): void {
  SCREEN.w = w;
  SCREEN.h = h;
  SCREEN.scale = Math.min(w / BASE_W, h / BASE_H);
}

/** Scale a base-384 pixel value by current screen scale */
export function S(px: number): number {
  return Math.round(px * SCREEN.scale);
}
