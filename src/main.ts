import { SCREEN, updateScreen } from './screen';

const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudCanvas = document.getElementById('hud-canvas') as HTMLCanvasElement;
const ctx = gameCanvas.getContext('2d')!;
const hud = hudCanvas.getContext('2d')!;

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  updateScreen(w, h);

  gameCanvas.width = SCREEN.w;
  gameCanvas.height = SCREEN.h;
  gameCanvas.style.width = w + 'px';
  gameCanvas.style.height = h + 'px';

  hudCanvas.width = SCREEN.w;
  hudCanvas.height = SCREEN.h;
  hudCanvas.style.width = w + 'px';
  hudCanvas.style.height = h + 'px';
}

resize();
window.addEventListener('resize', resize);

/* ── Game loop ─────────────────────────────────── */

let lastTime = 0;

function loop(time: number): void {
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  // Clear
  ctx.clearRect(0, 0, SCREEN.w, SCREEN.h);
  hud.clearRect(0, 0, SCREEN.w, SCREEN.h);

  // Placeholder
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);

  hud.fillStyle = '#fff';
  hud.font = `bold ${Math.round(24 * SCREEN.scale)}px monospace`;
  hud.textAlign = 'center';
  hud.fillText('Mini Game 2', SCREEN.w / 2, SCREEN.h / 2);

  void dt; // will be used in game logic

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
