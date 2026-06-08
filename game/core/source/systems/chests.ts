/**
 * 宝箱系统：开局生成 N 个，玩家靠近并交互时消耗金币开启，roll 遗物。
 * （从 systems/teleporters.ts 拆出来；旧文件已变成 deprecated 兼容 shim。）
 */
import { distanceBetween } from '../physics.ts';
import {
  CHEST_COUNT,
  CHEST_MAX_ACTIVE,
  CHEST_INTERACT_RADIUS,
  CHEST_RESPAWN_MIN_SECONDS,
  CHEST_RESPAWN_MAX_SECONDS,
} from '../config.ts';
import type { ChestState, GameConfig } from '../types.ts';
import type { Engine } from './types.ts';
import { getChestGoldCost, rollRelicForPlayer } from './relics.ts';

const CHEST_PLAYER_MIN_DISTANCE = 12;
const CHEST_PLAYER_MAX_DISTANCE = 35;

export function nextChestRespawnDelay(): number {
  return CHEST_RESPAWN_MIN_SECONDS
    + Math.random() * (CHEST_RESPAWN_MAX_SECONDS - CHEST_RESPAWN_MIN_SECONDS);
}

export function nextChestId(chests: readonly ChestState[]): number {
  return chests.reduce((max, chest) => Math.max(max, chest.id), 0) + 1;
}

export function generateChests(config: GameConfig): ChestState[] {
  const chests: ChestState[] = [];
  // 关卡手摆了 spawn_chest → 用它们；否则按旧逻辑随机环形分布。
  const placed = config.level?.chestSpawns;
  if (placed && placed.length > 0) {
    const shuffled = [...placed].sort(() => Math.random() - 0.5);
    for (const p of shuffled.slice(0, CHEST_COUNT)) {
      chests.push({
        id: chests.length + 1,
        x: p.x,
        z: p.z,
        opened: false,
      });
    }
  }

  while (chests.length < CHEST_COUNT) {
    const p = randomChestPosition(config);
    chests.push({
      id: chests.length + 1,
      x: p.x,
      z: p.z,
      opened: false,
    });
  }
  return chests;
}

function randomChestPosition(config: GameConfig): { x: number; z: number } {
  const halfMap = config.mapSize * 0.4;
  const angle = Math.random() * Math.PI * 2;
  const dist = 15 + Math.random() * halfMap * 0.5;
  return {
    x: Math.cos(angle) * dist,
    z: Math.sin(angle) * dist,
  };
}

export function tickChests(engine: Engine, dt = 0): void {
  const player = engine.state.player;
  if (!player.alive) return;

  tickChestRespawn(engine, dt);
  if (!engine.input.interact) return;

  for (const chest of engine.state.chests) {
    if (chest.opened) continue;
    const dist = distanceBetween(player.x, player.z, chest.x, chest.z);
    if (dist >= CHEST_INTERACT_RADIUS) continue;

    const cost = getChestGoldCost(player.level);
    if (player.gold < cost) return;
    player.gold -= cost;
    const relic = rollRelicForPlayer(engine);
    chest.opened = true;
    chest.relicId = relic.id;
    chest.relicRarity = relic.rarity;
    const reward = {
      chestId: chest.id,
      x: chest.x,
      y: 0.6,
      z: chest.z,
      cost,
      relicId: relic.id,
      rarity: relic.rarity,
      returnPhase: engine.state.phase,
    };
    engine.state.pendingChestReward = reward;
    engine.state.chestOpenEvents.push(reward);
    engine.state.phase = 'chest_reward';
    return;
  }
}

function tickChestRespawn(engine: Engine, dt: number): void {
  const activeCount = engine.state.chests.filter(c => !c.opened).length;
  if (activeCount >= CHEST_MAX_ACTIVE) {
    engine.chestRespawnTimer = nextChestRespawnDelay();
    return;
  }

  engine.chestRespawnTimer -= dt;
  if (engine.chestRespawnTimer > 0) return;

  const spawn = chooseChestSpawn(engine);
  engine.state.chests.push({
    id: engine.nextChestId++,
    x: spawn.x,
    z: spawn.z,
    opened: false,
  });
  engine.chestRespawnTimer = nextChestRespawnDelay();
}

function chooseChestSpawn(engine: Engine): { x: number; z: number } {
  const placed = engine.config.level?.chestSpawns ?? [];
  if (placed.length > 0) {
    const candidates = placed.filter(p => isGoodChestSpawn(engine, p.x, p.z));
    if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const player = engine.state.player;
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = CHEST_PLAYER_MIN_DISTANCE + Math.random() * (CHEST_PLAYER_MAX_DISTANCE - CHEST_PLAYER_MIN_DISTANCE);
    const x = clamp(player.x + Math.cos(angle) * dist, engine.config.mapSize);
    const z = clamp(player.z + Math.sin(angle) * dist, engine.config.mapSize);
    if (isGoodChestSpawn(engine, x, z)) return { x, z };
  }

  const angle = Math.random() * Math.PI * 2;
  const dist = CHEST_PLAYER_MIN_DISTANCE + Math.random() * (CHEST_PLAYER_MAX_DISTANCE - CHEST_PLAYER_MIN_DISTANCE);
  return {
    x: clamp(player.x + Math.cos(angle) * dist, engine.config.mapSize),
    z: clamp(player.z + Math.sin(angle) * dist, engine.config.mapSize),
  };
}

function isGoodChestSpawn(engine: Engine, x: number, z: number): boolean {
  const player = engine.state.player;
  const playerDist = distanceBetween(player.x, player.z, x, z);
  if (playerDist < CHEST_PLAYER_MIN_DISTANCE) return false;
  for (const chest of engine.state.chests) {
    if (chest.opened) continue;
    if (distanceBetween(chest.x, chest.z, x, z) < 6) return false;
  }
  return true;
}

function clamp(value: number, mapSize: number): number {
  const half = mapSize * 0.48;
  return Math.max(-half, Math.min(half, value));
}
