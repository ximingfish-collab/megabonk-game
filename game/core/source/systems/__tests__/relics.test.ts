import { describe, expect, it } from 'vitest';
import { grantRelic } from '../relics.ts';
import { makeEngine } from './_fixtures.ts';

describe('grantRelic', () => {
  it('keen_lens 通过 stat pipeline 立即生效', () => {
    const engine = makeEngine();

    grantRelic(engine, 'keen_lens');

    expect(engine.state.player.relicStacks.keen_lens).toBe(1);
    expect(engine.state.player.critChance).toBeCloseTo(0.08 + 0.03, 5);
  });

  it('iron_heart 多层通过 stat pipeline 重算 maxHp 和 armor', () => {
    const engine = makeEngine();

    grantRelic(engine, 'iron_heart');
    grantRelic(engine, 'iron_heart');
    grantRelic(engine, 'iron_heart');

    expect(engine.state.player.relicStacks.iron_heart).toBe(3);
    expect(engine.state.player.maxHp).toBeCloseTo(100 * 1.36, 5);
    expect(engine.state.player.armor).toBe(6);
  });
});
