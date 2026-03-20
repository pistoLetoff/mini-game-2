import { SCREEN, S } from './screen';
import { BASE, DOG, BAT, BEAR, COIN, WAVE, COLORS, MELEE, RANGED, VISUALS, FIGHTER_COST, MAX_FIGHTERS, DRAGON_COST, DRAGON_DAMAGE, DRAGON_COOLDOWN } from './balance';

import { finger, tap, resetInput } from './input';
import { getSprite } from './assets';
import {
  createSpriteInstance,
  drawSpriteInstance,
  setAnimation,
  type SpriteInstance,
} from './sprite-anim';
import { initSpineRenderer } from './spine-loader';
import {
  createFighter,
  mergeFighters,
  updateFighter,
  drawFighter,
  moveWithAvoidance,
  WEAPON_DEFS,
  MERGE_RECIPES,
  type Fighter,
  type MobRef,
  type WeaponType,
} from './fighter';

/* ── Types ──────────────────────────────────────── */

type MobType = 'dog' | 'bat' | 'bear';

interface Mob {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  angle: number;
  facingLeft: boolean;
  sprite: SpriteInstance;
  attacking: boolean;
  attackTimer: number;
  dying: boolean;
  deathTimer: number;
  flashTimer: number;
  stars: number;
  damage: number;
  mobType: MobType;
  flying: boolean;
  attackRate: number;
  hitRadius: number;
  coinsDrop: [number, number];
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  target: Mob;
  aoe: boolean;
  pierce: boolean;
  angle: number;
  hitMobs: Set<Mob>;
}

interface VfxInstance {
  sprite: SpriteInstance;
  x: number;
  y: number;
  scale: number;
}

interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  collected: boolean;
}

interface DragonAbility {
  active: boolean;
  timer: number;       // total elapsed
  duration: number;    // how long the full animation lasts
  sprite: SpriteInstance;
  damageApplied: boolean;
  fireY: number;       // current fire beam Y end (sweeps down)
}

interface MergeOption {
  weapon: WeaponType;
  result: WeaponType;
  count: number; // how many of this weapon exist
}

type GameState = 'menu' | 'playing' | 'merging' | 'gameover';

/* ── Game ───────────────────────────────────────── */

export class Game {
  private ctx: CanvasRenderingContext2D;
  private hud: CanvasRenderingContext2D;
  private gameCanvas: HTMLCanvasElement;
  private hudCanvas: HTMLCanvasElement;

  // State
  private state: GameState = 'menu';
  private baseHp = BASE.maxHp;
  private lastDt = 1 / 60;

  // Entities
  private mobs: Mob[] = [];
  private fighters: Fighter[] = [];
  private projectiles: Projectile[] = [];
  private vfx: VfxInstance[] = [];
  private coins: Coin[] = [];

  // Wave
  private wave = 1;
  private mobsToSpawn = 0;
  private spawnTimer = 0;
  private spawnInterval = WAVE.baseSpawnInterval;
  private waveTimer = 0;
  private waveActive = false;

  // Player
  private gold = 0;

  // Merge
  private mergeOptions: MergeOption[] = [];

  // Dragon ability
  private dragon: DragonAbility | null = null;
  private dragonCooldown: number = DRAGON_COOLDOWN; // starts on cooldown

  constructor(
    gameCanvas: HTMLCanvasElement,
    hudCanvas: HTMLCanvasElement,
  ) {
    this.gameCanvas = gameCanvas;
    this.hudCanvas = hudCanvas;
    this.ctx = gameCanvas.getContext('2d')!;
    this.hud = hudCanvas.getContext('2d')!;
    initSpineRenderer(this.ctx);
  }

  private get tX(): number { return SCREEN.w / 2; }
  private get tY(): number { return SCREEN.h / 2; }

  /* ── State transitions ─────────────────────────── */

  private startGame(): void {
    this.state = 'playing';
    this.baseHp = BASE.maxHp;
    this.gold = 0;
    this.wave = 1;
    this.mobs = [];
    this.fighters = [];
    this.projectiles = [];
    this.coins = [];
    this.dragon = null;
    this.dragonCooldown = DRAGON_COOLDOWN;

    // Start with one free melee fighter (fist)
    const f = createFighter('fist', this.tX - 60, this.tY + 30);
    this.fighters.push(f);

    this.startWave();
  }

  private startWave(): void {
    this.waveActive = true;
    this.mobsToSpawn = WAVE.baseMobCount + (this.wave - 1) * WAVE.mobCountGrowth;
    this.spawnInterval = Math.max(
      WAVE.minSpawnInterval,
      WAVE.baseSpawnInterval * Math.pow(WAVE.spawnAccel, this.wave - 1),
    );
    this.spawnTimer = 0;
  }

  /* ── Buy fighters ──────────────────────────────── */

