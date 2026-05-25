// === MegaBonk Survivor - Type Definitions ===

// --- Input ---
export interface InputState {
  moveX: number; // -1~1
  moveY: number; // -1~1
  dash: boolean;
  skill1: boolean;
  skill2: boolean;
}

// --- Weapons ---
export type WeaponType = 'bone_bouncer' | 'lightning_staff' | 'flame_ring' | 'void_orb';

export interface WeaponState {
  type: WeaponType;
  level: number;
  cooldownTimer: number;
}

// --- Passives ---
export type PassiveType =
  | 'power_crystal'
  | 'swift_boots'
  | 'lifesteal_stone'
  | 'magnet_gem'
  | 'armor_shard'
  | 'attack_heart'
  | 'crit_eye'
  | 'lucky_coin'
  | 'revive_bone'
  | 'xp_bonus'
  | 'cooldown_reduce'
  | 'extra_projectile';

export interface PassiveState {
  type: PassiveType;
  level: number;
}

// --- Player ---
export interface PlayerState {
  x: number;
  y: number;
  z: number;
  rotation: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  speed: number;
  damageMultiplier: number;
  attackSpeedMultiplier: number;
  critChance: number;
  critDamage: number;
  armor: number;
  pickupRadius: number;
  weapons: WeaponState[];
  passives: PassiveState[];
  dashCooldown: number;
  dashCooldownMax: number;
  dashTimer: number;
  invincibleTimer: number;
  alive: boolean;
}

// --- Enemies ---
export type EnemyType =
  | 'skeleton_soldier'
  | 'ghost'
  | 'bat'
  | 'zombie'
  | 'skeleton_archer'
  | 'skeleton_knight'
  | 'necromancer'
  | 'gargoyle';

export type EnemyBehavior = 'chase' | 'ranged' | 'swarm' | 'charge' | 'dive';

export interface EnemyState {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  behavior: EnemyBehavior;
  isElite: boolean;
  hitFlashTimer: number;
  attackCooldown: number;
  attackCooldownMax: number;
  targetX: number;
  targetZ: number;
}

// --- Projectiles ---
export interface ProjectileState {
  id: number;
  weaponType: WeaponType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  bouncesLeft: number;
  pierceLeft: number;
  lifetime: number;
  radius: number;
  fromPlayer: boolean;
  hitEnemyIds: number[];
}

// --- Pickups ---
export type PickupType = 'xp_green' | 'xp_blue' | 'xp_purple' | 'xp_orange' | 'silver';

export interface PickupState {
  id: number;
  type: PickupType;
  x: number;
  y: number;
  z: number;
  value: number;
  lifetime: number;
  attracted: boolean;
}

// --- Upgrades ---
export type UpgradeRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type UpgradeKind = 'weapon_upgrade' | 'new_weapon' | 'passive';

export interface UpgradeOption {
  id: string;
  kind: UpgradeKind;
  rarity: UpgradeRarity;
  weaponType?: WeaponType;
  passiveType?: PassiveType;
  currentLevel: number;
  newLevel: number;
}

// --- Boss ---
export type BossPhase = 1 | 2 | 3;
export type BossAttack = 'melee_sweep' | 'ground_slam' | 'summon_wave' | 'dark_bolt' | 'aoe_explosion' | 'charge' | 'dark_rain' | 'idle';

export interface BossState {
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  phase: BossPhase;
  currentAttack: BossAttack;
  attackTimer: number;
  attackCooldown: number;
  hitFlashTimer: number;
  speed: number;
  enraged: boolean;
}

// --- Damage Events (for rendering feedback) ---
export interface DamageEvent {
  x: number;
  y: number;
  z: number;
  damage: number;
  isCrit: boolean;
  isPlayerDamage: boolean;
}

// --- Game State ---
export type GamePhase = 'menu' | 'playing' | 'level_up' | 'boss_intro' | 'boss_fight' | 'victory' | 'defeat' | 'paused';

export interface GameStats {
  killCount: number;
  damageDealt: number;
  damageTaken: number;
  silverEarned: number;
}

export interface GameState {
  tick: number;
  gameTime: number;
  running: boolean;
  paused: boolean;
  finished: boolean;
  phase: GamePhase;
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  pickups: PickupState[];
  boss: BossState | null;
  upgradeOptions: UpgradeOption[] | null;
  damageEvents: DamageEvent[];
  stats: GameStats;
  waveIndex: number;
}

// --- Config ---
export interface GameConfig {
  mapSize: number;
  tickIntervalMs: number;
  maxEnemies: number;
}

// --- Result ---
export interface GameResult {
  victory: boolean;
  survivalTime: number;
  killCount: number;
  level: number;
  silverEarned: number;
}
