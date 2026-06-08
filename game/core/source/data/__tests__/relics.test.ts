import { describe, expect, it } from 'vitest';
import { rollRelic } from '../relics.ts';

function rngFrom(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
}

describe('rollRelic', () => {
  it('同稀有度还有未拥有遗物时，优先避免重复已拥有遗物', () => {
    const relic = rollRelic(1, 0, rngFrom([
      0, // rarity: common
      0, // choice among unowned common relics
    ]), { keen_lens: 1 });

    expect(relic.id).not.toBe('keen_lens');
    expect(['small_shield_charm', 'pact_coin']).toContain(relic.id);
  });
});
