/**
 * Upgrade option generation for level-up screen.
 * Uses MegaBonk-style tomes (passive items) and weapons.
 */

import type { PlayerState, UpgradeOption, UpgradeRarity, WeaponType, TomeType } from './types.ts';
import { XP_BASE, XP_GROWTH, TOME_MAX_LEVELS, WEAPON_MAX_LEVEL, MAX_WEAPONS_CAP, ALL_WEAPON_TYPES, ALL_TOME_TYPES } from './config.ts';
import { getTomePower } from './tomeProgression.ts';

const RARITY_WEIGHTS: { rarity: UpgradeRarity; weight: number }[] = [
  { rarity: 'common', weight: 55 },
  { rarity: 'uncommon', weight: 28 },
  { rarity: 'rare', weight: 13 },
  { rarity: 'legendary', weight: 4 },
];

const TOTAL_RARITY_WEIGHT = RARITY_WEIGHTS.reduce((sum, r) => sum + r.weight, 0);

const MAX_TOME_TYPES = 6;
const XP_LATE_BASE = 150;
const XP_LATE_GROWTH = 1.0725;
const XP_CURVE_BREAK = 40;

/**
 * Calculate XP required to reach the next level.
 * L ≤ 40: floor(10 × (1 + L × 0.35)); L > 40: floor(150 × 1.0725^(L - 40)).
 */
export function xpForLevel(level: number): number {
  if (level <= XP_CURVE_BREAK) {
    return Math.floor(XP_BASE * (1 + level * XP_GROWTH));
  }
  return Math.floor(XP_LATE_BASE * Math.pow(XP_LATE_GROWTH, level - XP_CURVE_BREAK));
}

/**
 * 局内武器槽解锁：1 起步，10/20/30/40 级各 +1（最高 5）。
 * 第 6 槽仅在 maxWeaponSlots ≥ 6（完成「7 把不同武器」任务）且 50 级时解锁。
 */
export function computeActiveWeaponSlots(level: number, maxWeaponSlots: number): number {
  let slots = 1;
  if (level >= 10) slots++;
  if (level >= 20) slots++;
  if (level >= 30) slots++;
  if (level >= 40) slots++;
  if (level >= 50 && maxWeaponSlots >= MAX_WEAPONS_CAP) slots++;
  return Math.min(maxWeaponSlots, slots);
}

/**
 * Roll a random rarity based on configured weights.
 * Luck tome increases rare/legendary chances.
 */
function rollRarity(luckLevel: number = 0): UpgradeRarity {
  // Luck shifts weight from common to rare/legendary
  const luckBonus = luckLevel * 5;
  const adjustedWeights = RARITY_WEIGHTS.map(({ rarity, weight }) => {
    if (rarity === 'common') return { rarity, weight: Math.max(20, weight - luckBonus * 2) };
    if (rarity === 'rare') return { rarity, weight: weight + luckBonus };
    if (rarity === 'legendary') return { rarity, weight: weight + luckBonus };
    return { rarity, weight };
  });

  const total = adjustedWeights.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * total;
  for (const { rarity, weight } of adjustedWeights) {
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
  const luckLevel = getTomePower(player.tomes.find(t => t.type === 'luck_tome'));

  // Weapon upgrades for existing weapons (level up; evolved weapons are maxed out)
  for (const weapon of player.weapons) {
    if (weapon.evolved) continue;
    if (weapon.level < WEAPON_MAX_LEVEL) {
      options.push({
        id: `upgrade_${weapon.type}_${weapon.level + 1}`,
        kind: 'weapon_upgrade',
        rarity: rollRarity(luckLevel),
        weaponType: weapon.type,
        currentLevel: weapon.level,
        newLevel: weapon.level + 1,
      });
    }
  }

  // New weapons (if player has room in active slots)
  if (player.weapons.length < player.activeWeaponSlots) {
    const ownedTypes = new Set(player.weapons.map(w => w.type));
    for (const weaponType of ALL_WEAPON_TYPES) {
      if (!ownedTypes.has(weaponType)) {
        options.push({
          id: `new_${weaponType}`,
          kind: 'new_weapon',
          rarity: rollRarity(luckLevel),
          weaponType,
          currentLevel: 0,
          newLevel: 1,
        });
      }
    }
  }

  // Tome upgrades (new tomes only when holding fewer than 6 types)
  const ownedTomes = new Map(player.tomes.map(t => [t.type, t.level]));
  const ownedTomeCount = player.tomes.length;
  for (const tomeType of ALL_TOME_TYPES) {
    const currentLevel = ownedTomes.get(tomeType) ?? 0;
    const maxLevel = TOME_MAX_LEVELS[tomeType] ?? 5;
    if (currentLevel === 0 && ownedTomeCount >= MAX_TOME_TYPES) continue;
    if (currentLevel < maxLevel) {
      options.push({
        id: `tome_${tomeType}_${currentLevel + 1}`,
        kind: 'tome',
        rarity: rollRarity(luckLevel),
        tomeType,
        passiveType: tomeType, // Legacy compatibility
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

  // Separate weapon options from tome options
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
