/**
 * Lightweight frame-based sprite animation system.
 * Loads PNG sequences and plays them on Canvas2D via drawImage.
 */

/* ── Types ──────────────────────────────────────── */

export interface SpriteAnimDef {
  /** Unique key, e.g. 'dog' */
  key: string;
  /** Map of animation name → frame file paths */
  anims: Record<string, string[]>;
  /** Target render height in pixels (pre-scales frames at load time for crisp rendering) */
  targetHeight?: number;
}

interface AnimData {
  /** Pre-scaled canvases (or original images if no targetHeight) */
  frames: (HTMLCanvasElement | HTMLImageElement)[];
  /** Display width/height of a single frame (after pre-scale) */
  frameW: number;
  frameH: number;
}

export interface SpriteInstance {
  key: string;
  currentAnim: string;
  frame: number;
  elapsed: number;
  fps: number;
  loop: boolean;
  done: boolean;
}

/* ── Storage ────────────────────────────────────── */

/** key → animName → AnimData */
const animCache = new Map<string, Map<string, AnimData>>();

/* ── Loading ────────────────────────────────────── */

/** Pre-scale an image to target height using high-quality offscreen canvas */
function prescale(img: HTMLImageElement, targetH: number): HTMLCanvasElement {
  const aspect = img.naturalWidth / img.naturalHeight;
  const targetW = Math.round(targetH * aspect);

  const c = document.createElement('canvas');
  c.width = targetW;
  c.height = targetH;

  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return c;
}

export async function loadSpriteAnim(def: SpriteAnimDef): Promise<void> {
  const animMap = new Map<string, AnimData>();

  for (const [animName, paths] of Object.entries(def.anims)) {
    const rawFrames: HTMLImageElement[] = [];

    await Promise.all(
      paths.map(
        (path, i) =>
          new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              rawFrames[i] = img;
              resolve();
            };
            img.onerror = () => reject(new Error(`Failed to load ${path}`));
            img.src = path;
          }),
      ),
    );

    // Pre-scale if targetHeight specified
    if (def.targetHeight && def.targetHeight > 0) {
      const scaled = rawFrames.map((img) => prescale(img, def.targetHeight!));
      animMap.set(animName, {
        frames: scaled,
        frameW: scaled[0].width,
        frameH: scaled[0].height,
      });
    } else {
      animMap.set(animName, {
        frames: rawFrames,
        frameW: rawFrames[0].naturalWidth,
        frameH: rawFrames[0].naturalHeight,
      });
    }
  }

  animCache.set(def.key, animMap);
  console.log(`[sprite] Loaded "${def.key}": ${[...animMap.keys()].join(', ')}`);
}

/* ── Instance creation ──────────────────────────── */

export function createSpriteInstance(
  key: string,
  anim: string,
  fps = 24,
  loop = true,
): SpriteInstance {
  return { key, currentAnim: anim, frame: 0, elapsed: 0, fps, loop, done: false };
}

export function setAnimation(inst: SpriteInstance, anim: string, loop = true): void {
  if (inst.currentAnim === anim) return;
  inst.currentAnim = anim;
  inst.frame = 0;
  inst.elapsed = 0;
  inst.loop = loop;
  inst.done = false;
}

/* ── Query ──────────────────────────────────────── */

export function getAnimNames(key: string): string[] {
  const m = animCache.get(key);
  return m ? [...m.keys()] : [];
}

export function getFrameSize(key: string, anim: string): { w: number; h: number } | null {
  const data = animCache.get(key)?.get(anim);
  return data ? { w: data.frameW, h: data.frameH } : null;
}

/* ── Draw ───────────────────────────────────────── */

/**
 * Advance animation timer and draw the current frame.
 * If frames were pre-scaled at load time, draws 1:1 (crisp, no runtime resampling).
 * @param scale  additional runtime scale (1.0 = use pre-scaled size as-is)
 * @param flipX  mirror horizontally (face left vs right)
 */
export function drawSpriteInstance(
  ctx: CanvasRenderingContext2D,
  inst: SpriteInstance,
  x: number,
  y: number,
  scale: number,
  flipX: boolean,
  dt: number,
): void {
  const animMap = animCache.get(inst.key);
  if (!animMap) return;

  const data = animMap.get(inst.currentAnim);
  if (!data || data.frames.length === 0) return;

  // Advance animation
  if (!inst.done) {
    inst.elapsed += dt;
    const frameDur = 1 / inst.fps;
    while (inst.elapsed >= frameDur) {
      inst.elapsed -= frameDur;
      inst.frame++;
      if (inst.frame >= data.frames.length) {
        if (inst.loop) {
          inst.frame = 0;
        } else {
          inst.frame = data.frames.length - 1;
          inst.done = true;
        }
      }
    }
  }

  const img = data.frames[inst.frame];
  if (!img) return;

  const w = data.frameW * scale;
  const h = data.frameH * scale;

  ctx.save();
  ctx.translate(x, y);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}
