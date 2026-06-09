/**
 * 消耗品数据表 —— 10 种消耗品 + 怪物掉落权重。
 *
 * 掉落基础概率（× consumableDropMult）：
 *   普通怪 2% · 精英 12% · Mini-Boss 45%（保底 1 件 + 30% 额外 1 件）
 */
import type { ConsumableId } from '../types.ts';

export type ConsumableEffectKind = 'instant' | 'timed' | 'one_shot';

export interface ConsumableDef {
  id: ConsumableId;
  code: string;
  name: string;
  emoji: string;
  kind: ConsumableEffectKind;
  /** timed 消耗品的持续秒数。 */
  duration?: number;
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  wild_berry: {
    id: 'wild_berry',
    code: 'F01',
    name: '野莓',
    emoji: '🫐',
    kind: 'instant',
  },
  hot_soup: {
    id: 'hot_soup',
    code: 'F02',
    name: '热汤',
    emoji: '🍲',
    kind: 'timed',
    duration: 15,
  },
  mint_candy: {
    id: 'mint_candy',
    code: 'F03',
    name: '薄荷糖',
    emoji: '🍬',
    kind: 'timed',
    duration: 20,
  },
  hard_bread: {
    id: 'hard_bread',
    code: 'F04',
    name: '硬面包',
    emoji: '🥖',
    kind: 'one_shot',
  },
  energy_bar: {
    id: 'energy_bar',
    code: 'F05',
    name: '能量棒',
    emoji: '🍫',
    kind: 'timed',
    duration: 25,
  },
  magnet: {
    id: 'magnet',
    code: 'F06',
    name: '磁铁',
    emoji: '🧲',
    kind: 'timed',
    duration: 25,
  },
  iron_meal: {
    id: 'iron_meal',
    code: 'F07',
    name: '铁甲餐',
    emoji: '🍱',
    kind: 'timed',
    duration: 30,
  },
  rage_potion: {
    id: 'rage_potion',
    code: 'F08',
    name: '狂怒药',
    emoji: '💢',
    kind: 'timed',
    duration: 20,
  },
  prophecy_book: {
    id: 'prophecy_book',
    code: 'F09',
    name: '预言之书',
    emoji: '📖',
    kind: 'one_shot',
  },
  craftsman_hammer: {
    id: 'craftsman_hammer',
    code: 'F10',
    name: '匠神锤',
    emoji: '🔨',
    kind: 'one_shot',
  },
};

/** 普通怪掉落池（均匀 F01–F08，不含 F09/F10）。 */
export const CONSUMABLE_DROP_NORMAL: ConsumableId[] = [
  'wild_berry', 'hot_soup', 'mint_candy', 'hard_bread',
  'energy_bar', 'magnet', 'iron_meal', 'rage_potion',
];

/** 精英 / Mini-Boss 权重表：F01–F08 权重 10，F09/F10 权重 1。 */
export const CONSUMABLE_DROP_WEIGHTED: { id: ConsumableId; weight: number }[] = [
  ...CONSUMABLE_DROP_NORMAL.map(id => ({ id, weight: 10 })),
  { id: 'prophecy_book', weight: 1 },
  { id: 'craftsman_hammer', weight: 1 },
];

export const CONSUMABLE_DROP_BASE = {
  normal: 0.02,
  elite: 0.12,
  miniBoss: 0.45,
  miniBossBonus: 0.30,
} as const;

function pickUniform<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function pickWeighted(
  table: readonly { id: ConsumableId; weight: number }[],
  rng: () => number,
): ConsumableId {
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return table[table.length - 1].id;
}

/** 按敌人档次 roll 是否掉落 1 件消耗品；null = 未掉。 */
export function rollConsumableForEnemy(
  isElite: boolean,
  isMiniBoss: boolean,
  dropMult: number,
  rng: () => number = Math.random,
): ConsumableId | null {
  if (isMiniBoss) {
    if (rng() >= CONSUMABLE_DROP_BASE.miniBoss * dropMult) return null;
    return pickWeighted(CONSUMABLE_DROP_WEIGHTED, rng);
  }
  if (isElite) {
    if (rng() >= CONSUMABLE_DROP_BASE.elite * dropMult) return null;
    return pickWeighted(CONSUMABLE_DROP_WEIGHTED, rng);
  }
  if (rng() >= CONSUMABLE_DROP_BASE.normal * dropMult) return null;
  return pickUniform(CONSUMABLE_DROP_NORMAL, rng);
}

/** Mini-Boss 额外 roll（30% 再掉 1 件）。 */
export function rollMiniBossBonusConsumable(
  dropMult: number,
  rng: () => number = Math.random,
): ConsumableId | null {
  if (rng() >= CONSUMABLE_DROP_BASE.miniBossBonus * dropMult) return null;
  return pickWeighted(CONSUMABLE_DROP_WEIGHTED, rng);
}
