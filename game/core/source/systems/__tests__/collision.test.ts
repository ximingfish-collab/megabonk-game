/**
 * collision.{getTerrainHeight, getSupportHeight, isBlockedHorizontally, findClimb,
 *           loadLevel, clearLevel} 单元测试。
 *
 * 锁定 PR #7 引入的关卡碰撞 API 在以下场景的行为：
 *   - 内置 Neon Crucible（无关卡）
 *   - 加载关卡（wysiwyg 模式 + 阶段 1 软虚空保底）
 *   - col_ / wall_ / climb_ / ramp_ 各类几何
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTerrainHeight,
  getSupportHeight,
  isBlockedHorizontally,
  findClimb,
  loadLevel,
  clearLevel,
  VOID_HEIGHT,
} from '../collision.ts';
import type { LevelData } from '../../types.ts';

function makeLevel(overrides: Partial<LevelData> = {}): LevelData {
  return {
    collisionRects: [],
    walls: [],
    climbVolumes: [],
    ramps: [],
    spawnPoints: {},
    chestSpawns: [],
    ...overrides,
  };
}

describe('collision', () => {
  beforeEach(() => {
    clearLevel(); // 每个用例从内置 Neon Crucible 起步
  });

  // ─── getTerrainHeight ──────────────────────────────────────────────

  describe('getTerrainHeight (内置 Neon Crucible)', () => {
    it('原点 = y=0', () => {
      expect(getTerrainHeight(0, 0)).toBe(0);
    });

    it('远点 (100, 100) = y=0（默认地板）', () => {
      expect(getTerrainHeight(100, 100)).toBe(0);
    });

    it('Nest 角 (38, 38) = y=6', () => {
      expect(getTerrainHeight(38, 38)).toBe(6);
    });
  });

  describe('getTerrainHeight (加载关卡, 阶段 1 软虚空)', () => {
    it('col_ 内返回 col_ 的 height', () => {
      loadLevel(makeLevel({
        collisionRects: [{ cx: 0, cz: 0, halfW: 5, halfD: 5, height: 3 }],
      }));
      expect(getTerrainHeight(0, 0)).toBe(3);
      expect(getTerrainHeight(4.9, 4.9)).toBe(3);
    });

    it('col_ 外返回 0（软虚空）—— 不返回 -Infinity', () => {
      loadLevel(makeLevel({
        collisionRects: [{ cx: 0, cz: 0, halfW: 5, halfD: 5, height: 3 }],
      }));
      const h = getTerrainHeight(100, 100);
      expect(h).toBe(0);
      expect(Number.isFinite(h)).toBe(true);
    });

    it('多个 col_ 重叠取 max', () => {
      loadLevel(makeLevel({
        collisionRects: [
          { cx: 0, cz: 0, halfW: 5, halfD: 5, height: 3 },
          { cx: 0, cz: 0, halfW: 3, halfD: 3, height: 7 },
        ],
      }));
      expect(getTerrainHeight(0, 0)).toBe(7);
      expect(getTerrainHeight(4, 4)).toBe(3); // 外圈范围内但内圈外
    });

    it('ramp 顶面线性插值（沿 x 轴）', () => {
      loadLevel(makeLevel({
        ramps: [{
          cx: 0, cz: 0, halfW: 5, halfD: 5,
          axis: 'x', lowY: 0, highY: 4, ascendPositive: true,
        }],
      }));
      expect(getTerrainHeight(-5, 0)).toBeCloseTo(0, 1); // 低端
      expect(getTerrainHeight(0, 0)).toBeCloseTo(2, 1);  // 中段
      expect(getTerrainHeight(5, 0)).toBeCloseTo(4, 1);  // 高端
    });

    it('ramp ascendPositive=false → 反向', () => {
      loadLevel(makeLevel({
        ramps: [{
          cx: 0, cz: 0, halfW: 5, halfD: 5,
          axis: 'x', lowY: 0, highY: 4, ascendPositive: false,
        }],
      }));
      expect(getTerrainHeight(-5, 0)).toBeCloseTo(4, 1);
      expect(getTerrainHeight(5, 0)).toBeCloseTo(0, 1);
    });
  });

  // ─── getSupportHeight ──────────────────────────────────────────────

  describe('getSupportHeight (反映 STEP_HEIGHT 可达性)', () => {
    it('脚下 y=0、目标 col_ 顶面 y=2 → 不可达 → 返回 0（默认地板）', () => {
      loadLevel(makeLevel({
        collisionRects: [{ cx: 0, cz: 0, halfW: 5, halfD: 5, height: 2 }],
      }));
      // limit = 0 + STEP_HEIGHT(0.5) = 0.5；col_ 顶面 2 > 0.5 → 忽略
      expect(getSupportHeight(0, 0, 0)).toBe(0);
    });

    it('脚下 y=2、col_ 顶面 y=2 → 可达 → 返回 2', () => {
      loadLevel(makeLevel({
        collisionRects: [{ cx: 0, cz: 0, halfW: 5, halfD: 5, height: 2 }],
      }));
      expect(getSupportHeight(0, 0, 2)).toBe(2);
    });

    it('脚下 y=1.6 (跳跃接近顶峰)、col_ 顶面 y=2 → 在迈步内 → 返回 2', () => {
      // limit = 1.6 + 0.5 = 2.1 ≥ 2 → 可达
      loadLevel(makeLevel({
        collisionRects: [{ cx: 0, cz: 0, halfW: 5, halfD: 5, height: 2 }],
      }));
      expect(getSupportHeight(0, 0, 1.6)).toBe(2);
    });

    it('脚下 y=-1（已经掉到地面下）→ 默认地板也不可达 → VOID_HEIGHT', () => {
      // limit = -1 + 0.5 = -0.5 < 0 → 默认 0 地板被排除
      expect(getSupportHeight(0, 0, -1)).toBe(VOID_HEIGHT);
    });

    it('多个可达面取 max', () => {
      loadLevel(makeLevel({
        collisionRects: [
          { cx: 0, cz: 0, halfW: 5, halfD: 5, height: 1 },
          { cx: 0, cz: 0, halfW: 3, halfD: 3, height: 1.4 },
        ],
      }));
      // limit = 1.5 + 0.5 = 2 → 两个都可达
      expect(getSupportHeight(0, 0, 1.5)).toBeCloseTo(1.4, 2);
    });
  });

  // ─── isBlockedHorizontally ──────────────────────────────────────────

  describe('isBlockedHorizontally (col_ / wall_ / climb_)', () => {
    it('col_ 顶面在迈步范围内 → 不挡（可踩上去）', () => {
      loadLevel(makeLevel({
        collisionRects: [{ cx: 0, cz: 0, halfW: 5, halfD: 5, height: 0.3 }],
      }));
      expect(isBlockedHorizontally(0, 0, 0)).toBe(false);
    });

    it('col_ 顶面高于迈步 → 挡', () => {
      loadLevel(makeLevel({
        collisionRects: [{ cx: 0, cz: 0, halfW: 5, halfD: 5, height: 3 }],
      }));
      expect(isBlockedHorizontally(0, 0, 0)).toBe(true);
    });

    it('wall_ 整体在头顶之上 → 不挡（可从下方穿过）', () => {
      loadLevel(makeLevel({
        walls: [{ cx: 0, cz: 0, halfW: 5, halfD: 5, bottomY: 5, topY: 8 }],
      }));
      // 玩家身高 1.4，头顶 = feet + 1.4 = 1.4 < bottomY 5 → 不挡
      expect(isBlockedHorizontally(0, 0, 0)).toBe(false);
    });

    it('wall_ 底部在身高内 → 挡', () => {
      loadLevel(makeLevel({
        walls: [{ cx: 0, cz: 0, halfW: 5, halfD: 5, bottomY: 0, topY: 3 }],
      }));
      expect(isBlockedHorizontally(0, 0, 0)).toBe(true);
    });

    it('climb_ 默认挡（走不穿），includeClimb=false 时放行', () => {
      loadLevel(makeLevel({
        climbVolumes: [{ cx: 0, cz: 0, halfW: 1, halfD: 1, bottomY: 0, topY: 4 }],
      }));
      expect(isBlockedHorizontally(0, 0, 0, true)).toBe(true);
      expect(isBlockedHorizontally(0, 0, 0, false)).toBe(false);
    });

    it('盒子之外 → 不挡', () => {
      loadLevel(makeLevel({
        collisionRects: [{ cx: 0, cz: 0, halfW: 5, halfD: 5, height: 3 }],
      }));
      expect(isBlockedHorizontally(20, 20, 0)).toBe(false);
    });

    it('radius 参数把碰撞半径外扩', () => {
      loadLevel(makeLevel({
        walls: [{ cx: 0, cz: 0, halfW: 1, halfD: 1, bottomY: 0, topY: 3 }],
      }));
      // 在 (1.5, 0)：默认 radius 0.45 → 1 + 0.45 = 1.45 < 1.5 → 不挡
      expect(isBlockedHorizontally(1.5, 0, 0)).toBe(false);
      // radius=1 → 1 + 1 = 2 ≥ 1.5 → 挡
      expect(isBlockedHorizontally(1.5, 0, 0, true, 1)).toBe(true);
    });
  });

  // ─── findClimb ─────────────────────────────────────────────────────

  describe('findClimb', () => {
    it('在 climb_ footprint 内、高度区间内 → 返回该 climb', () => {
      const climb = { cx: 0, cz: 0, halfW: 1, halfD: 1, bottomY: 0, topY: 4 };
      loadLevel(makeLevel({ climbVolumes: [climb] }));
      const found = findClimb(0, 0, 1);
      expect(found).not.toBeNull();
      expect(found?.topY).toBe(4);
    });

    it('在 footprint 外（超出 grab margin）→ null', () => {
      loadLevel(makeLevel({
        climbVolumes: [{ cx: 0, cz: 0, halfW: 1, halfD: 1, bottomY: 0, topY: 4 }],
      }));
      // grab margin 0.6, halfW 1 → 边界 1.6；测 2 应该 null
      expect(findClimb(2, 0, 1)).toBeNull();
    });

    it('feetY 远高于 topY → null', () => {
      loadLevel(makeLevel({
        climbVolumes: [{ cx: 0, cz: 0, halfW: 1, halfD: 1, bottomY: 0, topY: 4 }],
      }));
      expect(findClimb(0, 0, 10)).toBeNull();
    });

    it('feetY 远低于 bottomY → null', () => {
      loadLevel(makeLevel({
        climbVolumes: [{ cx: 0, cz: 0, halfW: 1, halfD: 1, bottomY: 5, topY: 9 }],
      }));
      expect(findClimb(0, 0, 0)).toBeNull();
    });

    it('feetY 略低于 bottomY (margin 0.5)→ 仍可抓', () => {
      loadLevel(makeLevel({
        climbVolumes: [{ cx: 0, cz: 0, halfW: 1, halfD: 1, bottomY: 5, topY: 9 }],
      }));
      expect(findClimb(0, 0, 4.7)).not.toBeNull();
    });

    it('多个 climb_，返回第一个匹配的', () => {
      loadLevel(makeLevel({
        climbVolumes: [
          { cx: 0, cz: 0, halfW: 1, halfD: 1, bottomY: 0, topY: 4 },
          { cx: 10, cz: 0, halfW: 1, halfD: 1, bottomY: 0, topY: 4 },
        ],
      }));
      expect(findClimb(0, 0, 1)?.cx).toBe(0);
      expect(findClimb(10, 0, 1)?.cx).toBe(10);
    });
  });

  // ─── loadLevel / clearLevel ────────────────────────────────────────

  describe('loadLevel / clearLevel state management', () => {
    it('loadLevel 后再 clearLevel → 回到 Neon Crucible 行为', () => {
      loadLevel(makeLevel({
        collisionRects: [{ cx: 0, cz: 0, halfW: 5, halfD: 5, height: 7 }],
      }));
      expect(getTerrainHeight(0, 0)).toBe(7);

      clearLevel();
      expect(getTerrainHeight(0, 0)).toBe(0); // 内置 ground 中央
      expect(getTerrainHeight(38, 38)).toBe(6); // 内置 nest
    });

    it('两次 loadLevel 之间状态完全替换，旧 col_ 不残留', () => {
      loadLevel(makeLevel({
        collisionRects: [{ cx: 0, cz: 0, halfW: 5, halfD: 5, height: 3 }],
      }));
      loadLevel(makeLevel({
        collisionRects: [{ cx: 100, cz: 100, halfW: 1, halfD: 1, height: 9 }],
      }));
      expect(getTerrainHeight(0, 0)).toBe(0); // 旧的没了 → 软虚空 → 0
      expect(getTerrainHeight(100, 100)).toBe(9);
    });
  });
});
