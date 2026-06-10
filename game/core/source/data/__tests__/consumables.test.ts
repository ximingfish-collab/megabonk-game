import { describe, it, expect } from 'vitest';
import {
  CONSUMABLES,
  CONSUMABLE_DROP_BASE,
  CONSUMABLE_DROP_NORMAL,
  rollConsumableForEnemy,
  rollMiniBossBonusConsumable,
} from '../consumables.ts';

describe('CONSUMABLES table', () => {
  it('包含 10 种消耗品 F01–F10', () => {
    expect(Object.keys(CONSUMABLES)).toHaveLength(10);
    const codes = Object.values(CONSUMABLES).map(c => c.code).sort();
    expect(codes).toEqual([
      'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10',
    ]);
  });

  it('普通怪掉落池不含 F09/F10', () => {
    expect(CONSUMABLE_DROP_NORMAL).not.toContain('prophecy_book');
    expect(CONSUMABLE_DROP_NORMAL).not.toContain('craftsman_hammer');
    expect(CONSUMABLE_DROP_NORMAL).toHaveLength(8);
  });
});

describe('rollConsumableForEnemy', () => {
  it('普通怪基础 2% × dropMult', () => {
    let drops = 0;
    const rng = () => 0;
    for (let i = 0; i < 100; i++) {
      if (rollConsumableForEnemy(false, false, 1, rng)) drops++;
    }
    expect(drops).toBe(100);
  });

  it('roll 高于阈值时不掉', () => {
    const rng = () => 0.99;
    expect(rollConsumableForEnemy(false, false, 1, rng)).toBeNull();
    expect(rollConsumableForEnemy(false, true, 1, rng)).toBeNull();
  });

  it('consumable_tome Lv8 普通怪约 2.8%（2% × 1.4）', () => {
    const dropMult = 1.4;
    const threshold = CONSUMABLE_DROP_BASE.normal * dropMult;
    expect(threshold).toBeCloseTo(0.028, 5);
    expect(rollConsumableForEnemy(false, false, dropMult, () => threshold - 0.001)).not.toBeNull();
    expect(rollConsumableForEnemy(false, false, dropMult, () => threshold)).toBeNull();
  });

  it('Mini-Boss 额外 roll 30% × dropMult', () => {
    const dropMult = 1.4;
    const threshold = CONSUMABLE_DROP_BASE.miniBossBonus * dropMult;
    expect(rollMiniBossBonusConsumable(dropMult, () => threshold - 0.001)).not.toBeNull();
    expect(rollMiniBossBonusConsumable(dropMult, () => threshold)).toBeNull();
  });
});
