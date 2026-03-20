/**
 * ═══════════════════════════════════════════════════
 *  GAME BALANCE — All tunable parameters in one place
 * ═══════════════════════════════════════════════════
 */

/* ── BASE (fortress in center) ─────────────────── */

export const BASE = {
  range: 160,        // detection radius — fighters react to mobs inside this
  size: 58,          // visual size px
  collisionR: 34,    // circular collision radius
  maxHp: 10,
};

/* ── FIGHTER GLOBAL ───────────────────────────── */

export const FIGHTER_COST = 5;   // gold to buy tier-0
export const MAX_FIGHTERS = 5;
export const DRAGON_COST = 30;
export const DRAGON_DAMAGE = 50;

/* ── MELEE BASE (tier 0 = fist) ───────────────── */

export const MELEE = {
  hp: 8,
  damage: 1.5,
  speed: 120,
  attackRange: 35,
  attackRate: 0.8,
};

/* ── RANGED BASE (tier 0 = revolver) ──────────── */

export const RANGED = {
  hp: 5,
  damage: 0.7,
  speed: 80,
  attackRange: 180,
  attackRate: 0.8,
  bulletSpeed: 300,
  bulletSize: 1.5,
  bulletHitRadius: 10,
  bazookaAoeRadius: 60,
};

/* ── DOG (enemy mob) ───────────────────────────── */

export const DOG = {
  speed: 100,
  hp: 1,
  damage: 1,
  attackRate: 0.7,
  hitRadius: 30,
  coinsDrop: [1, 3] as [number, number],
};

/* ── BAT (flying enemy — melee can't hit) ─────── */

export const BAT = {
  speed: 130,
  hp: 1,
  damage: 1,
  attackRate: 0.5,
  hitRadius: 25,
  coinsDrop: [1, 2] as [number, number],
  flying: true,
};

/* ── BEAR (tank enemy — slow, tanky, heavy hits) ── */

export const BEAR = {
  speed: 50,
  hp: 6,
  damage: 2,
  attackRate: 1.2,
  hitRadius: 35,
  coinsDrop: [3, 5] as [number, number],
};

/* ── VISUALS ───────────────────────────────────── */

export const VISUALS = {
  spineScale: 0.045,
  mobTargetH: 50,
  separationDist: 20,
};

/* ── COINS ─────────────────────────────────────── */

export const COIN = {
  size: 16,
  magnetRadius: 90,
  magnetSpeed: 600,
  lifetime: 8,
  scatter: 30,
};

/* ── WAVES ─────────────────────────────────────── */

export const WAVE = {
  baseSpawnInterval: 1.5,
  minSpawnInterval: 0.3,
  spawnAccel: 0.95,
  hpScale: 0.15,
  speedScale: 0.03,
  wavePause: 3,
  baseMobCount: 5,
  mobCountGrowth: 2,
  starWaves: [5, 10, 15] as number[], // waves at which mobs gain 1/2/3 stars
};

/* ── COLORS ────────────────────────────────────── */

export const COLORS = {
  bg: '#1a1a2e',
  bgGround: '#16213e',
  neonCyan: '#00e5ff',
  neonPink: '#ff006e',
  neonGreen: '#ccff00',
  hpBar: '#ff4444',
  hpBarBg: '#333',
  gold: '#ffcc00',
  text: '#ffffff',
  textShadow: '#000000',
};
