import { getTomePower } from '../tomeProgression.ts';
import { RELICS, getRelicStack, rollRelic, type RelicDef } from '../data/relics.ts';
import type { EnemyState, RelicId } from '../types.ts';
import type { Engine } from './types.ts';

export const CHEST_GOLD_COST_BASE = 35;
export const CHEST_GOLD_COST_PER_LEVEL = 3;
export const CHEST_GOLD_COST_LEVEL_POWER = 1.25;
export const CHEST_GOLD_COST_POWER_SCALE = 0.75;

export function getChestGoldCost(playerLevel: number): number {
  const level = Math.max(1, playerLevel);
  return Math.floor(
    CHEST_GOLD_COST_BASE
    + level * CHEST_GOLD_COST_PER_LEVEL
    + Math.pow(level, CHEST_GOLD_COST_LEVEL_POWER) * CHEST_GOLD_COST_POWER_SCALE,
  );
}

export function rollRelicForPlayer(engine: Engine, rng: () => number = Math.random): RelicDef {
  const player = engine.state.player;
  const luckTome = player.tomes.find(t => t.type === 'luck_tome');
  const luckBonus = (player.luckBonus ?? 0) + getTomePower(luckTome) * 0.02;
  return rollRelic(player.level, luckBonus, rng, player.relicStacks);
}

export function grantRelic(engine: Engine, relicId: RelicId): void {
  const player = engine.state.player;
  const before = getRelicStack(player, relicId);
  const next = before + 1;
  player.relicStacks[relicId] = next;

  switch (relicId) {
    case 'keen_lens':
      player.critChance += 0.03;
      break;
    case 'small_shield_charm':
      player.maxShield = (player.maxShield ?? 0) + 5;
      player.shield = Math.min(player.maxShield, (player.shield ?? 0) + 2);
      break;
    case 'regen_core':
      player.hpRegenRate = (player.hpRegenRate ?? 0) + 0.5;
      break;
    case 'magazine_expander':
      player.projectileBonus = (player.projectileBonus ?? 0) + 1;
      break;
    case 'elite_writ':
      player.eliteDamageMult = 1 + next * 0.10;
      break;
    case 'iron_heart': {
      player.armor += 2;
      const beforeMult = 1 + before * 0.12;
      const nextMult = 1 + next * 0.12;
      player.maxHp = (player.maxHp / beforeMult) * nextMult;
      player.hp = Math.min(player.hp, player.maxHp);
      break;
    }
  }
}

export function applyRelicKillEffects(engine: Engine, enemy: EnemyState): void {
  const player = engine.state.player;
  const bloodFang = getRelicStack(player, 'blood_fang');
  if (bloodFang > 0) {
    const heal = (enemy.isElite || enemy.isMiniBoss ? 6 : 2) * bloodFang;
    player.hp = Math.min(player.maxHp, player.hp + heal);
  }
}

export function rollGoldForEnemy(engine: Engine, enemy: EnemyState): number {
  if (enemy.isMiniBoss) {
    return Math.round(15 + Math.floor(Math.random() * 11) + engine.state.player.level * 0.2);
  }

  let amount = Math.floor(1 + engine.config.tier * 0.4 + Math.floor(Math.random() * 3));
  if (enemy.isElite) {
    amount = amount * (3 + Math.floor(Math.random() * 3)) + 3;
  }
  return amount;
}

export function getRelicBonusGoldOnKill(engine: Engine): number {
  return getRelicStack(engine.state.player, 'pact_coin');
}

export function getRelicDamageMultiplier(engine: Engine): number {
  const player = engine.state.player;
  let mult = 1;

  const arsenalBadge = getRelicStack(player, 'arsenal_badge');
  if (arsenalBadge > 0) {
    const level10Weapons = player.weapons.filter(w => w.level >= 10).length;
    mult *= 1 + level10Weapons * 0.04 * arsenalBadge;
  }

  const hourglass = getRelicStack(player, 'hourglass');
  if (hourglass > 0 && engine.state.overtimeSeconds > 0) {
    mult *= 1 + engine.state.overtimeSeconds * 0.0012 * hourglass;
  }

  return mult;
}

export function applyRelicTargetDamage(engine: Engine, damage: number, enemy: EnemyState): number {
  if (!enemy.isElite && !enemy.isMiniBoss) return damage;
  const eliteWrit = getRelicStack(engine.state.player, 'elite_writ');
  if (eliteWrit <= 0) return damage;
  return Math.round(damage * (1 + eliteWrit * 0.10));
}

export function getRelicDef(relicId: RelicId): RelicDef {
  return RELICS[relicId];
}
