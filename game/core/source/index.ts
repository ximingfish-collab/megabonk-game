// === MegaBonk Survivor - Core Package Exports ===

export type {
  InputState,
  WeaponType,
  WeaponState,
  PassiveType,
  PassiveState,
  PlayerState,
  EnemyType,
  EnemyBehavior,
  EnemyState,
  ProjectileState,
  PickupType,
  PickupState,
  UpgradeRarity,
  UpgradeKind,
  UpgradeOption,
  BossPhase,
  BossAttack,
  BossState,
  DamageEvent,
  GamePhase,
  GameStats,
  GameState,
  GameConfig,
  GameResult,
} from './types.ts';

export {
  MAP_SIZE,
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
  MAX_LEVEL,
  MAX_WEAPONS,
  XP_BASE,
  XP_GROWTH,
  BOSS_SPAWN_TIME,
  BOSS_HP,
  BOSS_INTRO_DURATION,
  PICKUP_LIFETIME,
  PICKUP_ATTRACT_SPEED,
  XP_VALUES,
  ENEMY_CONFIGS,
  WAVE_CONFIGS,
  WEAPON_STATS,
  PASSIVE_MAX_LEVELS,
  DEFAULT_GAME_CONFIG,
} from './config.ts';

export type { EnemyConfig, WaveConfig, WeaponLevelStats } from './config.ts';

export { applyMovement3D, distanceBetween, normalizeDirection } from './physics.ts';
export { SpatialHash } from './spatial-hash.ts';
export { fireWeapon, applyBounce } from './weapons.ts';
export { generateUpgradeOptions, xpForLevel } from './upgrades.ts';
export { GameInstance } from './GameInstance.ts';
