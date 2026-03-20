import { SCREEN } from './screen';

/** Tracks finger/mouse position for coin magnet */
export const finger = {
  active: false,
  x: 0,
  y: 0,
};

/** One-shot tap (for UI buttons, perk selection) */
export const tap = {
  hit: false,
  x: 0,
  y: 0,
};

export function initInput(canvas: HTMLCanvasElement): void {
  const toGame = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = SCREEN.w / rect.width;
    const scaleY = SCREEN.h / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Touch
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const p = toGame(t.clientX, t.clientY);
    finger.active = true;
    finger.x = p.x;
    finger.y = p.y;
    tap.hit = true;
    tap.x = p.x;
    tap.y = p.y;
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const p = toGame(t.clientX, t.clientY);
    finger.x = p.x;
    finger.y = p.y;
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    finger.active = false;
  });

  canvas.addEventListener('touchcancel', () => {
    finger.active = false;
  });

  // Mouse — finger always active on move (no need to hold click)
  canvas.addEventListener('mousedown', (e) => {
    const p = toGame(e.clientX, e.clientY);
    tap.hit = true;
    tap.x = p.x;
    tap.y = p.y;
  });

  canvas.addEventListener('mousemove', (e) => {
    const p = toGame(e.clientX, e.clientY);
    finger.active = true;
    finger.x = p.x;
    finger.y = p.y;
  });

  canvas.addEventListener('mouseleave', () => {
    finger.active = false;
  });
}

/** Call at end of frame to reset one-shot events */
export function resetInput(): void {
  tap.hit = false;
}
