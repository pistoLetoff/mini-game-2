/* ── Game balance constants ──────────────────────── */

export const BASE = {
  /** Detection range radius (fighters react to mobs inside this) */
  range: 160,
  /** Base sprite size */
  size: 64,
  /** HP */
  maxHp: 10,
};

export const FIGHTER = {
  /** Cost to buy a fighter */
  cost: 5,
  /** Visual scale for Spine characters */
  spineScale: 0.05,
  /** Mob sprite scale (targetH in px) */
  mobTargetH: 56,
  melee: {
    hp: 8,
    damage: 1.5,
    speed: 120,
    /** Px from target to start attacking */
    attackRange: 35,
    /** Seconds between attacks */
    attackRate: 0.8,
  },
  ranged: {
    hp: 5,
    damage: 0.7,
    speed: 80,
    /** Px from target — slightly beyond BASE.range so ranged stays outside */
    attackRange: 180,
    /** Seconds between attacks */
    attackRate: 0.8,
  },
};

export const MOB = {
  /** Base speed px/s */
  speed: 100,
  /** Base HP */
  hp: 3,
  /** Sprite width */
  width: 32,
  /** Sprite height */
  height: 40,
  /** Coins dropped on death */
  coinsDrop: [1, 3] as [number, number],
  /** XP given on death */
  xp: 1,
  /** Damage to base on contact */
  damage: 1,
  /** Distance from base center to count as "reached" */
  hitRadius: 30,
};

export const COIN = {
  /** Size in pixels */
  size: 16,
  /** Magnet attraction radius from finger */
  magnetRadius: 60,
  /** Speed when attracted px/s */
  magnetSpeed: 300,
  /** Lifetime before fade (seconds) */
  lifetime: 8,
  /** Scatter distance from mob death position */
  scatter: 30,
};

export const XP_ORB = {
  size: 12,
  /** Auto-collect radius (always magnetic) */
  magnetRadius: 80,
  magnetSpeed: 250,
  lifetime: 10,
  scatter: 20,
};

export const WAVE = {
  /** Seconds between spawns at wave 1 */
  baseSpawnInterval: 1.5,
  /** Min spawn interval */
  minSpawnInterval: 0.3,
  /** How much faster spawns get per wave */
  spawnAccel: 0.95,
  /** Mob HP multiplier per wave */
  hpScale: 0.15,
  /** Mob speed increase per wave */
  speedScale: 0.03,
  /** Seconds between waves */
  wavePause: 3,
  /** Base mob count per wave */
  baseMobCount: 5,
  /** Additional mobs per wave */
  mobCountGrowth: 2,
};

export const LEVEL = {
  /** XP needed for level 2 */
  baseXp: 5,
  /** XP growth per level */
  xpGrowth: 3,
  /** Number of perk choices */
  perkChoices: 3,
};

export const COLORS = {
  bg: '#1a1a2e',
  bgGround: '#16213e',
  neonCyan: '#00e5ff',
  neonPink: '#ff006e',
  neonGreen: '#ccff00',
  hpBar: '#ff4444',
  hpBarBg: '#333',
  xpBar: '#00e5ff',
  xpBarBg: '#1a3a4a',
  gold: '#ffcc00',
  text: '#ffffff',
  textShadow: '#000000',
};
