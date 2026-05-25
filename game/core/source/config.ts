import type { GameConfig } from './types.ts';

export const MAP_SIZE = 80;
export const TICK_INTERVAL_MS = 1000 / 60;
export const MAX_ENEMIES = 100;
export const MAX_PROJECTILES = 200;
export const MAX_PICKUPS = 300;

export const PLAYER_BASE_HP = 100;
export const PLAYER_BASE_SPEED = 5.0;
export const PLAYER_BASE_CRIT_CHANCE = 0.05;
export const PLAYER_BASE_CRIT_DAMAGE = 1.5;
export const PLAYER_PICKUP_RADIUS = 2.0;
export const PLAYER_INVINCIBLE_DURATION = 0.5;

export const DASH_DISTANCE = 6;
export const DASH_DURATION = 0.2;
export const DASH_COOLDOWN = 5;

export const MAX_LEVEL = 40;
export const MAX_WEAPONS = 4;
export const XP_BASE = 10;
export const XP_GROWTH = 0.35;

export const BOSS_SPAWN_TIME = 540;
export const BOSS_HP = 2000;
export const BOSS_INTRO_DURATION = 2.0;

export const PICKUP_LIFETIME = 30;
export const PICKUP_ATTRACT_SPEED = 12;

// XP values for pickup types
export const XP_VALUES: Record<string, number> = {
  xp_green: 1,
  xp_blue: 5,
  xp_purple: 25,
  xp_orange: 100,
};

// Enemy configs
export interface EnemyConfig {
  hp: number;
  damage: number;
  speed: number;
  behavior: string;
  xpReward: number;
  attackCooldown: number;
  isElite: boolean;
  firstAppear: number;
  spawnWeight: number;
  preferredRange?: number;
}

export const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  skeleton_soldier: { hp: 15, damage: 5, speed: 3.0, behavior: 'chase', xpReward: 1, attackCooldown: 1.5, isElite: false, firstAppear: 0, spawnWeight: 40 },
  ghost: { hp: 10, damage: 8, speed: 4.0, behavior: 'chase', xpReward: 2, attackCooldown: 2.0, isElite: false, firstAppear: 60, spawnWeight: 25 },
  bat: { hp: 5, damage: 3, speed: 5.0, behavior: 'swarm', xpReward: 1, attackCooldown: 1.0, isElite: false, firstAppear: 30, spawnWeight: 30 },
  zombie: { hp: 30, damage: 10, speed: 1.5, behavior: 'chase', xpReward: 3, attackCooldown: 2.5, isElite: false, firstAppear: 90, spawnWeight: 20 },
  skeleton_archer: { hp: 12, damage: 7, speed: 2.5, behavior: 'ranged', xpReward: 3, attackCooldown: 3.0, isElite: false, firstAppear: 120, spawnWeight: 15, preferredRange: 8 },
  skeleton_knight: { hp: 120, damage: 20, speed: 3.5, behavior: 'charge', xpReward: 25, attackCooldown: 2.0, isElite: true, firstAppear: 180, spawnWeight: 5 },
  necromancer: { hp: 80, damage: 15, speed: 2.0, behavior: 'ranged', xpReward: 30, attackCooldown: 4.0, isElite: true, firstAppear: 240, spawnWeight: 3, preferredRange: 10 },
  gargoyle: { hp: 200, damage: 25, speed: 4.0, behavior: 'dive', xpReward: 40, attackCooldown: 3.0, isElite: true, firstAppear: 360, spawnWeight: 2 },
};

// Wave configs
export interface WaveConfig {
  timeStart: number;
  timeEnd: number;
  spawnInterval: number;
  maxAlive: number;
  enemies: string[];
  groupSize: [number, number];
  eliteChance: number;
}

