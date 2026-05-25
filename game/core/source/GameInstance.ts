/**
 * MegaBonk 3D Roguelike Survivor - Core Game Instance
 * Pure game logic — NO Three.js or rendering imports.
 */

import type {
  GameConfig,
  GameState,
  GameResult,
  InputState,
  PlayerState,
  EnemyState,
  ProjectileState,
  PickupState,
  BossState,
  DamageEvent,
  UpgradeOption,
  GamePhase,
  EnemyType,
  EnemyBehavior,
  WeaponState,
  GameStats,
  BossPhase,
  BossAttack,
  PickupType,
} from './types.ts';

import {
  TICK_INTERVAL_MS,
  MAX_ENEMIES,
  MAX_PROJECTILES,
  MAX_PICKUPS,
  PLAYER_BASE_HP,
  PLAYER_BASE_SPEED,
  PLAYER_BASE_CRIT_CHANCE,
  PLAYER_BASE_CRIT_DAMAGE,
  PLAYER_PICKUP_RADIUS,
  PLAYER_INVINCIBLE_DURATION,
  DASH_DISTANCE,
  DASH_DURATION,
  DASH_COOLDOWN,
  JUMP_FORCE,
  GRAVITY,
  SLIDE_DURATION,
  SLIDE_SPEED_MULTIPLIER,
  BOSS_SPAWN_TIME,
  BOSS_HP,
  BOSS_INTRO_DURATION,
  PICKUP_LIFETIME,
  PICKUP_ATTRACT_SPEED,
  XP_VALUES,
  ENEMY_CONFIGS,
  WAVE_CONFIGS,
  WEAPON_STATS,
} from './config.ts';

import { applyMovement3D, distanceBetween, normalizeDirection } from './physics.ts';
import { SpatialHash } from './spatial-hash.ts';
import { generateUpgradeOptions, xpForLevel } from './upgrades.ts';

export class GameInstance {
  private config: GameConfig;
  private state: GameState;
  private currentInput: InputState;
  private nextEnemyId: number;
  private nextProjectileId: number;
  private nextPickupId: number;
  private spatialHash: SpatialHash;
  private spawnTimer: number;
  private aiGroup: number;

  // Track last input for dash edge-detection
  private lastDashInput: boolean = false;
  // Player facing direction for projectile aiming
  private facingX: number = 0;
  private facingZ: number = 1;

  constructor(config: GameConfig) {
    this.config = config;
    this.currentInput = { moveX: 0, moveY: 0, dash: false, skill1: false, skill2: false, jump: false, slide: false };
    this.nextEnemyId = 1;
    this.nextProjectileId = 1;
    this.nextPickupId = 1;
    this.spatialHash = new SpatialHash(4);
    this.spawnTimer = 1.0;
    this.aiGroup = 0;

    this.state = {
      tick: 0,
      gameTime: 0,
      running: false,
      paused: false,
      finished: false,
      phase: 'menu',
      player: this.createInitialPlayer(),
      enemies: [],
      projectiles: [],
      pickups: [],
      boss: null,
      upgradeOptions: null,
      damageEvents: [],
      stats: { killCount: 0, damageDealt: 0, damageTaken: 0, silverEarned: 0 },
      waveIndex: 0,
    };
  }

  start(): void {
    this.state.running = true;
    this.state.paused = false;
    this.state.finished = false;
    this.state.phase = 'playing';
    this.state.gameTime = 0;
    this.state.tick = 0;
    this.state.enemies = [];
    this.state.projectiles = [];
    this.state.pickups = [];
    this.state.damageEvents = [];
    this.state.boss = null;
    this.state.upgradeOptions = null;
    this.state.stats = { killCount: 0, damageDealt: 0, damageTaken: 0, silverEarned: 0 };
    this.state.waveIndex = 0;
    this.state.player = this.createInitialPlayer();
    this.nextEnemyId = 1;
    this.nextProjectileId = 1;
    this.nextPickupId = 1;
    this.spawnTimer = 1.0;
    this.aiGroup = 0;
  }

  tick(): boolean {
    // Step 1: If paused or not running, return
    if (!this.state.running || this.state.finished || this.state.paused) {
      return this.state.finished;
    }

    // During level-up, halt game logic
    if (this.state.phase === 'level_up') {
      return false;
    }

    // Boss intro countdown
    if (this.state.phase === 'boss_intro') {
      const dt = TICK_INTERVAL_MS / 1000;
      this.state.gameTime += dt;
      this.state.tick++;
      if (this.state.boss) {
        this.state.boss.attackTimer -= dt;
        if (this.state.boss.attackTimer <= 0) {
          this.state.phase = 'boss_fight';
        }
      }
      return false;
    }

    const dt = TICK_INTERVAL_MS / 1000;

    // Step 2: Increment gameTime
    this.state.gameTime += dt;
    this.state.tick++;

    // Step 3: Process player movement
    this.processPlayerMovement(dt);

    // Step 4: Process dash
    this.processDash(dt);

    // Step 5: Update timers
    this.updateTimers(dt);

    // Step 6: Update enemies AI
    this.updateEnemiesAI(dt);

    // Step 7: Fire weapons
    this.fireWeapons(dt);

    // Step 8: Update projectiles
    this.updateProjectiles(dt);

    // Step 9: Collision detection
    this.processCollisions();

    // Step 10: Process deaths
    this.processDeaths();

    // Step 11: Update pickups
    this.updatePickups(dt);

    // Step 12: Check level up
    this.checkLevelUp();

    // Step 13: Spawn enemies
    this.spawnEnemies(dt);

    // Step 14: Check boss spawn
    this.checkBossSpawn();

    // Step 15: Update boss AI
    if (this.state.boss && this.state.phase === 'boss_fight') {
      this.updateBossAI(dt);
    }

    // Step 16: Check game over
    this.checkGameOver();

    // Step 17: Clear old damage events
    this.state.damageEvents = [];

    // Cycle AI group
    this.aiGroup = (this.aiGroup + 1) % 4;

    return this.state.finished;
  }

  applyAction(input: InputState): void {
    this.currentInput = input;
  }