  private tryBuyFighter(weapon: 'fist' | 'revolver'): void {
    if (this.fighters.filter(f => f.state !== 'dead').length >= MAX_FIGHTERS) return;
    if (this.gold < FIGHTER_COST) return;
    this.gold -= FIGHTER_COST;

    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 15;
    const x = this.tX + Math.cos(angle) * dist;
    const y = this.tY + Math.sin(angle) * dist;

    this.fighters.push(createFighter(weapon, x, y));
  }

  /* ── Dragon ability ────────────────────────────── */

  private activateDragon(): void {
    if (this.dragonCooldown > 0) return;  // still on cooldown
    if (this.dragon?.active) return; // already active
    this.dragonCooldown = DRAGON_COOLDOWN;

    this.dragon = {
      active: true,
      timer: 0,
      duration: 2.0,
      sprite: createSpriteInstance('dragon', 'attack', 24, false),
      damageApplied: false,
      fireY: 0,
    };
  }

  private updateDragon(dt: number): void {
    if (this.dragonCooldown > 0) this.dragonCooldown -= dt;

    const d = this.dragon;
    if (!d || !d.active) return;

    d.timer += dt;

    // Apply damage once mid-animation (~frame 20 of 41)
    if (!d.damageApplied && d.timer >= 0.8) {
      d.damageApplied = true;
      for (const m of this.mobs) {
        if (m.dying) continue;
        m.hp -= DRAGON_DAMAGE;
        m.flashTimer = 0.2;
        if (m.hp <= 0 && !m.dying) {
          m.dying = true;
          m.deathTimer = 0.5;
          m.speed = 0;
        }
      }
    }

    if (d.timer >= d.duration) {
      d.active = false;
      this.dragon = null;
    }
  }

  /* ── Merge ─────────────────────────────────────── */

  private computeMergeOptions(): MergeOption[] {
    const counts = new Map<WeaponType, number>();
    for (const f of this.fighters) {
      if (f.state === 'dead') continue;
      counts.set(f.weapon, (counts.get(f.weapon) || 0) + 1);
    }

    const options: MergeOption[] = [];
    for (const [weapon, count] of counts) {
      const result = MERGE_RECIPES[weapon];
      if (result && count >= 2) {
        options.push({ weapon, result, count });
      }
    }
    return options;
  }

  private executeMerge(opt: MergeOption): void {
    // Find two alive fighters with this weapon
    let a: Fighter | null = null;
    let b: Fighter | null = null;
    for (const f of this.fighters) {
      if (f.state === 'dead' || f.weapon !== opt.weapon) continue;
      if (!a) { a = f; continue; }
      if (!b) { b = f; break; }
    }
    if (!a || !b) return;

    const merged = mergeFighters(a, b);

    // Remove the two source fighters
    this.fighters = this.fighters.filter(f => f !== a && f !== b);
    this.fighters.push(merged);

    this.state = 'playing';
  }

  /* ── Update ────────────────────────────────────── */

  update(dt: number): void {
    if (this.state === 'menu') {
      if (tap.hit) this.startGame();
      resetInput();
      return;
    }

    if (this.state === 'gameover') {
      if (tap.hit) this.state = 'menu';
      resetInput();
      return;
    }

    if (this.state === 'merging') {
      this.handleMergeInput();
      resetInput();
      return;
    }

    // Playing
    this.lastDt = dt;
    this.handleBuyInput();
    this.updateSpawning(dt);
    this.updateMobs(dt);
    this.updateFighters(dt);
    this.updateProjectiles(dt);
    this.separateEntities();
    this.updateCoins(dt);
    this.updateDragon(dt);
    this.checkWaveEnd();

    if (this.baseHp <= 0) {
      this.state = 'gameover';
    }

    resetInput();
  }

  private handleBuyInput(): void {
    if (!tap.hit) return;

    const btnSize = S(50);
    const gap = S(10);
    const totalW = 4 * btnSize + 3 * gap;
    const startX = (SCREEN.w - totalW) / 2;
    const btnY = SCREEN.h - btnSize - S(20);

    // Merge button
    if (tap.x >= startX && tap.x <= startX + btnSize &&
        tap.y >= btnY && tap.y <= btnY + btnSize) {
      const opts = this.computeMergeOptions();
      if (opts.length > 0) {
        this.mergeOptions = opts;
        this.state = 'merging';
      }
      return;
    }

    // Melee button
    const mx = startX + btnSize + gap;
    if (tap.x >= mx && tap.x <= mx + btnSize &&
        tap.y >= btnY && tap.y <= btnY + btnSize) {
      this.tryBuyFighter('fist');
      return;
    }

    // Ranged button
    const rx = mx + btnSize + gap;
    if (tap.x >= rx && tap.x <= rx + btnSize &&
        tap.y >= btnY && tap.y <= btnY + btnSize) {
      this.tryBuyFighter('revolver');
      return;
    }

    // Dragon button
    const dx = rx + btnSize + gap;
    if (tap.x >= dx && tap.x <= dx + btnSize &&
        tap.y >= btnY && tap.y <= btnY + btnSize) {
      this.activateDragon();
      return;
    }
  }

