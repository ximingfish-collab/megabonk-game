import { CHARACTER_CONFIGS, PLAYER_MOVE_SPEED_MULTIPLIER } from '../config.ts';
import type { CharacterType, PlayerState } from '../types.ts';

export interface CharacterTraitResult {
  xpBonus?: number;
  critChanceBonus?: number;
  critDamageBonus?: number;
  attackSpeedBonus?: number;
}

export type CharacterTraitFn = (player: PlayerState) => CharacterTraitResult;

function megachadTrait(player: PlayerState): CharacterTraitResult {
  const effectiveDamageMultiplier = player.damageMultiplier * (player.consumableDamageMult ?? 1);
  const damageExcess = Math.max(0, effectiveDamageMultiplier - 1.0);
  return { xpBonus: damageExcess * 0.22 };
}

function robertoTrait(player: PlayerState): CharacterTraitResult {
  const effectiveArmor = player.armor + (player.consumableArmorBonus ?? 0);
  const armorPoints = Math.max(0, effectiveArmor) * 0.008;
  const critRoom = Math.max(0, 1.0 - player.critChance);
  const critChanceBonus = Math.min(armorPoints, critRoom);
  const overflow = Math.max(0, armorPoints - critChanceBonus);

  return {
    critChanceBonus,
    critDamageBonus: overflow * 0.80,
  };
}

function skateboardSkeletonTrait(player: PlayerState): CharacterTraitResult {
  const baseSpeed = CHARACTER_CONFIGS.skateboard_skeleton.speed * PLAYER_MOVE_SPEED_MULTIPLIER;
  const effectiveSpeed = player.speed * (player.consumableSpeedMult ?? 1);
  const speedExcess = Math.max(0, effectiveSpeed - baseSpeed);
  return { attackSpeedBonus: speedExcess * 0.025 };
}

export const CHARACTER_TRAITS: Record<CharacterType, CharacterTraitFn> = {
  megachad: megachadTrait,
  roberto: robertoTrait,
  skateboard_skeleton: skateboardSkeletonTrait,
};
