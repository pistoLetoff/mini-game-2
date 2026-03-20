/**
 * Fighter entities — player's units that defend the base.
 */
import type { Spine } from 'pixi-spine';
import { MELEE, RANGED, BASE } from './balance';
import { createFighterSpine, getAnimName, drawSpine, isRangedWeapon, type WeaponType } from './spine-loader';

export type { WeaponType } from './spine-loader';

/* ── Weapon definitions ──────────────────────────── */

export type FighterCategory = 'melee' | 'ranged';

export interface WeaponDef {
  category: FighterCategory;
  tier: 0 | 1 | 2;
  name: string;
  multiTarget?: number;  // katana: 2
  multiBullet?: number;  // crossbow: 2
  aoe?: boolean;         // bazooka: area damage
}

export const WEAPON_DEFS: Record<WeaponType, WeaponDef> = {
  fist:      { category: 'melee',  tier: 0, name: 'Fist' },
  spear:     { category: 'melee',  tier: 1, name: 'Spear' },
  katana:    { category: 'melee',  tier: 2, name: 'Katana', multiTarget: 2 },
  revolver:  { category: 'ranged', tier: 0, name: 'Revolver' },
  crossbow:  { category: 'ranged', tier: 1, name: 'Crossbow', multiBullet: 2 },
  bazooka:   { category: 'ranged', tier: 2, name: 'Bazooka', aoe: true },
};

export const MERGE_RECIPES: Partial<Record<WeaponType, WeaponType>> = {
  fist: 'spear',
  spear: 'katana',
  revolver: 'crossbow',
  crossbow: 'bazooka',
};

/* ── Types ────────────────────────────────────────── */

export type FighterState = 'idle' | 'run' | 'attack' | 'return' | 'dead';

export interface MobRef {
  x: number;
  y: number;
  hp: number;
  dying: boolean;
  flying: boolean;
}

export interface Fighter {
  spine: Spine;
  weapon: WeaponType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackRate: number;
  state: FighterState;
  currentAnim: string;
  target: MobRef | null;
  attackCooldown: number;
  attackTimer: number;
  hasDamaged: boolean;
  facingLeft: boolean;
  deathTimer: number;
}

/* ── Factory ──────────────────────────────────────── */

export function createFighter(weapon: WeaponType, x: number, y: number): Fighter {
  const spine = createFighterSpine(weapon);
  const cat = WEAPON_DEFS[weapon].category;
  const cfg = cat === 'melee' ? MELEE : RANGED;

  return {
    spine,
    weapon,
    x, y,
    hp: cfg.hp,
    maxHp: cfg.hp,
    damage: cfg.damage,
    speed: cfg.speed,
    attackRange: cfg.attackRange,
    attackRate: cfg.attackRate,
    state: 'idle',
    currentAnim: getAnimName(weapon, 'idle'),
    target: null,
    attackCooldown: 0,
    attackTimer: 0,
    hasDamaged: false,
    facingLeft: false,
    deathTimer: 0,
  };
}

/** Create a merged fighter from two same-weapon fighters */
export function mergeFighters(a: Fighter, b: Fighter): Fighter {
  const result = MERGE_RECIPES[a.weapon];
  if (!result) throw new Error(`No merge recipe for ${a.weapon}`);

  const spine = createFighterSpine(result);
  const cat = WEAPON_DEFS[result].category;
  const baseCfg = cat === 'melee' ? MELEE : RANGED;

  // Position: midpoint
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;

  // Stats: sum HP and damage, speed/range from weapon def
  const hp = a.maxHp + b.maxHp;
  const damage = a.damage + b.damage;

  return {
    spine,
    weapon: result,
    x, y,
    hp,
    maxHp: hp,
    damage,
    speed: baseCfg.speed,
    attackRange: baseCfg.attackRange,
    attackRate: baseCfg.attackRate,
    state: 'idle',
    currentAnim: getAnimName(result, 'idle'),
    target: null,
    attackCooldown: 0,
    attackTimer: 0,
    hasDamaged: false,
    facingLeft: false,
    deathTimer: 0,
  };
}

/* ── Animation helper ─────────────────────────────── */

function playAnim(f: Fighter, anim: 'idle' | 'run' | 'attack' | 'death', loop: boolean): void {
  const name = getAnimName(f.weapon, anim);
  if (f.currentAnim === name) return;
  f.currentAnim = name;
  f.spine.state.setAnimation(0, name, loop);
}

/* ── AI Update ────────────────────────────────────── */