  private handleMergeInput(): void {
    if (!tap.hit) return;

    const W = SCREEN.w;
    const H = SCREEN.h;
    const cardW = S(140);
    const cardH = S(60);
    const gap = S(10);
    const totalH = this.mergeOptions.length * (cardH + gap) - gap;
    const startY = H / 2 - totalH / 2;

    for (let i = 0; i < this.mergeOptions.length; i++) {
      const cx = (W - cardW) / 2;
      const cy = startY + i * (cardH + gap);
      if (tap.x >= cx && tap.x <= cx + cardW && tap.y >= cy && tap.y <= cy + cardH) {
        this.executeMerge(this.mergeOptions[i]);
        return;
      }
    }

    // Close button (top right) or tap outside
    const closeX = W / 2 + cardW / 2 + S(10);
    const closeY = startY - S(40);
    if (tap.y < startY - S(5) || tap.y > startY + totalH + S(5) ||
        tap.x < (W - cardW) / 2 - S(20) || tap.x > (W + cardW) / 2 + S(20)) {
      this.state = 'playing';
    }
  }

  private updateSpawning(dt: number): void {
    if (!this.waveActive || this.mobsToSpawn <= 0) return;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnMob();
      this.mobsToSpawn--;
      this.spawnTimer = this.spawnInterval;
    }
  }

  private pickMobType(): MobType {
    // Wave 1-2: dogs only. Wave 3+: bats+bears.
    const roll = Math.random();
    if (this.wave >= 3 && roll < 0.15) return 'bear';
    if (this.wave >= 3 && roll < 0.40) return 'bat';
    return 'dog';
  }

  private spawnMob(): void {
    const W = SCREEN.w;
    const margin = 20;
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -margin : W + margin;
    const maxDy = Math.abs(x - this.tX);
    const y = this.tY + (Math.random() * 2 - 1) * maxDy;

    const angle = Math.atan2(this.tY - y, this.tX - x);

    // Calculate stars based on wave
    let stars = 0;
    for (const threshold of WAVE.starWaves) {
      if (this.wave >= threshold) stars++;
    }

    const mobType = this.pickMobType();
    const stats = mobType === 'bear' ? BEAR : mobType === 'bat' ? BAT : DOG;

    const starMul = Math.pow(2, stars);
    const hpMul = (1 + (this.wave - 1) * WAVE.hpScale) * starMul;
    const speedMul = 1 + (this.wave - 1) * WAVE.speedScale;

    const spriteKey = mobType === 'bat' ? 'bat' : mobType === 'bear' ? 'bear' : 'dog';

    this.mobs.push({
      x, y,
      hp: Math.ceil(stats.hp * hpMul),
      maxHp: Math.ceil(stats.hp * hpMul),
      speed: stats.speed * speedMul,
      angle,
      facingLeft: this.tX < x,
      sprite: createSpriteInstance(spriteKey, 'run', 12, true),
      attacking: false,
      attackTimer: 0,
      dying: false,
      deathTimer: 0,
      flashTimer: 0,
      stars,
      damage: stats.damage * starMul,
      mobType,
      flying: mobType === 'bat',
      attackRate: stats.attackRate,
      hitRadius: stats.hitRadius,
      coinsDrop: stats.coinsDrop,
    });
  }

  private updateMobs(dt: number): void {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];

      if (m.dying) {
        m.deathTimer -= dt;
        if (m.deathTimer <= 0) {
          this.onMobDeath(m);
          this.mobs.splice(i, 1);
        }
        continue;
      }

      // Find nearest alive fighter to target
      let targetX = this.tX;
      let targetY = this.tY;
      let targetFighter: Fighter | null = null;
      let nearestDist = Infinity;

      for (const f of this.fighters) {
        if (f.state === 'dead') continue;
        const fdx = f.x - m.x;
        const fdy = f.y - m.y;
        const fd = fdx * fdx + fdy * fdy;
        if (fd < nearestDist) {
          nearestDist = fd;
          targetX = f.x;
          targetY = f.y;
          targetFighter = f;
        }
      }

      const dx = targetX - m.x;
      const dy = targetY - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Reached target → start attacking
      const hitDist = m.hitRadius;
      if (dist < hitDist && !m.attacking) {
        m.attacking = true;
        m.attackTimer = m.attackRate;
        m.speed = 0;
        setAnimation(m.sprite, 'attack', true);
      }

      if (m.attacking) {
        m.attackTimer += dt;
        if (m.attackTimer >= m.attackRate) {
          m.attackTimer = 0;
          if (targetFighter && targetFighter.state !== 'dead') {
            targetFighter.hp -= m.damage;
            if (targetFighter.hp <= 0) {
              targetFighter.state = 'dead';
              targetFighter.deathTimer = 1.0;
            }
          } else if (!targetFighter) {
            this.baseHp -= m.damage;
          }

          const fDead = targetFighter && targetFighter.state === 'dead';
          if (fDead || !targetFighter) {
            let newTarget: Fighter | null = null;
            let nd = Infinity;
            for (const ff of this.fighters) {
              if (ff.state === 'dead') continue;
              const fdx = ff.x - m.x;
              const fdy = ff.y - m.y;
              const fd2 = fdx * fdx + fdy * fdy;
              if (fd2 < nd) { nd = fd2; newTarget = ff; }
            }
            if (newTarget && nd < m.hitRadius * m.hitRadius * 4) {
              targetFighter = newTarget;
              targetX = newTarget.x;
              targetY = newTarget.y;
            } else if (!newTarget) {
              targetFighter = null;
            } else {
              m.attacking = false;
              const baseSpeed = m.mobType === 'bear' ? BEAR.speed : m.mobType === 'bat' ? BAT.speed : DOG.speed;
              m.speed = baseSpeed * (1 + (this.wave - 1) * WAVE.speedScale);
              setAnimation(m.sprite, 'run', true);
            }
          }
        }
        continue;
      }

      m.facingLeft = dx < 0;
      if (targetFighter) {
        const [nx, ny] = moveWithAvoidance(m.x, m.y, targetX, targetY, m.speed, dt, this.tX, this.tY);
        m.angle = Math.atan2(ny - m.y, nx - m.x);
        m.x = nx;
        m.y = ny;
      } else {
        const step = Math.min(m.speed * dt, dist);
        if (dist > 0.1) {
          m.x += (dx / dist) * step;
          m.y += (dy / dist) * step;
        }
        m.angle = Math.atan2(dy, dx);
      }
    }
  }

  private updateFighters(dt: number): void {
    const detectRange = BASE.range;

    for (let i = this.fighters.length - 1; i >= 0; i--) {
      const f = this.fighters[i];

      if (f.state === 'dead') {
        f.deathTimer -= dt;
        if (f.deathTimer <= 0) {
          this.fighters.splice(i, 1);
        }
        continue;
      }

      const dmg = updateFighter(f, this.mobs as MobRef[], this.tX, this.tY, detectRange, dt);

      if (dmg > 0 && f.target) {
        const def = WEAPON_DEFS[f.weapon];

        if (def.category === 'ranged') {
          // Ranged: spawn projectile(s)
          const mob = f.target as Mob;
          const pdx = mob.x - f.x;
          const pdy = mob.y - f.y;
          const pd = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pd > 0.1) {
            const bulletCount = def.multiBullet || 1;
            const baseAngle = Math.atan2(pdy, pdx);
            const spread = bulletCount > 1 ? 0.1 : 0; // ~5.7 degrees

            for (let b = 0; b < bulletCount; b++) {
              const offset = bulletCount > 1 ? (b - (bulletCount - 1) / 2) * spread : 0;
              const angle = baseAngle + offset;
              this.projectiles.push({
                x: f.x,
                y: f.y,
                vx: Math.cos(angle) * RANGED.bulletSpeed,
                vy: Math.sin(angle) * RANGED.bulletSpeed,
                damage: dmg / bulletCount,
                target: mob,
                aoe: def.aoe || false,
                pierce: f.weapon === 'crossbow',
                angle,
                hitMobs: new Set(),
              });
            }
          }
        } else {
          // Melee: instant damage to target(s)
          const targets: Mob[] = [f.target as Mob];
          const multiTarget = def.multiTarget || 1;

          // Find additional targets for katana
          if (multiTarget > 1) {
            for (const m of this.mobs) {
              if (targets.length >= multiTarget) break;
              if (m === f.target || m.dying || m.hp <= 0 || m.flying) continue;
              const mdx = m.x - f.x;
              const mdy = m.y - f.y;
              if (Math.sqrt(mdx * mdx + mdy * mdy) <= f.attackRange * 1.5) {
                targets.push(m);
              }
            }
          }

          for (const mob of targets) {
            mob.hp -= dmg;
            mob.flashTimer = 0.12;
            if (mob.hp <= 0 && !mob.dying) {
              mob.dying = true;
              mob.deathTimer = 0.5;
              mob.speed = 0;
            }
          }
        }
      }
    }
  }

  private damageMob(m: Mob, damage: number): void {
    m.hp -= damage;
    m.flashTimer = 0.12;
    if (m.hp <= 0 && !m.dying) {
      m.dying = true;
      m.deathTimer = 0.5;
      m.speed = 0;
    }
  }

  private spawnExplosionVfx(x: number, y: number): void {
    this.vfx.push({
      sprite: createSpriteInstance('explosion', 'boom', 20, false),
      x, y,
      scale: S(1.2),
    });
  }

  private updateProjectiles(dt: number): void {
    const W = SCREEN.w;
    const H = SCREEN.h;
    const hitR = RANGED.bulletHitRadius;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) {
        this.projectiles.splice(i, 1);
        continue;
      }

      let remove = false;
      for (const m of this.mobs) {
        if (m.dying || p.hitMobs.has(m)) continue;
        const dx = p.x - m.x;
        const dy = p.y - m.y;
        if (dx * dx + dy * dy < hitR * hitR) {
          if (p.aoe) {
            // Bazooka: AoE damage + explosion VFX
            const aoeR = RANGED.bazookaAoeRadius;
            for (const m2 of this.mobs) {
              if (m2.dying) continue;
              const adx = p.x - m2.x;
              const ady = p.y - m2.y;
              if (adx * adx + ady * ady < aoeR * aoeR) {
                this.damageMob(m2, p.damage);
              }
            }
            this.spawnExplosionVfx(p.x, p.y);
            remove = true;
            break;
          } else if (p.pierce) {
            // Crossbow: pierce through, damage this mob, continue
            p.hitMobs.add(m);
            this.damageMob(m, p.damage);
          } else {
            this.damageMob(m, p.damage);
            remove = true;
            break;
          }
        }
      }

      if (remove) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update VFX
    for (let i = this.vfx.length - 1; i >= 0; i--) {
      if (this.vfx[i].sprite.done) {
        this.vfx.splice(i, 1);
      }
    }
  }

  private separateEntities(): void {
    const MIN_DIST = VISUALS.separationDist;

    for (let i = 0; i < this.fighters.length; i++) {
      const a = this.fighters[i];
      if (a.state === 'dead') continue;
      for (let j = i + 1; j < this.fighters.length; j++) {
        const b = this.fighters[j];
        if (b.state === 'dead') continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MIN_DIST && dist > 0.1) {
          const push = (MIN_DIST - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        } else if (dist <= 0.1) {
          a.x -= 5;
          b.x += 5;
        }
      }
    }

    for (let i = 0; i < this.mobs.length; i++) {
      const a = this.mobs[i];
      if (a.dying) continue;
      for (let j = i + 1; j < this.mobs.length; j++) {
        const b = this.mobs[j];
        if (b.dying) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MIN_DIST && dist > 0.1) {
          const push = (MIN_DIST - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }

    // Push fighters out of base
    const baseR = BASE.collisionR;
    for (const f of this.fighters) {
      if (f.state === 'dead') continue;
      const dx = f.x - this.tX;
      const dy = f.y - this.tY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < baseR && d > 0.1) {
        f.x = this.tX + (dx / d) * baseR;
        f.y = this.tY + (dy / d) * baseR;
      }
    }
    // Push mobs out of base (only if they're chasing fighters, not base)
    for (const m of this.mobs) {
      if (m.dying || m.attacking) continue;
      const hasAliveFighter = this.fighters.some(ff => ff.state !== 'dead');
      if (!hasAliveFighter) continue;
      const dx = m.x - this.tX;
      const dy = m.y - this.tY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < baseR && d > 0.1) {
        m.x = this.tX + (dx / d) * baseR;
        m.y = this.tY + (dy / d) * baseR;
      }
    }
  }

  private onMobDeath(m: Mob): void {
    const count = m.coinsDrop[0] + Math.floor(Math.random() * (m.coinsDrop[1] - m.coinsDrop[0] + 1));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * COIN.scatter;
      this.coins.push({
        x: m.x + Math.cos(angle) * dist,
        y: m.y + Math.sin(angle) * dist,
        vx: Math.cos(angle) * 60,
        vy: Math.sin(angle) * 60,
        age: 0,
        collected: false,
      });
    }
  }

  private updateCoins(dt: number): void {
    const magnetR = COIN.magnetRadius;

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.age += dt;

      if (c.age > COIN.lifetime) {
        this.coins.splice(i, 1);
        continue;
      }

      c.vx *= 0.95;
      c.vy *= 0.95;
      c.x += c.vx * dt;
      c.y += c.vy * dt;

      if (finger.active) {
        const dx = finger.x - c.x;
        const dy = finger.y - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < magnetR) {
          const speed = COIN.magnetSpeed * (1 - dist / magnetR);
          c.x += (dx / dist) * speed * dt;
          c.y += (dy / dist) * speed * dt;

          if (dist < 15) {
            this.gold++;
            this.coins.splice(i, 1);
          }
        }
      }
    }
  }

  private checkWaveEnd(): void {
    if (this.waveActive && this.mobsToSpawn <= 0 && this.mobs.length === 0) {
      this.waveActive = false;
      this.wave++;
      this.waveTimer = WAVE.wavePause;
    }

    if (!this.waveActive) {
      this.waveTimer -= 1 / 60;
      if (this.waveTimer <= 0) {
        this.startWave();
      }
    }
  }

  /* ── Draw ──────────────────────────────────────── */

  draw(): void {
    const ctx = this.ctx;
    const hud = this.hud;
    const W = SCREEN.w;
    const H = SCREEN.h;
    const dpr = SCREEN.dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W * dpr, H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    hud.setTransform(1, 0, 0, 1, 0, 0);
    hud.clearRect(0, 0, W * dpr, H * dpr);
    hud.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const gridSize = S(40);
    for (let x = 0; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    if (this.state === 'menu') {
      this.drawMenu(hud, W, H);
      return;
    }

    // Base range indicator
    ctx.beginPath();
    ctx.arc(this.tX, this.tY, BASE.range, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Coins
    this.drawCoins(ctx);

    // Base
    this.drawBase(ctx);

    // Mobs
    this.drawMobs(ctx);

    // Fighters
    this.drawFighters(ctx);

    // Projectiles
    this.drawProjectiles(ctx);

    // Dragon ability
    this.drawDragon(ctx);

    // HUD
    this.drawHUD(hud, W, H);

    // Buy buttons
    this.drawBuyButtons(hud);

    if (this.state === 'merging') {
      this.drawMergeOverlay(hud, W, H);
    }

    if (this.state === 'gameover') {
      this.drawGameOver(hud, W, H);
    }
  }

  private drawBase(ctx: CanvasRenderingContext2D): void {
    const size = S(BASE.size);
    const r = size / 2;

    ctx.save();
    ctx.translate(this.tX, this.tY);

    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#2a3a4a';
    ctx.strokeStyle = COLORS.neonCyan;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  private drawMobs(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (const m of this.mobs) {
      // Per-mob sprite scale based on type
      const targetH = m.mobType === 'bear' ? S(65) : m.mobType === 'bat' ? S(30) : S(VISUALS.mobTargetH);
      const origH = m.mobType === 'bear' ? 760 : m.mobType === 'bat' ? 776 : 494;
      const origW = m.mobType === 'bear' ? 1048 : m.mobType === 'bat' ? 600 : 622;
      const spriteScale = targetH / origH;
      const drawW = origW * spriteScale;
      const drawH = targetH;

      if (!m.attacking) {
        const hSpeed = Math.abs(Math.cos(m.angle)) * m.speed;
        m.sprite.fps = Math.max(8, hSpeed * 0.2);
      } else {
        m.sprite.fps = 16;
      }

      if (m.flashTimer > 0) m.flashTimer -= this.lastDt;

      // Bats float above ground
      const drawY = m.flying ? m.y - S(30) : m.y;
      drawSpriteInstance(ctx, m.sprite, m.x, drawY, spriteScale, m.facingLeft, this.lastDt);

      // White flash on hit
      if (m.flashTimer > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = m.flashTimer / 0.12;
        drawSpriteInstance(ctx, m.sprite, m.x, drawY, spriteScale, m.facingLeft, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      // HP bar (always visible)
      if (!m.dying) {
        const barW = drawW * 0.5;
        const barH = S(4);
        const barY = drawY - drawH * 0.32 - S(6);

        ctx.fillStyle = COLORS.hpBarBg;
        ctx.fillRect(m.x - barW / 2, barY, barW, barH);

        ctx.fillStyle = COLORS.hpBar;
        ctx.fillRect(m.x - barW / 2, barY, barW * (m.hp / m.maxHp), barH);

        // Stars below HP bar (left-aligned)
        if (m.stars > 0) {
          ctx.fillStyle = '#ff6633';
          ctx.font = `bold ${S(7)}px sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText('★'.repeat(m.stars), m.x - barW / 2, barY + barH + S(8));
        }
      }
    }
  }

  private drawFighters(ctx: CanvasRenderingContext2D): void {
    const spineScale = VISUALS.spineScale;

    for (const f of this.fighters) {
      drawFighter(ctx, f, spineScale, this.lastDt);

      // HP bar above fighter (always visible)
      if (f.state !== 'dead') {
        const barW = S(30);
        const barH = S(3);
        const barY = f.y - 1000 * spineScale - S(4);

        ctx.fillStyle = COLORS.hpBarBg;
        ctx.fillRect(f.x - barW / 2, barY, barW, barH);

        ctx.fillStyle = '#44ff44';
        ctx.fillRect(f.x - barW / 2, barY, barW * (f.hp / f.maxHp), barH);

        // Stars below HP bar (left-aligned)
        const tier = WEAPON_DEFS[f.weapon].tier;
        if (tier > 0) {
          ctx.fillStyle = '#ffcc00';
          ctx.font = `bold ${S(7)}px sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText('★'.repeat(tier), f.x - barW / 2, barY + barH + S(8));
        }
      }
    }
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D): void {
    const r = S(RANGED.bulletSize);
    for (const p of this.projectiles) {
      if (p.pierce) {
        // Crossbow: elongated bolt
        const len = S(12);
        const w = S(2);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = '#ddeeff';
        ctx.shadowColor = '#88ccff';
        ctx.shadowBlur = 6;
        ctx.fillRect(-len / 2, -w / 2, len, w);
        ctx.shadowBlur = 0;
        ctx.restore();
      } else if (p.aoe) {
        // Bazooka: fiery projectile
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 100, 30, 0.25)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6622';
        ctx.fill();
      } else {
        // Revolver: standard bullet
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 220, 80, 0.15)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffdd55';
        ctx.fill();
      }
    }

    // Draw explosion VFX
    for (const v of this.vfx) {
      drawSpriteInstance(ctx, v.sprite, v.x, v.y, v.scale, false, this.lastDt);
    }
  }

  private drawDragon(ctx: CanvasRenderingContext2D): void {
    const d = this.dragon;
    if (!d || !d.active) return;

    const W = SCREEN.w;
    const centerX = W / 2;
    const scale = S(0.44);

    // Fade in/out
    const fadeIn = Math.min(d.timer / 0.2, 1);
    const fadeOut = d.timer > d.duration - 0.3 ? Math.max(0, (d.duration - d.timer) / 0.3) : 1;
    ctx.save();
    ctx.globalAlpha = fadeIn * fadeOut;

    // Rotate 90° clockwise so dragon faces down, mouth centered horizontally
    const H = SCREEN.h;
    ctx.translate(centerX + S(60), H * 0.35);
    ctx.rotate(Math.PI / 2);

    // Draw sprite at origin (rotated context: x→down, y→left)
    drawSpriteInstance(ctx, d.sprite, 0, 0, scale, false, this.lastDt);

    ctx.restore();
  }

  private drawCoins(ctx: CanvasRenderingContext2D): void {
    const sprite = getSprite('coin');
    const size = S(COIN.size);

    for (const c of this.coins) {
      const alpha = c.age > COIN.lifetime - 2 ? (COIN.lifetime - c.age) / 2 : 1;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, c.x - size / 2, c.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  /* ── Buy Buttons ─────────────────────────────────── */

  private drawBuyButtons(hud: CanvasRenderingContext2D): void {
    if (this.state !== 'playing' && this.state !== 'merging') return;

    const btnSize = S(50);
    const gap = S(10);
    const totalW = 4 * btnSize + 3 * gap;
    const startX = (SCREEN.w - totalW) / 2;
    const btnY = SCREEN.h - btnSize - S(20);

    const aliveCount = this.fighters.filter(f => f.state !== 'dead').length;
    const canBuy = this.gold >= FIGHTER_COST && aliveCount < MAX_FIGHTERS;
    const hasMerge = this.computeMergeOptions().length > 0;

    // Merge button
    this.drawBuyBtn(hud, startX, btnY, btnSize, '🔀', 'Merge', 0, hasMerge);

    // Melee button
    this.drawBuyBtn(hud, startX + btnSize + gap, btnY, btnSize, '👊', 'Melee', FIGHTER_COST, canBuy);

    // Ranged button
    this.drawBuyBtn(hud, startX + 2 * (btnSize + gap), btnY, btnSize, '🔫', 'Range', FIGHTER_COST, canBuy);

    // Dragon button (cooldown-based)
    const dragonReady = this.dragonCooldown <= 0 && !this.dragon?.active;
    const dragonX = startX + 3 * (btnSize + gap);
    this.drawBuyBtn(hud, dragonX, btnY, btnSize, '🐉', 'Dragon', 0, dragonReady);
    if (!dragonReady && !this.dragon?.active) {
      // Draw cooldown timer overlay
      hud.font = `bold ${S(10)}px monospace`;
      hud.fillStyle = COLORS.text;
      hud.textAlign = 'center';
      hud.fillText(`${Math.ceil(this.dragonCooldown)}s`, dragonX + btnSize / 2, btnY + btnSize * 0.85);
    }

    // Fighter count
    hud.fillStyle = COLORS.text;
    hud.font = `bold ${S(10)}px monospace`;
    hud.textAlign = 'center';
    hud.fillText(`${aliveCount}/${MAX_FIGHTERS}`, SCREEN.w / 2, btnY - S(5));
  }

  private drawBuyBtn(
    hud: CanvasRenderingContext2D,
    x: number, y: number, size: number,
    icon: string, label: string, cost: number, canAfford: boolean,
  ): void {
    hud.globalAlpha = canAfford ? 1 : 0.4;

    hud.fillStyle = '#1a2a3a';
    hud.strokeStyle = canAfford ? COLORS.neonCyan : '#555';
    hud.lineWidth = S(2);
    this.roundRect(hud, x, y, size, size, S(8));
    hud.fill();
    hud.stroke();

    hud.font = `${S(18)}px sans-serif`;
    hud.textAlign = 'center';
    hud.fillStyle = COLORS.text;
    hud.fillText(icon, x + size / 2, y + size * 0.4);

    hud.font = `bold ${S(8)}px monospace`;
    hud.fillStyle = COLORS.text;
    hud.fillText(label, x + size / 2, y + size * 0.65);

    if (cost > 0) {
      hud.font = `bold ${S(9)}px monospace`;
      hud.fillStyle = COLORS.gold;
      hud.fillText(`$${cost}`, x + size / 2, y + size * 0.85);
    }

    hud.globalAlpha = 1;
  }

  /* ── Merge Overlay ─────────────────────────────── */

  private drawMergeOverlay(hud: CanvasRenderingContext2D, W: number, H: number): void {
    hud.fillStyle = 'rgba(0,0,0,0.7)';
    hud.fillRect(0, 0, W, H);

    hud.fillStyle = COLORS.neonCyan;
    hud.font = `bold ${S(24)}px monospace`;
    hud.textAlign = 'center';
    hud.fillText('MERGE', W / 2, H / 2 - S(110));

    const cardW = S(140);
    const cardH = S(60);
    const gap = S(10);
    const totalH = this.mergeOptions.length * (cardH + gap) - gap;
    const startY = H / 2 - totalH / 2;

    for (let i = 0; i < this.mergeOptions.length; i++) {
      const opt = this.mergeOptions[i];
      const cx = (W - cardW) / 2;
      const cy = startY + i * (cardH + gap);

      hud.fillStyle = '#1a2a3a';
      hud.strokeStyle = COLORS.neonCyan;
      hud.lineWidth = S(2);
      this.roundRect(hud, cx, cy, cardW, cardH, S(8));
      hud.fill();
      hud.stroke();

      const srcDef = WEAPON_DEFS[opt.weapon];
      const dstDef = WEAPON_DEFS[opt.result];

      // Source name
      hud.fillStyle = COLORS.text;
      hud.font = `bold ${S(13)}px monospace`;
      hud.textAlign = 'center';
      hud.fillText(
        `${srcDef.name} + ${srcDef.name}`,
        cx + cardW / 2,
        cy + cardH * 0.35,
      );

      // Arrow + result
      hud.fillStyle = COLORS.gold;
      hud.font = `bold ${S(12)}px monospace`;
      hud.fillText(
        `→ ${dstDef.name} ${'★'.repeat(dstDef.tier)}`,
        cx + cardW / 2,
        cy + cardH * 0.7,
      );
    }

    // Close hint
    hud.fillStyle = '#888';
    hud.font = `${S(11)}px monospace`;
    hud.fillText('tap outside to close', W / 2, startY + totalH + S(30));
  }

  /* ── HUD ───────────────────────────────────────── */

  private drawHUD(hud: CanvasRenderingContext2D, W: number, H: number): void {
    // HP bar (top)
    const barW = S(200);
    const barH = S(14);
    const barX = (W - barW) / 2;
    const barY = S(20);

    hud.fillStyle = COLORS.hpBarBg;
    this.roundRect(hud, barX, barY, barW, barH, S(4));
    hud.fill();

    hud.fillStyle = COLORS.hpBar;
    this.roundRect(hud, barX, barY, barW * Math.max(0, this.baseHp / BASE.maxHp), barH, S(4));
    hud.fill();

    hud.fillStyle = COLORS.text;
    hud.font = `bold ${S(12)}px monospace`;
    hud.textAlign = 'center';
    hud.fillText(`HP ${Math.ceil(this.baseHp)}/${BASE.maxHp}`, W / 2, barY + barH - S(2));

    // Gold
    hud.fillStyle = COLORS.gold;
    hud.font = `bold ${S(18)}px monospace`;
    hud.textAlign = 'right';
    hud.fillText(`$${this.gold}`, W - S(15), S(30));

    // Wave
    hud.fillStyle = COLORS.neonCyan;
    hud.textAlign = 'left';
    hud.fillText(`W${this.wave}`, S(15), S(30));
  }

  private drawMenu(hud: CanvasRenderingContext2D, W: number, H: number): void {
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, W, H);

    hud.fillStyle = COLORS.neonCyan;
    hud.font = `bold ${S(36)}px monospace`;
    hud.textAlign = 'center';
    hud.fillText('TOWER', W / 2, H / 2 - S(60));
    hud.fillStyle = COLORS.neonPink;
    hud.fillText('DEFENSE', W / 2, H / 2 - S(20));

    hud.fillStyle = COLORS.text;
    hud.font = `bold ${S(18)}px monospace`;
    hud.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 400);
    hud.fillText('TAP TO START', W / 2, H / 2 + S(60));
    hud.globalAlpha = 1;
  }

  private drawGameOver(hud: CanvasRenderingContext2D, W: number, H: number): void {
    hud.fillStyle = 'rgba(0,0,0,0.8)';
    hud.fillRect(0, 0, W, H);

    hud.fillStyle = COLORS.hpBar;
    hud.font = `bold ${S(32)}px monospace`;
    hud.textAlign = 'center';
    hud.fillText('GAME OVER', W / 2, H / 2 - S(40));

    hud.fillStyle = COLORS.text;
    hud.font = `bold ${S(18)}px monospace`;
    hud.fillText(`Wave ${this.wave}`, W / 2, H / 2 + S(10));
    hud.fillText(`Gold: ${this.gold}`, W / 2, H / 2 + S(40));

    hud.fillStyle = '#aaa';
    hud.font = `${S(14)}px monospace`;
    hud.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 400);
    hud.fillText('TAP TO RESTART', W / 2, H / 2 + S(90));
    hud.globalAlpha = 1;
  }

  /* ── Helpers ───────────────────────────────────── */

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
