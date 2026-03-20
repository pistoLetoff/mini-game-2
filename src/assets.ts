/** Preload all game sprites + spritesheet animations */

import { loadSpriteAnim, type SpriteAnimDef } from './sprite-anim';

const ASSET_PATHS = {
  coin: '/assets/coin.svg',
} as const;

export type AssetKey = keyof typeof ASSET_PATHS;

const images = new Map<AssetKey, HTMLImageElement>();

export function getSprite(key: AssetKey): HTMLImageElement {
  return images.get(key)!;
}

/* ── Sprite animation assets ──────────────────── */

function makePaths(dir: string, prefix: string, from: number, to: number, pad = 2): string[] {
  const paths: string[] = [];
  for (let i = from; i <= to; i++) {
    const idx = String(i).padStart(pad, '0');
    paths.push(`${dir}${prefix}${pad > 2 ? '' : '_'}${idx}.png`);
  }
  return paths;
}

const SPRITE_ANIMS: SpriteAnimDef[] = [
  {
    key: 'dog',
    anims: {
      run: makePaths('/assets/enemies/dog/run/', 'run', 10, 25),
      attack: makePaths('/assets/enemies/dog/attack/', 'attack', 3, 19),
    },
  },
  {
    key: 'bat',
    anims: {
      run: makePaths('/assets/enemies/bats/idle/', 'idle', 0, 27),
      attack: makePaths('/assets/enemies/bats/idle/', 'idle', 0, 27),
    },
  },
  {
    key: 'bear',
    anims: {
      run: makePaths('/assets/enemies/bear/run/', 'run', 0, 7),
      attack: makePaths('/assets/enemies/bear/bite/', 'bite', 0, 12),
    },
  },
  {
    key: 'explosion',
    anims: {
      boom: makePaths('/assets/vfx/explosion/', 'Untitled-', 70001, 70020, 5),
    },
    targetHeight: 80,
  },
  {
    key: 'dragon',
    anims: {
      attack: makePaths('/assets/abilities/dragon/attack/', 'attack', 0, 40),
    },
  },
];

export async function loadAssets(): Promise<void> {
  // Load image sprites
  const imagePromises = (Object.entries(ASSET_PATHS) as [AssetKey, string][]).map(
    ([key, path]) =>
      new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          images.set(key, img);
          resolve();
        };
        img.onerror = () => reject(new Error(`Failed to load ${path}`));
        img.src = path;
      }),
  );

  // Load sprite animations
  const animPromises = SPRITE_ANIMS.map((def) =>
    loadSpriteAnim(def).catch((e) => {
      console.warn(`[sprite] Failed to load "${def.key}":`, e);
    }),
  );

  await Promise.all([...imagePromises, ...animPromises]);
}
