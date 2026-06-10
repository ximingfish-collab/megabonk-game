import { CHARACTER_TRAITS } from '../data/traits.ts';
import type { CharacterType, PlayerState } from '../types.ts';

export function applyCharacterTrait(player: PlayerState, character: CharacterType): void {
  const previousAttackSpeedBonus = player.characterTraitAttackSpeedBonus ?? 0;
  if (previousAttackSpeedBonus !== 0) {
    player.attackSpeedMultiplier /= 1 + previousAttackSpeedBonus;
  }
  player.critChance -= player.characterTraitCritChanceBonus ?? 0;
  player.critDamage -= player.characterTraitCritDamageBonus ?? 0;

  player.characterTraitXpBonus = 0;
  player.characterTraitCritChanceBonus = 0;
  player.characterTraitCritDamageBonus = 0;
  player.characterTraitAttackSpeedBonus = 0;

  const result = CHARACTER_TRAITS[character]?.(player);
  if (!result) return;

  player.characterTraitXpBonus = result.xpBonus ?? 0;
  player.characterTraitCritChanceBonus = result.critChanceBonus ?? 0;
  player.characterTraitCritDamageBonus = result.critDamageBonus ?? 0;
  player.characterTraitAttackSpeedBonus = result.attackSpeedBonus ?? 0;

  player.critChance += player.characterTraitCritChanceBonus;
  player.critDamage += player.characterTraitCritDamageBonus;
  player.attackSpeedMultiplier *= 1 + player.characterTraitAttackSpeedBonus;
}