export function updateFighter(
  f: Fighter,
  mobs: MobRef[],
  baseX: number,
  baseY: number,
  detectRange: number,
  dt: number,
): number {
  let damageDealt = 0;

  if (f.state === 'dead') {
    f.deathTimer -= dt;
    return 0;
  }

  if (f.target && (f.target.hp <= 0 || f.target.dying)) {
    f.target = null;
  }

  switch (f.state) {
    case 'idle': {
      const mob = findNearest(f, mobs, detectRange);
      if (mob) {
        f.target = mob;
        f.state = 'run';
        playAnim(f, 'run', true);
      } else {
        playAnim(f, 'idle', true);
      }
      break;
    }

    case 'run': {
      if (!f.target || f.target.hp <= 0 || f.target.dying) {
        f.target = null;
        f.state = 'return';
        playAnim(f, 'run', true);
        break;
      }

      const dx = f.target.x - f.x;
      const dy = f.target.y - f.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= f.attackRange) {
        f.state = 'attack';
        f.attackTimer = 0;
        f.hasDamaged = false;
        playAnim(f, 'attack', true);
      } else {
        f.facingLeft = dx < 0;
        [f.x, f.y] = moveWithAvoidance(f.x, f.y, f.target.x, f.target.y, f.speed, dt, baseX, baseY);
      }
      break;
    }

    case 'attack': {
      if (f.target && f.target.hp > 0 && !f.target.dying) {
        f.facingLeft = f.target.x < f.x;
      }

      f.attackTimer += dt;

      const cat = WEAPON_DEFS[f.weapon].category;
      const dmgPoint = cat === 'melee' ? f.attackRate * 0.5 : f.attackRate * 0.8;
      if (!f.hasDamaged && f.attackTimer >= dmgPoint) {
        f.hasDamaged = true;
        if (f.target && f.target.hp > 0 && !f.target.dying) {
          damageDealt = f.damage;
        }
      }

      if (f.attackTimer >= f.attackRate) {
        const targetDead = !f.target || f.target.hp <= 0 || f.target.dying;
        let outOfRange = false;
        if (!targetDead && f.target) {
          const dx = f.target.x - f.x;
          const dy = f.target.y - f.y;
          outOfRange = Math.sqrt(dx * dx + dy * dy) > f.attackRange * 1.3;
        }

        if (targetDead || outOfRange) {
          const mob = findNearest(f, mobs, detectRange);
          if (mob) {
            f.target = mob;
            f.state = 'run';
            playAnim(f, 'run', true);
          } else {
            f.target = null;
            f.state = 'return';
            playAnim(f, 'run', true);
          }
        } else {
          f.attackTimer = 0;
          f.hasDamaged = false;
        }
      }
      break;
    }

    case 'return': {
      const dx = baseX - f.x;
      const dy = baseY - f.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const mob = findNearest(f, mobs, detectRange);
      if (mob) {
        f.target = mob;
        f.state = 'run';
        playAnim(f, 'run', true);
        break;
      }

      if (dist < BASE.collisionR + 10) {
        f.state = 'idle';
        playAnim(f, 'idle', true);
      } else {
        f.facingLeft = dx < 0;
        [f.x, f.y] = moveWithAvoidance(f.x, f.y, baseX, baseY, f.speed, dt, baseX, baseY);
      }
      break;
    }
  }

  return damageDealt;
}

/* ── Drawing ──────────────────────────────────────── */

export function drawFighter(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  scale: number,
  dt: number,
): void {
  drawSpine(ctx, f.spine, f.x, f.y, scale, f.facingLeft, dt);
}

/* ── Helpers ──────────────────────────────────────── */

function clampOutsideBase(x: number, y: number, baseX: number, baseY: number, r: number): [number, number] {
  const dx = x - baseX;
  const dy = y - baseY;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < r) {
    const nx = d > 0.1 ? dx / d : 1;
    const ny = d > 0.1 ? dy / d : 0;
    return [baseX + nx * r, baseY + ny * r];
  }
  return [x, y];
}

export function moveWithAvoidance(
  x: number, y: number,
  tx: number, ty: number,
  speed: number, dt: number,
  baseX: number, baseY: number,
): [number, number] {
  const avoidR = BASE.collisionR + 4;

  const dx = tx - x;
  const dy = ty - y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return [x, y];

  const step = Math.min(speed * dt, dist);
  let nx = x + (dx / dist) * step;
  let ny = y + (dy / dist) * step;

  const dbx = nx - baseX;
  const dby = ny - baseY;
  const dBase = Math.sqrt(dbx * dbx + dby * dby);

  if (dBase < avoidR) {
    const cx = x - baseX;
    const cy = y - baseY;
    const cd = Math.sqrt(cx * cx + cy * cy);
    if (cd > 0.1) {
      const radNx = cx / cd;
      const radNy = cy / cd;
      const t1x = -radNy, t1y = radNx;
      const dot = t1x * dx + t1y * dy;
      const tDirX = dot >= 0 ? t1x : -t1x;
      const tDirY = dot >= 0 ? t1y : -t1y;

      nx = x + tDirX * step;
      ny = y + tDirY * step;
    }

    [nx, ny] = clampOutsideBase(nx, ny, baseX, baseY, avoidR);
  }

  return [nx, ny];
}

function findNearest(f: Fighter, mobs: MobRef[], range: number): MobRef | null {
  let best: MobRef | null = null;
  let bestDist = Infinity;
  const isMelee = WEAPON_DEFS[f.weapon].category === 'melee';

  for (const m of mobs) {
    if (m.hp <= 0 || m.dying) continue;
    // Melee can't target flying mobs
    if (isMelee && m.flying) continue;
    const dx = m.x - f.x;
    const dy = m.y - f.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist && d < range * range) {
      best = m;
      bestDist = d;
    }
  }

  return best;
}