  selectUpgrade(optionId: string): void {
    if (this.state.phase !== 'level_up' || !this.state.upgradeOptions) return;

    const option = this.state.upgradeOptions.find(o => o.id === optionId);
    if (!option) return;

    const player = this.state.player;

    switch (option.kind) {
      case 'new_weapon':
        if (option.weaponType) {
          player.weapons.push({
            type: option.weaponType,
            level: 1,
            cooldownTimer: 0,
          });
        }
        break;

      case 'weapon_upgrade':
        if (option.weaponType) {
          const weapon = player.weapons.find(w => w.type === option.weaponType);
          if (weapon) {
            weapon.level = option.newLevel;
          }
        }
        break;

      case 'passive':
        if (option.passiveType) {
          const existing = player.passives.find(p => p.type === option.passiveType);
          if (existing) {
            existing.level = option.newLevel;
          } else {
            player.passives.push({ type: option.passiveType!, level: option.newLevel });
          }
          this.recalculatePassiveStats();
        }
        break;
    }

    // Clear upgrade state and resume
    this.state.upgradeOptions = null;
    this.state.phase = this.state.boss ? 'boss_fight' : 'playing';
  }

  pause(): void {
    if (this.state.running && !this.state.finished) {
      this.state.paused = true;
    }
  }

  resume(): void {
    this.state.paused = false;
  }

  getState(): GameState {
    return this.state;
  }

  getResult(): GameResult {
    return {
      victory: this.state.phase === 'victory',
      survivalTime: this.state.gameTime,
      killCount: this.state.stats.killCount,
      level: this.state.player.level,
      silverEarned: this.state.stats.silverEarned,
    };
  }

  // =========================================================================
  // Private: Initialization
  // =========================================================================

  private createInitialPlayer(): PlayerState {
    return {
      x: 0,
      y: 0,
      z: 0,
      rotation: 0,
      velocityY: 0,
      isGrounded: true,
      isJumping: false,
      isSliding: false,
      slideTimer: 0,
      slideSpeedBoost: 0,
      hp: PLAYER_BASE_HP,
      maxHp: PLAYER_BASE_HP,
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(1),
      speed: PLAYER_BASE_SPEED,
      damageMultiplier: 1.0,
      attackSpeedMultiplier: 1.0,
      critChance: PLAYER_BASE_CRIT_CHANCE,
      critDamage: PLAYER_BASE_CRIT_DAMAGE,
      armor: 0,
      pickupRadius: PLAYER_PICKUP_RADIUS,
      weapons: [{ type: 'bone_bouncer', level: 1, cooldownTimer: 0 }],
      passives: [],
      dashCooldown: 0,
      dashCooldownMax: DASH_COOLDOWN,
      dashTimer: 0,
      invincibleTimer: 0,
      alive: true,
    };
  }

  // =========================================================================
  // Private: Player Movement & Dash
  // =========================================================================

  private processPlayerMovement(dt: number): void {
    const player = this.state.player;
    if (!player.alive) return;
    if (player.dashTimer > 0) return; // Dash handles its own movement

    const moveX = this.currentInput.moveX;
    const moveZ = this.currentInput.moveY; // moveY maps to Z axis in 3D

    // Update facing direction
    if (moveX !== 0 || moveZ !== 0) {
      this.facingX = moveX;
      this.facingZ = moveZ;
      player.rotation = Math.atan2(moveX, moveZ);
    }

    // --- Jump ---
    if (this.currentInput.jump && player.isGrounded && !player.isSliding) {
      player.velocityY = JUMP_FORCE;
      player.isGrounded = false;
      player.isJumping = true;
    }

    // --- Gravity ---
    if (!player.isGrounded) {
      player.velocityY -= GRAVITY * dt;
      player.y += player.velocityY * dt;

      // Ground collision (terrain height = 0 for flat areas)
      const groundHeight = this.getTerrainHeight(player.x, player.z);
      if (player.y <= groundHeight) {
        player.y = groundHeight;
        player.velocityY = 0;
        player.isGrounded = true;
        player.isJumping = false;

        // Landing → slide if holding slide input (MegaBonk slide mechanic)
        if (this.currentInput.slide && !player.isSliding) {
          player.isSliding = true;
          player.slideTimer = SLIDE_DURATION;
          player.slideSpeedBoost = SLIDE_SPEED_MULTIPLIER;
        }
      }
    }

    // --- Slide ---
    if (this.currentInput.slide && player.isGrounded && !player.isSliding && !player.isJumping) {
      player.isSliding = true;
      player.slideTimer = SLIDE_DURATION;
      player.slideSpeedBoost = SLIDE_SPEED_MULTIPLIER;
    }

    if (player.isSliding) {
      player.slideTimer -= dt;
      if (player.slideTimer <= 0) {
        player.isSliding = false;
        player.slideSpeedBoost = 0;
      }
    }

    // --- Horizontal movement ---
    const speedMultiplier = player.isSliding ? player.slideSpeedBoost : 1.0;
    const result = applyMovement3D(
      player.x, player.z,
      moveX, moveZ,
      player.speed * speedMultiplier, dt,
      this.config.mapSize,
    );

    if (result) {
      player.x = result.x;
      player.z = result.z;
    }
  }

  /** Get terrain height at position — platform-based (flat + ramps) */
  private getTerrainHeight(x: number, z: number): number {
    // MegaBonk style: flat platforms at different heights connected by ramps
    // Define platforms as rectangles: [centerX, centerZ, halfWidth, halfDepth, height]
    const platforms: [number, number, number, number, number][] = [
      // Central arena (ground level)
      [0, 0, 25, 25, 0],
      // Elevated platforms around edges
      [-35, -30, 12, 10, 3],
      [35, -30, 12, 10, 3],
      [-35, 30, 12, 10, 3],
      [35, 30, 12, 10, 3],
      // Higher platforms
      [0, -40, 10, 8, 5],
      [0, 40, 10, 8, 5],
      // Medium platforms
      [-25, 0, 8, 12, 2],
      [25, 0, 8, 12, 2],
      // Small elevated spots
      [-15, -20, 5, 5, 1.5],
      [15, -20, 5, 5, 1.5],
      [-15, 20, 5, 5, 1.5],
      [15, 20, 5, 5, 1.5],
    ];

    let height = 0;
    for (const [cx, cz, hw, hd, h] of platforms) {
      const dx = Math.abs(x - cx);
      const dz = Math.abs(z - cz);

      // On platform
      if (dx <= hw && dz <= hd) {
        height = Math.max(height, h);
      }
      // Ramp zone (within 3 units of platform edge)
      else if (dx <= hw + 3 && dz <= hd + 3) {
        const edgeDist = Math.max(dx - hw, dz - hd, 0);
        if (edgeDist <= 3) {
          const rampHeight = h * (1 - edgeDist / 3);
          height = Math.max(height, rampHeight);
        }
      }
    }
    return height;
  }

