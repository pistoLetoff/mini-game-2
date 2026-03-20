/**
 * Spine asset loader for FM fighters.
 * Uses PixiJS + pixi-spine (proven with Spine 3.8 data).
 * Renders to hidden PixiJS canvas, blits to game Canvas2D.
 */
import * as PIXI from 'pixi.js';
import { Spine, TextureAtlas } from 'pixi-spine';
import {
  AtlasAttachmentLoader,
  SkeletonJson,
  Skin,
  type SkeletonData,
} from '@pixi-spine/runtime-3.8';

/* ── Singleton state ──────────────────────────────── */

let skelData: SkeletonData | null = null;
let pixiApp: PIXI.Application | null = null;

const OFF = 256; // offscreen canvas size

/* ── Weapon types ─────────────────────────────────── */

export type WeaponType = 'fist' | 'spear' | 'katana' | 'revolver' | 'crossbow' | 'bazooka';
export type FighterAnim = 'idle' | 'run' | 'attack' | 'death';

/* ── Animation name mappings ─────────────────────── */

const ANIM_MAP: Record<WeaponType, Record<FighterAnim, string>> = {
  fist: {
    idle:   'Weapon_Melee_Fist/PerkMeleeFireFistKnuckles_1/Idle',
    run:    'Weapon_Melee_Fist/PerkMeleeFireFistKnuckles_1/Run',
    attack: 'Weapon_Melee_Fist/PerkMeleeFireFistKnuckles_1/Attack_3',
    death:  'Weapon_Melee_Fist/PerkMeleeFireFistKnuckles_1/Death',
  },
  spear: {
    idle:   'Weapon_Melee_TwoHanded/PerkMeleeAngelSpear_1/Idle',
    run:    'Weapon_Melee_TwoHanded/PerkMeleeAngelSpear_1/Run',
    attack: 'Weapon_Melee_TwoHanded/PerkMeleeAngelSpear_1/Attack_3',
    death:  'Weapon_Melee_TwoHanded/PerkMeleeAngelSpear_1/Death',
  },
  katana: {
    idle:   'Weapon_Melee_OneHanded/PerkMeleeBleedingKatana_1/Idle',
    run:    'Weapon_Melee_OneHanded/PerkMeleeBleedingKatana_1/Run',
    attack: 'Weapon_Melee_OneHanded/PerkMeleeBleedingKatana_3/Attack_3',
    death:  'Weapon_Melee_OneHanded/PerkMeleeBleedingKatana_1/Death',
  },
  revolver: {
    idle:   'Weapon_Ranged_OneHanded/PerkRangedRevolver_1/Idle',
    run:    'Weapon_Ranged_OneHanded/PerkRangedRevolver_1/Run',
    attack: 'Weapon_Ranged_OneHanded/PerkRangedRevolver_1/Attack',
    death:  'Weapon_Ranged_OneHanded/PerkRangedRevolver_1/Death',
  },
  crossbow: {
    idle:   'Weapon_Ranged_TwoHanded/PerkRangedCrossbow_1/Idle',
    run:    'Weapon_Ranged_TwoHanded/PerkRangedCrossbow_1/Run',
    attack: 'Weapon_Ranged_TwoHanded/PerkRangedCrossbow_1/Attack',
    death:  'Weapon_Ranged_TwoHanded/PerkRangedCrossbow_1/Death',
  },
  bazooka: {
    idle:   'Weapon_Ranged_Shoulder/PerkRangedBazooka_1/Idle',
    run:    'Weapon_Ranged_Shoulder/PerkRangedBazooka_1/Run',
    attack: 'Weapon_Ranged_Shoulder/PerkRangedBazooka_1/Attack',
    death:  'Weapon_Ranged_Shoulder/PerkRangedBazooka_1/Death',
  },
};

/* ── Skin presets ─────────────────────────────────── */

const SKIN_PARTS_MELEE = [
  'Body/Vampires/1/1',
  'Face_Ear/Vampires/1/1',
  'Face_Eyes/Vampires/1/1',
  'Face_Eyes_Brows/Vampires/1/1',
  'Face_Eyes_Pupils/Vampires/1/1',
  'Face_Nose/Vampires/1/1',
  'Head/Vampires/1/1',
  'Wear_Body/legendary/necromancer/1/cyan',
  'Wear_Feet/legendary/necromancer/1/cyan',
  'Wear_Hair/legendary/necromancer/1/cyan',
  'Wear_Head/legendary/necromancer/1/cyan',
  'Wear_Legs/legendary/necromancer/1/cyan',
];