export const WAVE_CONFIGS: WaveConfig[] = [
  { timeStart: 0, timeEnd: 60, spawnInterval: 2.0, maxAlive: 30, enemies: ['skeleton_soldier', 'bat'], groupSize: [1, 3], eliteChance: 0 },
  { timeStart: 60, timeEnd: 180, spawnInterval: 1.5, maxAlive: 50, enemies: ['skeleton_soldier', 'ghost', 'bat', 'zombie'], groupSize: [2, 4], eliteChance: 0.05 },
  { timeStart: 180, timeEnd: 300, spawnInterval: 1.2, maxAlive: 70, enemies: ['skeleton_soldier', 'ghost', 'zombie', 'skeleton_archer'], groupSize: [3, 5], eliteChance: 0.1 },
  { timeStart: 300, timeEnd: 420, spawnInterval: 1.0, maxAlive: 85, enemies: ['ghost', 'zombie', 'skeleton_archer', 'bat'], groupSize: [3, 6], eliteChance: 0.15 },
  { timeStart: 420, timeEnd: 540, spawnInterval: 0.8, maxAlive: 100, enemies: ['zombie', 'skeleton_archer', 'bat', 'ghost'], groupSize: [4, 8], eliteChance: 0.2 },
];

// Weapon level stats
export interface WeaponLevelStats {
  damage: number;
  cooldown: number;
  projectileCount: number;
  bounces: number;
  chains: number;
  range: number;
  aoeRadius: number;
  pierce: number;
  speed: number;
}

