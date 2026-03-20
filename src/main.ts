import { SCREEN, BASE_W, BASE_H, updateScreen } from './screen';
import { loadAssets } from './assets';
import { loadSpineAssets } from './spine-loader';
import { initInput } from './input';
import { Game } from './game';

const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudCanvas = document.getElementById('hud-canvas') as HTMLCanvasElement;
const wrapper = document.getElementById('game-wrapper') as HTMLDivElement;

let game: Game | null = null;
let rafId = 0;

function fitToScreen(): void {
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const scale = Math.min(winW / BASE_W, winH / BASE_H);
  const cssW = Math.round(BASE_W * scale);
  const cssH = Math.round(BASE_H * scale);

  wrapper.style.width = cssW + 'px';
  wrapper.style.height = cssH + 'px';
}

async function main(): Promise<void> {
  if (rafId) cancelAnimationFrame(rafId);

  updateScreen();

  // Canvas internal resolution = game size × DPR
  const dpr = SCREEN.dpr;
  gameCanvas.width = Math.round(BASE_W * dpr);
  gameCanvas.height = Math.round(BASE_H * dpr);
  hudCanvas.width = Math.round(BASE_W * dpr);
  hudCanvas.height = Math.round(BASE_H * dpr);

  // CSS size = fixed game size (wrapper scales it)
  gameCanvas.style.width = '100%';
  gameCanvas.style.height = '100%';
  hudCanvas.style.width = '100%';
  hudCanvas.style.height = '100%';

  // Load all assets in parallel
  await Promise.all([
    loadAssets(),
    loadSpineAssets(),
  ]);

  console.log('[mg2] All assets loaded');

  hudCanvas.style.pointerEvents = 'auto';
  initInput(hudCanvas);

  game = new Game(gameCanvas, hudCanvas);
  fitToScreen();
  window.addEventListener('resize', fitToScreen);

  let lastTime = performance.now();

  function loop(): void {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    game!.update(dt);
    game!.draw();

    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
}

main().catch((e) => console.error('[mg2] FATAL:', e));
