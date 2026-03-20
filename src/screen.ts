export const BASE_W = 384;
export const BASE_H = 848;

export const SCREEN = {
  /** Fixed game dimensions — never change */
  w: BASE_W,
  h: BASE_H,
  dpr: 1,
};

/** Update DPR (call on init, no need on resize since game size is fixed) */
export function updateScreen(): void {
  SCREEN.dpr = window.devicePixelRatio || 1;
}

/** Scale helper — identity since game is always at base resolution */
export function S(px: number): number {
  return px;
}