export const WEAPON_STATS: Record<string, WeaponLevelStats[]> = {
  bone_bouncer: [
    { damage: 8, cooldown: 1.2, projectileCount: 1, bounces: 2, chains: 0, range: 0, aoeRadius: 0, pierce: 0, speed: 12 },
    { damage: 10, cooldown: 1.2, projectileCount: 1, bounces: 2, chains: 0, range: 0, aoeRadius: 0, pierce: 0, speed: 12 },
    { damage: 10, cooldown: 1.2, projectileCount: 1, bounces: 3, chains: 0, range: 0, aoeRadius: 0, pierce: 0, speed: 12 },
    { damage: 12, cooldown: 1.0, projectileCount: 1, bounces: 3, chains: 0, range: 0, aoeRadius: 0, pierce: 0, speed: 13 },
    { damage: 12, cooldown: 1.0, projectileCount: 2, bounces: 4, chains: 0, range: 0, aoeRadius: 0, pierce: 0, speed: 13 },
    { damage: 16, cooldown: 1.0, projectileCount: 2, bounces: 4, chains: 0, range: 0, aoeRadius: 0, pierce: 0, speed: 14 },
    { damage: 16, cooldown: 0.8, projectileCount: 2, bounces: 5, chains: 0, range: 0, aoeRadius: 0, pierce: 0, speed: 14 },
    { damage: 20, cooldown: 0.8, projectileCount: 3, bounces: 6, chains: 0, range: 0, aoeRadius: 0, pierce: 0, speed: 15 },
  ],
  lightning_staff: [
    { damage: 15, cooldown: 2.0, projectileCount: 1, bounces: 0, chains: 3, range: 8, aoeRadius: 0, pierce: 0, speed: 0 },
    { damage: 18, cooldown: 2.0, projectileCount: 1, bounces: 0, chains: 3, range: 8, aoeRadius: 0, pierce: 0, speed: 0 },
    { damage: 18, cooldown: 2.0, projectileCount: 1, bounces: 0, chains: 4, range: 10, aoeRadius: 0, pierce: 0, speed: 0 },
    { damage: 22, cooldown: 1.7, projectileCount: 1, bounces: 0, chains: 4, range: 10, aoeRadius: 0, pierce: 0, speed: 0 },
    { damage: 22, cooldown: 1.7, projectileCount: 1, bounces: 0, chains: 5, range: 12, aoeRadius: 0, pierce: 0, speed: 0 },
    { damage: 28, cooldown: 1.5, projectileCount: 1, bounces: 0, chains: 5, range: 12, aoeRadius: 0, pierce: 0, speed: 0 },
    { damage: 28, cooldown: 1.5, projectileCount: 1, bounces: 0, chains: 6, range: 14, aoeRadius: 0, pierce: 0, speed: 0 },
    { damage: 35, cooldown: 1.2, projectileCount: 1, bounces: 0, chains: 8, range: 40, aoeRadius: 0, pierce: 0, speed: 0 },
  ],
  flame_ring: [
    { damage: 4, cooldown: 0.5, projectileCount: 0, bounces: 0, chains: 0, range: 3.5, aoeRadius: 3.5, pierce: 0, speed: 0 },
    { damage: 5, cooldown: 0.5, projectileCount: 0, bounces: 0, chains: 0, range: 3.5, aoeRadius: 3.5, pierce: 0, speed: 0 },
    { damage: 5, cooldown: 0.5, projectileCount: 0, bounces: 0, chains: 0, range: 4.5, aoeRadius: 4.5, pierce: 0, speed: 0 },
    { damage: 7, cooldown: 0.4, projectileCount: 0, bounces: 0, chains: 0, range: 4.5, aoeRadius: 4.5, pierce: 0, speed: 0 },
    { damage: 7, cooldown: 0.4, projectileCount: 0, bounces: 0, chains: 0, range: 5.5, aoeRadius: 5.5, pierce: 0, speed: 0 },
    { damage: 9, cooldown: 0.4, projectileCount: 0, bounces: 0, chains: 0, range: 5.5, aoeRadius: 5.5, pierce: 0, speed: 0 },
    { damage: 9, cooldown: 0.3, projectileCount: 0, bounces: 0, chains: 0, range: 6.5, aoeRadius: 6.5, pierce: 0, speed: 0 },
    { damage: 12, cooldown: 0.3, projectileCount: 0, bounces: 0, chains: 0, range: 8.0, aoeRadius: 8.0, pierce: 0, speed: 0 },
  ],
  void_orb: [
    { damage: 20, cooldown: 3.0, projectileCount: 1, bounces: 0, chains: 0, range: 0, aoeRadius: 2.5, pierce: 999, speed: 6 },
    { damage: 25, cooldown: 3.0, projectileCount: 1, bounces: 0, chains: 0, range: 0, aoeRadius: 2.5, pierce: 999, speed: 6 },
    { damage: 25, cooldown: 3.0, projectileCount: 1, bounces: 0, chains: 0, range: 0, aoeRadius: 3.0, pierce: 999, speed: 6 },
    { damage: 30, cooldown: 2.5, projectileCount: 1, bounces: 0, chains: 0, range: 0, aoeRadius: 3.0, pierce: 999, speed: 6 },
    { damage: 30, cooldown: 2.5, projectileCount: 2, bounces: 0, chains: 0, range: 0, aoeRadius: 3.5, pierce: 999, speed: 6 },
    { damage: 38, cooldown: 2.5, projectileCount: 2, bounces: 0, chains: 0, range: 0, aoeRadius: 3.5, pierce: 999, speed: 7 },
    { damage: 38, cooldown: 2.0, projectileCount: 2, bounces: 0, chains: 0, range: 0, aoeRadius: 4.0, pierce: 999, speed: 7 },
    { damage: 50, cooldown: 2.0, projectileCount: 3, bounces: 0, chains: 0, range: 0, aoeRadius: 5.0, pierce: 999, speed: 8 },
  ],
};

// Passive max levels
export const PASSIVE_MAX_LEVELS: Record<string, number> = {
  power_crystal: 5,
  swift_boots: 5,
  lifesteal_stone: 3,
  magnet_gem: 5,
  armor_shard: 5,
  attack_heart: 5,
  crit_eye: 3,
  lucky_coin: 3,
  revive_bone: 1,
  xp_bonus: 5,
  cooldown_reduce: 5,
  extra_projectile: 3,
};

export const DEFAULT_GAME_CONFIG: GameConfig = {
  mapSize: MAP_SIZE,
  tickIntervalMs: TICK_INTERVAL_MS,
  maxEnemies: MAX_ENEMIES,
};
