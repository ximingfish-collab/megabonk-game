/**
 * Upgrade option generation for level-up screen.
 */

import type { PlayerState, UpgradeOption, UpgradeRarity, WeaponType, PassiveType } from './types.ts';
import { MAX_WEAPONS, XP_BASE, XP_GROWTH, PASSIVE_MAX_LEVELS, WEAPON_STATS } from './config.ts';

const ALL_WEAPON_TYPES: WeaponType[] = ['bone_bouncer', 'lightning_staff', 'flame_ring', 'void_orb'];
const ALL_PASSIVE_TYPES: PassiveType[] = [
  'power_crystal', 'swift_boots', 'lifesteal_stone', 'magnet_gem',
  'armor_shard', 'attack_heart', 'crit_eye', 'lucky_coin',
  'revive_bone', 'xp_bonus', 'cooldown_reduce', 'extra_projectile',
];

const RARITY_WEIGHTS: { rarity: UpgradeRarity; weight: number }[] = [
  { rarity: 'common', weight: 60 },
  { rarity: 'uncommon', weight: 25 },
  { rarity: 'rare', weight: 12 },
  { rarity: 'legendary', weight: 3 },
];

const TOTAL_RARITY_WEIGHT = RARITY_WEIGHTS.reduce((sum, r) => sum + r.weight, 0);

/**
 * Calculate XP required to reach the next level.
 */
export function xpForLevel(level: number): number {
  return Math.floor(XP_BASE * (1 + level * XP_GROWTH));
}

/**
 * Roll a random rarity based on configured weights.
 */
function rollRarity(): UpgradeRarity {
  let roll = Math.random() * TOTAL_RARITY_WEIGHT;
  for (const { rarity, weight } of RARITY_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return 'common';
}

/**
 * Build all available upgrade options for the current player state.
 */
function buildAvailableOptions(player: PlayerState): UpgradeOption[] {
  const options: UpgradeOption[] = [];

  // Weapon upgrades for existing weapons (level up)
  for (const weapon of player.weapons) {
    const maxLevel = WEAPON_STATS[weapon.type] ? WEAPON_STATS[weapon.type].length : 8;
    if (weapon.level < maxLevel) {
      options.push({
        id: `upgrade_${weapon.type}_${weapon.level + 1}`,
        kind: 'weapon_upgrade',
        rarity: rollRarity(),
        weaponType: weapon.type,
        currentLevel: weapon.level,
        newLevel: weapon.level + 1,
      });
    }
  }

  // New weapons (if player has room)
  if (player.weapons.length < MAX_WEAPONS) {
    const ownedTypes = new Set(player.weapons.map(w => w.type));
    for (const weaponType of ALL_WEAPON_TYPES) {
      if (!ownedTypes.has(weaponType)) {
        options.push({
          id: `new_${weaponType}`,
          kind: 'new_weapon',
          rarity: rollRarity(),
          weaponType,
          currentLevel: 0,
          newLevel: 1,
        });
      }
    }
  }

  // Passive upgrades
  const ownedPassives = new Map(player.passives.map(p => [p.type, p.level]));
  for (const passiveType of ALL_PASSIVE_TYPES) {
    const currentLevel = ownedPassives.get(passiveType) ?? 0;
    const maxLevel = PASSIVE_MAX_LEVELS[passiveType] ?? 5;
    if (currentLevel < maxLevel) {
      options.push({
        id: `passive_${passiveType}_${currentLevel + 1}`,
        kind: 'passive',
        rarity: rollRarity(),
        passiveType,
        currentLevel,
        newLevel: currentLevel + 1,
      });
    }
  }

  return options;
}

/**
 * Generate upgrade options for level-up screen.
 * Guarantees at least 1 weapon-related option if possible.
 * Each option has a unique id.
 */
export function generateUpgradeOptions(player: PlayerState, count: number): UpgradeOption[] {
  const allOptions = buildAvailableOptions(player);
  if (allOptions.length === 0) return [];

  // Separate weapon options from passive options
  const weaponOptions = allOptions.filter(o => o.kind === 'weapon_upgrade' || o.kind === 'new_weapon');
  const result: UpgradeOption[] = [];
  const usedIds = new Set<string>();

  // Guarantee at least 1 weapon-related option if available
  if (weaponOptions.length > 0) {
    const idx = Math.floor(Math.random() * weaponOptions.length);
    const pick = weaponOptions[idx];
    result.push(pick);
    usedIds.add(pick.id);
  }

  // Fill remaining slots from all available options
  const remaining = allOptions.filter(o => !usedIds.has(o.id));
  let attempts = 0;
  while (result.length < count && remaining.length > 0 && attempts < 200) {
    attempts++;
    const idx = Math.floor(Math.random() * remaining.length);
    const pick = remaining[idx];
    if (!usedIds.has(pick.id)) {
      result.push(pick);
      usedIds.add(pick.id);
      remaining.splice(idx, 1);
    }
  }

  return result;
}