const SKIN_PARTS_RANGED = [
  'Body/Vampires/1/1',
  'Face_Ear/Vampires/1/1',
  'Face_Eyes/Vampires/1/1',
  'Face_Eyes_Brows/Vampires/1/1',
  'Face_Eyes_Pupils/Vampires/1/1',
  'Face_Nose/Vampires/1/1',
  'Head/Vampires/1/1',
  'Wear_Body/legendary/necromancer/1/red',
  'Wear_Feet/legendary/necromancer/1/red',
  'Wear_Hair/legendary/necromancer/1/red',
  'Wear_Head/legendary/necromancer/1/red',
  'Wear_Legs/legendary/necromancer/1/red',
];

/* ── Category helper ──────────────────────────────── */

const MELEE_WEAPONS: WeaponType[] = ['fist', 'spear', 'katana'];

export function isRangedWeapon(w: WeaponType): boolean {
  return !MELEE_WEAPONS.includes(w);
}

/* ── Public API ───────────────────────────────────── */

export async function loadSpineAssets(): Promise<void> {
  pixiApp = new PIXI.Application({
    width: OFF,
    height: OFF,
    backgroundAlpha: 0,
    preserveDrawingBuffer: true,
    autoStart: false,
  });
  (pixiApp.view as HTMLCanvasElement).style.display = 'none';
  document.body.appendChild(pixiApp.view as HTMLCanvasElement);

  const [atlasText, jsonData] = await Promise.all([
    fetch('/assets/spine/Base.atlas').then(r => r.text()),
    fetch('/assets/spine/Base.json').then(r => r.json()),
  ]);

  const tex1 = await PIXI.Assets.load('/assets/spine/Base.png');
  const tex2 = await PIXI.Assets.load('/assets/spine/Base2.png');

  const atlas = new TextureAtlas(atlasText, (path: string, cb: any) => {
    if (path === 'Base.png') cb(tex1.baseTexture);
    else if (path === 'Base2.png') cb(tex2.baseTexture);
  });

  const loader = new AtlasAttachmentLoader(atlas);
  const skelJson = new SkeletonJson(loader);
  skelData = skelJson.readSkeletonData(jsonData);

  console.log('[spine] Loaded:', skelData.animations.length, 'animations');
}

export function initSpineRenderer(_ctx: CanvasRenderingContext2D): void {}

export function createFighterSpine(weapon: WeaponType): Spine {
  if (!skelData) throw new Error('Spine not loaded');

  const spine = new Spine(skelData);

  const skinParts = isRangedWeapon(weapon) ? SKIN_PARTS_RANGED : SKIN_PARTS_MELEE;
  const combinedSkin = new Skin('fighter_' + weapon);

  if (skelData.defaultSkin) {
    combinedSkin.addSkin(skelData.defaultSkin);
  }

  for (const name of skinParts) {
    const skin = skelData.findSkin(name);
    if (skin) combinedSkin.addSkin(skin);
  }

  (spine.skeleton as any).setSkin(combinedSkin);
  spine.skeleton.setSlotsToSetupPose();

  spine.state.setAnimation(0, ANIM_MAP[weapon].idle, true);
  spine.autoUpdate = false;

  return spine;
}

export function getAnimName(weapon: WeaponType, anim: FighterAnim): string {
  return ANIM_MAP[weapon][anim];
}

export function drawSpine(
  ctx: CanvasRenderingContext2D,
  spine: Spine,
  x: number,
  y: number,
  scale: number,
  facingLeft: boolean,
  dt: number,
): void {
  if (!pixiApp) return;

  spine.update(dt);

  spine.x = OFF / 2;
  spine.y = OFF * 0.85;
  spine.scale.set(facingLeft ? -scale : scale, scale);

  if (!spine.parent) {
    pixiApp.stage.addChild(spine);
  }

  for (const child of pixiApp.stage.children) {
    child.visible = child === spine;
  }

  pixiApp.renderer.clear();
  pixiApp.render();

  const view = pixiApp.view as HTMLCanvasElement;
  ctx.drawImage(
    view,
    x - OFF / 2,
    y - OFF * 0.85,
    OFF,
    OFF,
  );
}
