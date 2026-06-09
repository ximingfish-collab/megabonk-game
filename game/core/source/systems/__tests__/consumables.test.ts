import { describe, it, expect } from 'vitest';
import {
  applyConsumable,
  applyPlayerHit,
  clearConsumableEffects,
  tickConsumableEffects,
  tickConsumablePickups,
} from '../consumables.ts';
import { makeEngine, makePlayer } from './_fixtures.ts';

describe('applyConsumable', () => {
  it('野莓即时回复 15% maxHp', () => {
    const engine = makeEngine();
    engine.state.player.maxHp = 200;
    engine.state.player.hp = 100;
    applyConsumable(engine, 'wild_berry');
    expect(engine.state.player.hp).toBe(130);
    expect(engine.state.player.activeConsumable).toBeNull();
  });

  it('新拾取覆盖旧 timed buff', () => {
    const engine = makeEngine();
    applyConsumable(engine, 'mint_candy');
    expect(engine.state.player.consumableSpeedMult).toBe(1.15);
    applyConsumable(engine, 'energy_bar');
    expect(engine.state.player.consumableSpeedMult).toBe(1);
    expect(engine.state.player.consumableAttackSpeedMult).toBe(1.20);
    expect(engine.state.player.activeConsumable?.id).toBe('energy_bar');
  });

  it('硬面包设置 nextHitNullify 并在受击时归零', () => {
    const engine = makeEngine();
    engine.state.player.hp = 100;
    applyConsumable(engine, 'hard_bread');
    expect(engine.state.player.nextHitNullify).toBe(true);
    const dmg = applyPlayerHit(engine, 50);
    expect(dmg).toBe(0);
    expect(engine.state.player.hp).toBe(100);
    expect(engine.state.player.nextHitNullify).toBe(false);
  });

  it('护盾完全吸收伤害时记录统计并推 shield 漂字', () => {
    const engine = makeEngine();
    engine.state.player.hp = 100;
    engine.state.player.shield = 10;

    const hpDamage = applyPlayerHit(engine, 5);

    expect(hpDamage).toBe(0);
    expect(engine.state.player.hp).toBe(100);
    expect(engine.state.player.shield).toBe(5);
    expect(engine.state.stats.damageTaken).toBe(5);
    expect(engine.state.stats.shieldAbsorbed).toBe(5);
    expect(engine.state.damageEvents).toHaveLength(1);
    expect(engine.state.damageEvents[0]).toMatchObject({
      damage: 5,
      isPlayerDamage: true,
      isShield: true,
    });
  });

  it('护盾部分吸收伤害时分别推 hp 和 shield 漂字', () => {
    const engine = makeEngine();
    engine.state.player.hp = 100;
    engine.state.player.shield = 10;

    const hpDamage = applyPlayerHit(engine, 15);

    expect(hpDamage).toBe(5);
    expect(engine.state.player.hp).toBe(95);
    expect(engine.state.player.shield).toBe(0);
    expect(engine.state.stats.damageTaken).toBe(15);
    expect(engine.state.stats.shieldAbsorbed).toBe(10);
    expect(engine.state.damageEvents).toHaveLength(2);
    expect(engine.state.damageEvents[0]).toMatchObject({
      damage: 5,
      isPlayerDamage: true,
      isShield: undefined,
    });
    expect(engine.state.damageEvents[1]).toMatchObject({
      damage: 10,
      isPlayerDamage: true,
      isShield: true,
    });
  });

  it('预言之书设置 nextLevelUpReroll', () => {
    const engine = makeEngine();
    applyConsumable(engine, 'prophecy_book');
    expect(engine.state.player.nextLevelUpReroll).toBe(true);
    expect(engine.state.player.activeConsumable?.id).toBe('prophecy_book');
  });
});

describe('tickConsumableEffects', () => {
  it('timed buff 到期后清除', () => {
    const engine = makeEngine();
    applyConsumable(engine, 'iron_meal');
    expect(engine.state.player.consumableArmorBonus).toBe(4);
    tickConsumableEffects(engine, 30);
    expect(engine.state.player.activeConsumable).toBeNull();
    expect(engine.state.player.consumableArmorBonus).toBe(0);
  });

  it('热汤持续回复 maxHp 2%/s', () => {
    const engine = makeEngine();
    engine.state.player.maxHp = 100;
    engine.state.player.hp = 50;
    applyConsumable(engine, 'hot_soup');
    tickConsumableEffects(engine, 1);
    expect(engine.state.player.hp).toBeCloseTo(52, 1);
  });
});

describe('tickConsumablePickups', () => {
  it('靠近玩家时拾取并生效', () => {
    const player = makePlayer({ x: 0, z: 0, pickupRadius: 5, maxHp: 100, hp: 50 });
    const base = makeEngine();
    const engine = makeEngine({
      state: { ...base.state, player, consumablePickups: [] },
    });
    engine.state.consumablePickups.push({
      id: 1,
      consumableId: 'wild_berry',
      x: 0,
      y: 0.35,
      z: 0,
      lifetime: 10,
      attracted: true,
    });
    tickConsumablePickups(engine, 0.1);
    expect(engine.state.consumablePickups).toHaveLength(0);
    expect(engine.state.player.hp).toBe(65);
  });
});

describe('clearConsumableEffects', () => {
  it('清除所有派生字段', () => {
    const player = makePlayer({
      activeConsumable: { id: 'rage_potion', remaining: 5 },
      nextHitNullify: true,
      nextLevelUpReroll: true,
      nextWeaponUpgradeBonus: 1,
      xpPickupRadiusMult: 2,
      consumableSpeedMult: 1.15,
      consumableAttackSpeedMult: 1.2,
      consumableArmorBonus: 4,
      consumableDamageMult: 1.18,
      consumableDamageTakenMult: 1.1,
    });
    clearConsumableEffects(player);
    expect(player.activeConsumable).toBeNull();
    expect(player.nextHitNullify).toBe(false);
    expect(player.nextLevelUpReroll).toBe(false);
    expect(player.nextWeaponUpgradeBonus).toBe(0);
    expect(player.consumableSpeedMult).toBe(1);
    expect(player.consumableDamageMult).toBe(1);
  });
});