  private processDash(dt: number): void {
    const player = this.state.player;
    if (!player.alive) return;

    // Edge-detect dash press
    const dashPressed = this.currentInput.dash && !this.lastDashInput;
    this.lastDashInput = this.currentInput.dash;

    if (dashPressed && player.dashCooldown <= 0 && player.dashTimer <= 0) {
      player.dashTimer = DASH_DURATION;
      player.dashCooldown = DASH_COOLDOWN;
      player.invincibleTimer = DASH_DURATION;
    }

    // Process active dash movement
    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      const dashSpeed = DASH_DISTANCE / DASH_DURATION;
      const dir = normalizeDirection(this.facingX, this.facingZ);

      const result = applyMovement3D(
        player.x, player.z,
        dir.x, dir.z,
        dashSpeed, dt,
        this.config.mapSize,
      );

      if (result) {
        player.x = result.x;
        player.z = result.z;
      }
    }
  }

  // =========================================================================
  // Private: Timer Updates
  // =========================================================================

  private updateTimers(dt: number): void {
    const player = this.state.player;
    if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    if (player.invincibleTimer > 0) player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);

    // Enemy timers
    for (const enemy of this.state.enemies) {
      if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
      if (enemy.attackCooldown > 0) enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    }

    // Boss hit flash
    if (this.state.boss && this.state.boss.hitFlashTimer > 0) {
      this.state.boss.hitFlashTimer = Math.max(0, this.state.boss.hitFlashTimer - dt);
    }
  }

  // =========================================================================
  // Private: Enemy AI
  // =========================================================================

  private updateEnemiesAI(dt: number): void {
    const player = this.state.player;
    const enemies = this.state.enemies;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];

      // Only 1/4 of enemies recalculate AI each frame (performance)
      if ((i % 4) === this.aiGroup) {
        this.computeEnemyTarget(enemy, player);
      }

      // ALL enemies move every tick
      this.moveEnemy(enemy, dt);
    }
  }

  private computeEnemyTarget(enemy: EnemyState, player: PlayerState): void {
    const px = player.x;
    const pz = player.z;
    const dist = distanceBetween(enemy.x, enemy.z, px, pz);
    const cfg = ENEMY_CONFIGS[enemy.type];

    switch (enemy.behavior) {
      case 'chase':
        enemy.targetX = px;
        enemy.targetZ = pz;
        break;

      case 'ranged': {
        const preferredRange = cfg?.preferredRange ?? 8;
        if (dist < preferredRange) {
          // Move away from player
          const dir = normalizeDirection(enemy.x - px, enemy.z - pz);
          enemy.targetX = enemy.x + dir.x * 4;
          enemy.targetZ = enemy.z + dir.z * 4;
        } else if (dist > preferredRange * 1.5) {
          // Move toward player
          enemy.targetX = px;
          enemy.targetZ = pz;
        } else {
          // Stay put
          enemy.targetX = enemy.x;
          enemy.targetZ = enemy.z;
        }
        break;
      }

      case 'swarm': {
        const offsetX = (Math.random() - 0.5) * 4;
        const offsetZ = (Math.random() - 0.5) * 4;
        enemy.targetX = px + offsetX;
        enemy.targetZ = pz + offsetZ;
        break;
      }

      case 'charge':
        enemy.targetX = px;
        enemy.targetZ = pz;
        break;

      case 'dive':
        enemy.targetX = px;
        enemy.targetZ = pz;
        break;
    }
  }

  private moveEnemy(enemy: EnemyState, dt: number): void {
    const dx = enemy.targetX - enemy.x;
    const dz = enemy.targetZ - enemy.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.1) return;

    let speedMult = 1.0;
    if (enemy.behavior === 'charge') speedMult = 2.0;
    else if (enemy.behavior === 'dive') speedMult = 1.5;

    const moveSpeed = enemy.speed * speedMult * dt;
    const actualMove = Math.min(moveSpeed, dist);
    const nx = dx / dist;
    const nz = dz / dist;

    // Enemies can roam slightly outside map bounds
    const halfMap = (this.config.mapSize + 10) * 0.5;
    enemy.x = Math.max(-halfMap, Math.min(halfMap, enemy.x + nx * actualMove));
    enemy.z = Math.max(-halfMap, Math.min(halfMap, enemy.z + nz * actualMove));
  }

  // =========================================================================
  // Private: Weapons
  // =========================================================================

  private fireWeapons(dt: number): void {
    const player = this.state.player;
    if (!player.alive) return;

    for (const weapon of player.weapons) {
      weapon.cooldownTimer -= dt * player.attackSpeedMultiplier;
      if (weapon.cooldownTimer <= 0) {
        const stats = this.getWeaponStats(weapon);
        weapon.cooldownTimer = stats.cooldown;
        this.fireWeapon(weapon, stats);
      }
    }
  }

  private fireWeapon(weapon: WeaponState, stats: typeof WEAPON_STATS['bone_bouncer'][0]): void {
    switch (weapon.type) {
      case 'bone_bouncer':
        this.fireBoneBouncer(stats);
        break;
      case 'lightning_staff':
        this.fireLightningStaff(stats);
        break;
      case 'flame_ring':
        this.fireFlameRing(stats);
        break;
      case 'void_orb':
        this.fireVoidOrb(stats);
        break;
    }
  }

  private fireBoneBouncer(stats: typeof WEAPON_STATS['bone_bouncer'][0]): void {
    const player = this.state.player;
    const extraProj = this.getExtraProjectileCount();
    const count = stats.projectileCount + extraProj;

    for (let i = 0; i < count; i++) {
      if (this.state.projectiles.length >= MAX_PROJECTILES) break;

      // Aim at nearest enemy
      const target = this.findNearestEnemy(player.x, player.z);
      let vx: number, vz: number;

      if (target) {
        const dir = normalizeDirection(target.x - player.x, target.z - player.z);
        vx = dir.x * stats.speed;
        vz = dir.z * stats.speed;
      } else {
        vx = Math.sin(player.rotation) * stats.speed;
        vz = Math.cos(player.rotation) * stats.speed;
      }

      // Spread for multiple projectiles
      if (count > 1) {
        const angle = ((i - (count - 1) / 2) * 0.25);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const nvx = vx * cos - vz * sin;
        const nvz = vx * sin + vz * cos;
        vx = nvx;
        vz = nvz;
      }

      const isCrit = Math.random() < player.critChance;
      const damage = Math.round(stats.damage * player.damageMultiplier * (isCrit ? player.critDamage : 1));

      this.state.projectiles.push({
        id: this.nextProjectileId++,
        weaponType: 'bone_bouncer',
        x: player.x,
        y: 1.0,
        z: player.z,
        vx, vy: 0, vz,
        damage,
        bouncesLeft: stats.bounces,
        pierceLeft: 0,
        lifetime: 4.0,
        radius: 0.4,
        fromPlayer: true,
        hitEnemyIds: [],
      });
    }
  }

  private fireLightningStaff(stats: typeof WEAPON_STATS['lightning_staff'][0]): void {
    const player = this.state.player;

    // Find nearest enemy in range
    const target = this.findNearestEnemy(player.x, player.z, stats.range);
    if (!target) return;

    // Damage first target
    const isCrit = Math.random() < player.critChance;
    const damage = Math.round(stats.damage * player.damageMultiplier * (isCrit ? player.critDamage : 1));
    target.hp -= damage;
    target.hitFlashTimer = 0.15;
    this.state.stats.damageDealt += damage;
    this.addDamageEvent(target.x, 1.5, target.z, damage, isCrit, false);
    this.applyLifesteal(damage);

    // Chain to nearby enemies
    const hitIds = new Set<number>([target.id]);
    let currentX = target.x;
    let currentZ = target.z;
    let chainsLeft = stats.chains - 1;

    while (chainsLeft > 0) {
      let nearestDist = stats.range * 0.6;
      let nearestEnemy: EnemyState | null = null;

      for (const enemy of this.state.enemies) {
        if (hitIds.has(enemy.id) || enemy.hp <= 0) continue;
        const dist = distanceBetween(currentX, currentZ, enemy.x, enemy.z);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = enemy;
        }
      }

      if (!nearestEnemy) break;

      const chainCrit = Math.random() < player.critChance;
      const chainDmg = Math.round(stats.damage * player.damageMultiplier * 0.7 * (chainCrit ? player.critDamage : 1));
      nearestEnemy.hp -= chainDmg;
      nearestEnemy.hitFlashTimer = 0.15;
      this.state.stats.damageDealt += chainDmg;
      this.addDamageEvent(nearestEnemy.x, 1.5, nearestEnemy.z, chainDmg, chainCrit, false);
      this.applyLifesteal(chainDmg);

      hitIds.add(nearestEnemy.id);
      currentX = nearestEnemy.x;
      currentZ = nearestEnemy.z;
      chainsLeft--;
    }

    // Also hit boss if in range and not already targeted
    if (this.state.boss && this.state.boss.hp > 0 && chainsLeft > 0) {
      const bossDist = distanceBetween(currentX, currentZ, this.state.boss.x, this.state.boss.z);
      if (bossDist < stats.range) {
        const bossCrit = Math.random() < player.critChance;
        const bossDmg = Math.round(stats.damage * player.damageMultiplier * 0.7 * (bossCrit ? player.critDamage : 1));
        this.state.boss.hp -= bossDmg;
        this.state.boss.hitFlashTimer = 0.15;
        this.state.stats.damageDealt += bossDmg;
        this.addDamageEvent(this.state.boss.x, 2, this.state.boss.z, bossDmg, bossCrit, false);
      }
    }
  }

  private fireFlameRing(stats: typeof WEAPON_STATS['flame_ring'][0]): void {
    const player = this.state.player;
    const px = player.x;
    const pz = player.z;

    // Damage all enemies in AOE radius
    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0) continue;
      const dist = distanceBetween(px, pz, enemy.x, enemy.z);
      if (dist <= stats.aoeRadius) {
        const isCrit = Math.random() < player.critChance;
        const damage = Math.round(stats.damage * player.damageMultiplier * (isCrit ? player.critDamage : 1));
        enemy.hp -= damage;
        enemy.hitFlashTimer = 0.1;
        this.state.stats.damageDealt += damage;
        this.addDamageEvent(enemy.x, 1.0, enemy.z, damage, isCrit, false);
        this.applyLifesteal(damage);
      }
    }

    // Also damage boss if in range
    if (this.state.boss && this.state.boss.hp > 0) {
      const dist = distanceBetween(px, pz, this.state.boss.x, this.state.boss.z);
      if (dist <= stats.aoeRadius) {
        const isCrit = Math.random() < player.critChance;
        const damage = Math.round(stats.damage * player.damageMultiplier * (isCrit ? player.critDamage : 1));
        this.state.boss.hp -= damage;
        this.state.boss.hitFlashTimer = 0.15;
        this.state.stats.damageDealt += damage;
        this.addDamageEvent(this.state.boss.x, 2, this.state.boss.z, damage, isCrit, false);
      }
    }
  }

  private fireVoidOrb(stats: typeof WEAPON_STATS['void_orb'][0]): void {
    const player = this.state.player;
    const extraProj = this.getExtraProjectileCount();
    const count = stats.projectileCount + extraProj;

    for (let i = 0; i < count; i++) {
      if (this.state.projectiles.length >= MAX_PROJECTILES) break;

      let angle = player.rotation;
      if (count > 1) {
        const spread = Math.PI * 0.4;
        angle = player.rotation + ((i - (count - 1) / 2) / Math.max(1, count - 1)) * spread;
      }

      const vx = Math.sin(angle) * stats.speed;
      const vz = Math.cos(angle) * stats.speed;

      const isCrit = Math.random() < player.critChance;
      const damage = Math.round(stats.damage * player.damageMultiplier * (isCrit ? player.critDamage : 1));

      this.state.projectiles.push({
        id: this.nextProjectileId++,
        weaponType: 'void_orb',
        x: player.x,
        y: 1.0,
        z: player.z,
        vx, vy: 0, vz,
        damage,
        bouncesLeft: 0,
        pierceLeft: stats.pierce,
        lifetime: 5.0,
        radius: stats.aoeRadius,
        fromPlayer: true,
        hitEnemyIds: [],
      });
    }
  }

  // =========================================================================
  // Private: Projectiles
  // =========================================================================

  private updateProjectiles(dt: number): void {
    const projectiles = this.state.projectiles;
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.z += proj.vz * dt;
      proj.lifetime -= dt;

      if (proj.lifetime <= 0) {
        projectiles.splice(i, 1);
        continue;
      }

      // Remove if out of bounds
      const halfMap = (this.config.mapSize + 20) * 0.5;
      if (Math.abs(proj.x) > halfMap || Math.abs(proj.z) > halfMap) {
        projectiles.splice(i, 1);
      }
    }
  }

  // =========================================================================
  // Private: Collision Detection
  // =========================================================================

  private processCollisions(): void {
    const player = this.state.player;
    const enemies = this.state.enemies;

    // Step 9a: Insert all enemies into spatial hash
    this.spatialHash.clear();
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      this.spatialHash.insert(enemy.id, enemy.x, enemy.z, 0.5);
    }
    // Insert boss
    if (this.state.boss && this.state.boss.hp > 0) {
      this.spatialHash.insert(-1, this.state.boss.x, this.state.boss.z, 1.5);
    }

    // Step 9b: Player projectiles vs enemies
    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      const proj = this.state.projectiles[i];
      if (!proj.fromPlayer) continue;

      const nearbyIds = this.spatialHash.query(proj.x, proj.z, proj.radius);
      let consumed = false;

      for (const id of nearbyIds) {
        if (proj.hitEnemyIds.includes(id)) continue;

        // Boss collision
        if (id === -1 && this.state.boss && this.state.boss.hp > 0) {
          this.state.boss.hp -= proj.damage;
          this.state.boss.hitFlashTimer = 0.15;
          this.state.stats.damageDealt += proj.damage;
          this.addDamageEvent(this.state.boss.x, 2, this.state.boss.z, proj.damage, false, false);
          proj.hitEnemyIds.push(id);
          this.applyLifesteal(proj.damage);

          if (proj.pierceLeft > 0) {
            proj.pierceLeft--;
            continue;
          }
          consumed = true;
          break;
        }

        // Enemy collision
        const enemy = this.findEnemyById(id);
        if (!enemy || enemy.hp <= 0) continue;

        enemy.hp -= proj.damage;
        enemy.hitFlashTimer = 0.15;
        this.state.stats.damageDealt += proj.damage;
        this.addDamageEvent(enemy.x, 1.0, enemy.z, proj.damage, false, false);
        proj.hitEnemyIds.push(id);
        this.applyLifesteal(proj.damage);

        // Handle bone_bouncer bounce
        if (proj.weaponType === 'bone_bouncer' && proj.bouncesLeft > 0) {
          proj.bouncesLeft--;
          const nextTarget = this.findNearestEnemyExcluding(proj.x, proj.z, proj.hitEnemyIds);
          if (nextTarget) {
            const dir = normalizeDirection(nextTarget.x - proj.x, nextTarget.z - proj.z);
            const speed = Math.sqrt(proj.vx * proj.vx + proj.vz * proj.vz);
            proj.vx = dir.x * speed;
            proj.vz = dir.z * speed;
          } else {
            consumed = true;
          }
          break; // One hit per frame for bouncing
        }

        // Handle pierce
        if (proj.pierceLeft > 0) {
          proj.pierceLeft--;
          continue;
        }

        // No pierce/bounce -> remove
        consumed = true;
        break;
      }

      if (consumed) {
        this.state.projectiles.splice(i, 1);
      }
    }

    // Step 9c: Enemies attacking player (melee)
    if (player.alive && player.invincibleTimer <= 0) {
      for (const enemy of enemies) {
        if (enemy.hp <= 0 || enemy.attackCooldown > 0) continue;

        const dist = distanceBetween(player.x, player.z, enemy.x, enemy.z);
        if (dist < 1.2) {
          const damage = Math.max(1, enemy.damage - player.armor);
          player.hp -= damage;
          player.invincibleTimer = PLAYER_INVINCIBLE_DURATION;
          enemy.attackCooldown = enemy.attackCooldownMax;
          this.state.stats.damageTaken += damage;
          this.addDamageEvent(player.x, 1.5, player.z, damage, false, true);

          if (player.hp <= 0) {
            this.checkPlayerDeath();
          }
          break; // Only one hit during invincibility window
        }
      }
    }

    // Boss melee vs player
    if (player.alive && player.invincibleTimer <= 0 && this.state.boss && this.state.boss.hp > 0) {
      const dist = distanceBetween(player.x, player.z, this.state.boss.x, this.state.boss.z);
      if (dist < 2.0 && this.state.boss.attackCooldown <= 0) {
        const bossDmg = this.getBossMeleeDamage();
        const damage = Math.max(1, bossDmg - player.armor);
        player.hp -= damage;
        player.invincibleTimer = PLAYER_INVINCIBLE_DURATION;
        this.state.boss.attackCooldown = 2.0;
        this.state.stats.damageTaken += damage;
        this.addDamageEvent(player.x, 1.5, player.z, damage, false, true);

        if (player.hp <= 0) {
          this.checkPlayerDeath();
        }
      }
    }

    // Enemy projectiles vs player
    if (player.alive && player.invincibleTimer <= 0) {
      for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
        const proj = this.state.projectiles[i];
        if (proj.fromPlayer) continue;

        const dist = distanceBetween(proj.x, proj.z, player.x, player.z);
        const yDist = Math.abs(proj.y - 0.5);
        if (dist < proj.radius + 0.5 && yDist < 1.5) {
          const damage = Math.max(1, proj.damage - player.armor);
          player.hp -= damage;
          player.invincibleTimer = PLAYER_INVINCIBLE_DURATION;
          this.state.stats.damageTaken += damage;
          this.addDamageEvent(player.x, 1.5, player.z, damage, false, true);
          this.state.projectiles.splice(i, 1);

          if (player.hp <= 0) {
            this.checkPlayerDeath();
          }
          break;
        }
      }
    }
  }

  // =========================================================================
  // Private: Deaths & Pickups
  // =========================================================================

  private processDeaths(): void {
    const enemies = this.state.enemies;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (enemy.hp <= 0) {
        this.spawnPickupFromEnemy(enemy);
        this.state.stats.killCount++;
        enemies.splice(i, 1);
      }
    }
  }

  private spawnPickupFromEnemy(enemy: EnemyState): void {
    if (this.state.pickups.length >= MAX_PICKUPS) return;

    const cfg = ENEMY_CONFIGS[enemy.type];
    if (!cfg) return;

    const xpReward = cfg.xpReward;
    let pickupType: PickupType;

    if (xpReward >= 30) {
      pickupType = 'xp_orange';
    } else if (xpReward >= 10) {
      pickupType = 'xp_purple';
    } else if (xpReward >= 3) {
      pickupType = 'xp_blue';
    } else {
      pickupType = 'xp_green';
    }

    this.state.pickups.push({
      id: this.nextPickupId++,
      type: pickupType,
      x: enemy.x,
      y: 0.2,
      z: enemy.z,
      value: XP_VALUES[pickupType] ?? 1,
      lifetime: PICKUP_LIFETIME,
      attracted: false,
    });

    // Elites also drop silver
    if (enemy.isElite && this.state.pickups.length < MAX_PICKUPS) {
      this.state.pickups.push({
        id: this.nextPickupId++,
        type: 'silver',
        x: enemy.x + (Math.random() - 0.5),
        y: 0.2,
        z: enemy.z + (Math.random() - 0.5),
        value: 5,
        lifetime: PICKUP_LIFETIME,
        attracted: false,
      });
    }
  }

  private updatePickups(dt: number): void {
    const player = this.state.player;
    if (!player.alive) return;

    const pickups = this.state.pickups;
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pickup = pickups[i];
      pickup.lifetime -= dt;

      if (pickup.lifetime <= 0) {
        pickups.splice(i, 1);
        continue;
      }

      const dist = distanceBetween(player.x, player.z, pickup.x, pickup.z);

      // Attract if within pickup radius
      if (dist < player.pickupRadius) {
        pickup.attracted = true;
      }

      if (pickup.attracted) {
        const dir = normalizeDirection(player.x - pickup.x, player.z - pickup.z);
        pickup.x += dir.x * PICKUP_ATTRACT_SPEED * dt;
        pickup.z += dir.z * PICKUP_ATTRACT_SPEED * dt;

        const newDist = distanceBetween(player.x, player.z, pickup.x, pickup.z);
        if (newDist < 0.5) {
          this.collectPickup(pickup);
          pickups.splice(i, 1);
        }
      }
    }
  }

  private collectPickup(pickup: PickupState): void {
    if (pickup.type === 'silver') {
      this.state.stats.silverEarned += pickup.value;
      // Lucky coin bonus
      const luckyCoin = this.state.player.passives.find(p => p.type === 'lucky_coin');
      if (luckyCoin) {
        this.state.stats.silverEarned += luckyCoin.level;
      }
      return;
    }

    // XP pickup
    let xpValue = pickup.value;
    const xpBonus = this.state.player.passives.find(p => p.type === 'xp_bonus');
    if (xpBonus) {
      xpValue = Math.floor(xpValue * (1 + xpBonus.level * 0.15));
    }
    this.state.player.xp += xpValue;
  }

  // =========================================================================
  // Private: Level Up
  // =========================================================================

  private checkLevelUp(): void {
    const player = this.state.player;
    if (!player.alive || this.state.phase === 'level_up') return;
    if (player.level >= 40) return;

    while (player.xp >= player.xpToNext && player.level < 40) {
      player.xp -= player.xpToNext;
      player.level++;
      player.xpToNext = xpForLevel(player.level);

      // Heal a bit on level up
      player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * 0.1));

      // Generate upgrade options
      const options = generateUpgradeOptions(player, 3);
      if (options.length > 0) {
        this.state.upgradeOptions = options;
        this.state.phase = 'level_up';
        return;
      }
    }
  }

  // =========================================================================
  // Private: Enemy Spawning
  // =========================================================================

  private spawnEnemies(dt: number): void {
    // Don't spawn during boss fight
    if (this.state.phase === 'boss_fight' || this.state.phase === 'boss_intro') return;

    // Find current wave
    const wave = this.getCurrentWave();
    if (!wave) return;

    // Update wave index
    for (let i = 0; i < WAVE_CONFIGS.length; i++) {
      if (this.state.gameTime >= WAVE_CONFIGS[i].timeStart && this.state.gameTime < WAVE_CONFIGS[i].timeEnd) {
        this.state.waveIndex = i;
        break;
      }
    }

    // Don't exceed max alive
    if (this.state.enemies.length >= wave.maxAlive) return;
    if (this.state.enemies.length >= this.config.maxEnemies) return;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = wave.spawnInterval;

      const groupMin = wave.groupSize[0];
      const groupMax = wave.groupSize[1];
      const groupSize = groupMin + Math.floor(Math.random() * (groupMax - groupMin + 1));

      for (let i = 0; i < groupSize; i++) {
        if (this.state.enemies.length >= wave.maxAlive) break;
        if (this.state.enemies.length >= this.config.maxEnemies) break;

        // Determine if this should be an elite
        const isEliteRoll = Math.random() < wave.eliteChance;

        let enemyType: string;
        if (isEliteRoll) {
          // Pick an elite type that has appeared by now
          const eliteTypes = Object.keys(ENEMY_CONFIGS).filter(
            t => ENEMY_CONFIGS[t].isElite && ENEMY_CONFIGS[t].firstAppear <= this.state.gameTime
          );
          if (eliteTypes.length > 0) {
            enemyType = eliteTypes[Math.floor(Math.random() * eliteTypes.length)];
          } else {
            enemyType = this.pickWeightedEnemy(wave.enemies);
          }
        } else {
          enemyType = this.pickWeightedEnemy(wave.enemies);
        }

        if (!enemyType) continue;
        this.spawnSingleEnemy(enemyType);
      }
    }
  }

  private getCurrentWave(): typeof WAVE_CONFIGS[number] | null {
    for (const wave of WAVE_CONFIGS) {
      if (this.state.gameTime >= wave.timeStart && this.state.gameTime < wave.timeEnd) {
        return wave;
      }
    }
    // After all waves, use last wave
    if (WAVE_CONFIGS.length > 0 && this.state.gameTime >= WAVE_CONFIGS[WAVE_CONFIGS.length - 1].timeEnd) {
      return WAVE_CONFIGS[WAVE_CONFIGS.length - 1];
    }
    return null;
  }

  private pickWeightedEnemy(types: string[]): string {
    // Filter by firstAppear
    const available = types.filter(
      t => ENEMY_CONFIGS[t] && ENEMY_CONFIGS[t].firstAppear <= this.state.gameTime
    );
    if (available.length === 0) return types[0];

    let totalWeight = 0;
    for (const t of available) {
      totalWeight += ENEMY_CONFIGS[t]?.spawnWeight ?? 1;
    }

    let roll = Math.random() * totalWeight;
    for (const t of available) {
      roll -= ENEMY_CONFIGS[t]?.spawnWeight ?? 1;
      if (roll <= 0) return t;
    }
    return available[available.length - 1];
  }

  private spawnSingleEnemy(type: string): void {
    const cfg = ENEMY_CONFIGS[type];
    if (!cfg) return;

    const spawnPos = this.getSpawnPosition();

    // Scale HP with game time (10% per minute)
    const timeScale = 1 + this.state.gameTime / 600;

    const enemy: EnemyState = {
      id: this.nextEnemyId++,
      type: type as EnemyType,
      x: spawnPos.x,
      y: 0,
      z: spawnPos.z,
      hp: Math.round(cfg.hp * timeScale),
      maxHp: Math.round(cfg.hp * timeScale),
      speed: cfg.speed,
      damage: cfg.damage,
      behavior: cfg.behavior as EnemyBehavior,
      isElite: cfg.isElite,
      hitFlashTimer: 0,
      attackCooldown: 0,
      attackCooldownMax: cfg.attackCooldown,
      targetX: this.state.player.x,
      targetZ: this.state.player.z,
    };

    this.state.enemies.push(enemy);
  }

  private getSpawnPosition(): { x: number; z: number } {
    const halfMap = this.config.mapSize * 0.5;
    const offset = 5;
    const side = Math.floor(Math.random() * 4);
    const along = (Math.random() - 0.5) * this.config.mapSize;

    switch (side) {
      case 0: return { x: along, z: -halfMap - offset };
      case 1: return { x: along, z: halfMap + offset };
      case 2: return { x: -halfMap - offset, z: along };
      default: return { x: halfMap + offset, z: along };
    }
  }

  // =========================================================================
  // Private: Boss
  // =========================================================================

  private checkBossSpawn(): void {
    if (this.state.boss) return;
    if (this.state.gameTime < BOSS_SPAWN_TIME) return;
    if (this.state.phase === 'victory' || this.state.phase === 'defeat') return;

    this.state.boss = {
      x: 0,
      y: 0,
      z: -this.config.mapSize * 0.3,
      hp: BOSS_HP,
      maxHp: BOSS_HP,
      phase: 1,
      currentAttack: 'idle',
      attackTimer: BOSS_INTRO_DURATION,
      attackCooldown: 3.0,
      hitFlashTimer: 0,
      speed: 3.0,
      enraged: false,
    };

    this.state.phase = 'boss_intro';
    // Clear regular enemies when boss arrives
    this.state.enemies = [];
  }

  private updateBossAI(dt: number): void {
    const boss = this.state.boss;
    if (!boss) return;

    const player = this.state.player;

    // Update phase based on HP
    const hpRatio = boss.hp / boss.maxHp;
    if (hpRatio <= 0.3) {
      boss.phase = 3;
      boss.enraged = true;
      boss.speed = 5.0;
    } else if (hpRatio <= 0.6) {
      boss.phase = 2;
      boss.speed = 4.0;
    } else {
      boss.phase = 1;
      boss.speed = 3.0;
    }

    // Decrement attack timer
    boss.attackTimer -= dt;
    if (boss.attackCooldown > 0) {
      boss.attackCooldown -= dt;
    }

    // Execute attack when timer fires
    if (boss.attackTimer <= 0) {
      boss.currentAttack = this.chooseBossAttack(boss.phase);
      boss.attackTimer = (boss.enraged ? 1.5 : 2.5) + Math.random() * 1.0;
      this.executeBossAttack(boss);
    }

    // Move toward player
    const dist = distanceBetween(boss.x, boss.z, player.x, player.z);
    if (dist > 2.0) {
      const dir = normalizeDirection(player.x - boss.x, player.z - boss.z);
      const halfMap = this.config.mapSize * 0.5;
      boss.x = Math.max(-halfMap, Math.min(halfMap, boss.x + dir.x * boss.speed * dt));
      boss.z = Math.max(-halfMap, Math.min(halfMap, boss.z + dir.z * boss.speed * dt));
    }
  }

  private chooseBossAttack(phase: BossPhase): BossAttack {
    const attacks: BossAttack[][] = [
      ['melee_sweep', 'ground_slam', 'dark_bolt'],
      ['melee_sweep', 'ground_slam', 'summon_wave', 'charge', 'dark_bolt'],
      ['aoe_explosion', 'dark_rain', 'charge', 'summon_wave', 'melee_sweep'],
    ];
    const pool = attacks[phase - 1];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private executeBossAttack(boss: BossState): void {
    const player = this.state.player;
    if (!player.alive) return;

    const dist = distanceBetween(boss.x, boss.z, player.x, player.z);

    switch (boss.currentAttack) {
      case 'melee_sweep':
        if (dist < 3.5 && player.invincibleTimer <= 0) {
          const damage = Math.max(1, 25 - player.armor);
          player.hp -= damage;
          player.invincibleTimer = PLAYER_INVINCIBLE_DURATION;
          this.state.stats.damageTaken += damage;
          this.addDamageEvent(player.x, 1.5, player.z, damage, false, true);
          this.checkPlayerDeath();
        }
        break;

      case 'ground_slam':
        if (dist < 5.0 && player.invincibleTimer <= 0) {
          const damage = Math.max(1, 35 - player.armor);
          player.hp -= damage;
          player.invincibleTimer = PLAYER_INVINCIBLE_DURATION;
          this.state.stats.damageTaken += damage;
          this.addDamageEvent(player.x, 1.5, player.z, damage, false, true);
          this.checkPlayerDeath();
        }
        break;

      case 'dark_bolt':
        if (this.state.projectiles.length < MAX_PROJECTILES) {
          const dir = normalizeDirection(player.x - boss.x, player.z - boss.z);
          this.state.projectiles.push({
            id: this.nextProjectileId++,
            weaponType: 'void_orb',
            x: boss.x, y: 1.0, z: boss.z,
            vx: dir.x * 10, vy: 0, vz: dir.z * 10,
            damage: 20,
            bouncesLeft: 0, pierceLeft: 0,
            lifetime: 4.0, radius: 0.5,
            fromPlayer: false,
            hitEnemyIds: [],
          });
        }
        break;

      case 'summon_wave': {
        const count = boss.phase === 3 ? 8 : 4;
        for (let i = 0; i < count; i++) {
          if (this.state.enemies.length >= MAX_ENEMIES) break;
          const angle = (i / count) * Math.PI * 2;
          const spawnDist = 5;
          const enemyType = boss.phase >= 2 ? 'ghost' : 'skeleton_soldier';
          const cfg = ENEMY_CONFIGS[enemyType];
          if (!cfg) continue;

          this.state.enemies.push({
            id: this.nextEnemyId++,
            type: enemyType as EnemyType,
            x: boss.x + Math.cos(angle) * spawnDist,
            y: 0,
            z: boss.z + Math.sin(angle) * spawnDist,
            hp: cfg.hp,
            maxHp: cfg.hp,
            speed: cfg.speed,
            damage: cfg.damage,
            behavior: cfg.behavior as EnemyBehavior,
            isElite: false,
            hitFlashTimer: 0,
            attackCooldown: 0,
            attackCooldownMax: cfg.attackCooldown,
            targetX: player.x,
            targetZ: player.z,
          });
        }
        break;
      }

      case 'aoe_explosion':
        if (dist < 7.0 && player.invincibleTimer <= 0) {
          const damage = Math.max(1, 40 - player.armor);
          player.hp -= damage;
          player.invincibleTimer = PLAYER_INVINCIBLE_DURATION;
          this.state.stats.damageTaken += damage;
          this.addDamageEvent(player.x, 1.5, player.z, damage, false, true);
          this.checkPlayerDeath();
        }
        break;

      case 'charge':
        // Boss temporarily charges at high speed
        boss.speed = 12.0;
        break;

      case 'dark_rain':
        for (let i = 0; i < 6; i++) {
          if (this.state.projectiles.length >= MAX_PROJECTILES) break;
          const ox = (Math.random() - 0.5) * 12;
          const oz = (Math.random() - 0.5) * 12;
          this.state.projectiles.push({
            id: this.nextProjectileId++,
            weaponType: 'void_orb',
            x: player.x + ox, y: 10, z: player.z + oz,
            vx: 0, vy: -12, vz: 0,
            damage: 15,
            bouncesLeft: 0, pierceLeft: 0,
            lifetime: 2.0, radius: 1.0,
            fromPlayer: false,
            hitEnemyIds: [],
          });
        }
        break;

      case 'idle':
        break;
    }
  }

  private getBossMeleeDamage(): number {
    if (!this.state.boss) return 20;
    switch (this.state.boss.phase) {
      case 1: return 20;
      case 2: return 30;
      case 3: return 40;
      default: return 20;
    }
  }

  // =========================================================================
  // Private: Game Over
  // =========================================================================

  private checkGameOver(): void {
    // Player dead -> defeat
    if (!this.state.player.alive) {
      this.state.phase = 'defeat';
      this.state.finished = true;
      this.state.running = false;
      return;
    }

    // Boss dead -> victory
    if (this.state.boss && this.state.boss.hp <= 0) {
      this.state.phase = 'victory';
      this.state.finished = true;
      this.state.running = false;
      this.state.stats.silverEarned += 50; // Boss kill bonus
    }
  }

  private checkPlayerDeath(): void {
    const player = this.state.player;
    if (player.hp <= 0) {
      const revive = player.passives.find(p => p.type === 'revive_bone');
      if (revive && revive.level > 0) {
        player.hp = Math.floor(player.maxHp * 0.3);
        player.invincibleTimer = 2.0;
        revive.level = 0; // Consumed
      } else {
        player.alive = false;
      }
    }
  }

  // =========================================================================
  // Private: Passive Stats Recalculation
  // =========================================================================

  private recalculatePassiveStats(): void {
    const player = this.state.player;
    let speedMult = 1.0;
    let damageMult = 1.0;
    let attackSpeedMult = 1.0;
    let critChance = PLAYER_BASE_CRIT_CHANCE;
    let critDamage = PLAYER_BASE_CRIT_DAMAGE;
    let armor = 0;
    let pickupRadius = PLAYER_PICKUP_RADIUS;

    for (const passive of player.passives) {
      switch (passive.type) {
        case 'power_crystal':
          damageMult += passive.level * 0.1;
          break;
        case 'swift_boots':
          speedMult += passive.level * 0.08;
          break;
        case 'magnet_gem':
          pickupRadius += passive.level * 1.0;
          break;
        case 'armor_shard':
          armor += passive.level * 2;
          break;
        case 'attack_heart':
          attackSpeedMult += passive.level * 0.08;
          break;
        case 'crit_eye':
          critChance += passive.level * 0.05;
          break;
        case 'cooldown_reduce':
          attackSpeedMult += passive.level * 0.06;
          break;
        // lifesteal_stone, lucky_coin, revive_bone, xp_bonus, extra_projectile
        // are handled contextually in their respective code paths
      }
    }

    player.speed = PLAYER_BASE_SPEED * speedMult;
    player.damageMultiplier = damageMult;
    player.attackSpeedMultiplier = attackSpeedMult;
    player.critChance = critChance;
    player.critDamage = critDamage;
    player.armor = armor;
    player.pickupRadius = pickupRadius;
  }

  // =========================================================================
  // Private: Utility
  // =========================================================================

  private getWeaponStats(weapon: WeaponState) {
    const levelStats = WEAPON_STATS[weapon.type];
    const idx = Math.max(0, Math.min(weapon.level - 1, levelStats.length - 1));
    return levelStats[idx];
  }

  private getExtraProjectileCount(): number {
    const extra = this.state.player.passives.find(p => p.type === 'extra_projectile');
    return extra ? extra.level : 0;
  }

  private findNearestEnemy(x: number, z: number, maxRange?: number): EnemyState | null {
    let nearest: EnemyState | null = null;
    let nearestDist = maxRange ?? Infinity;

    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0) continue;
      const dist = distanceBetween(x, z, enemy.x, enemy.z);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }
    return nearest;
  }

  private findNearestEnemyExcluding(x: number, z: number, excludeIds: number[]): EnemyState | null {
    let nearest: EnemyState | null = null;
    let nearestDist = 20;

    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0) continue;
      if (excludeIds.includes(enemy.id)) continue;
      const dist = distanceBetween(x, z, enemy.x, enemy.z);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }
    return nearest;
  }

  private findEnemyById(id: number): EnemyState | null {
    for (let i = 0; i < this.state.enemies.length; i++) {
      if (this.state.enemies[i].id === id) return this.state.enemies[i];
    }
    return null;
  }

  private applyLifesteal(damage: number): void {
    const lifesteal = this.state.player.passives.find(p => p.type === 'lifesteal_stone');
    if (lifesteal && lifesteal.level > 0) {
      const healAmount = damage * lifesteal.level * 0.03;
      this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + healAmount);
    }
  }

  private addDamageEvent(x: number, y: number, z: number, damage: number, isCrit: boolean, isPlayerDamage: boolean): void {
    this.state.damageEvents.push({ x, y, z, damage, isCrit, isPlayerDamage });
  }
}
