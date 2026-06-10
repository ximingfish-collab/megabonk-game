/**
 * 增强碰撞系统测试
 *
 * 验证RapierJS集成是否正常工作
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { enhancedCollision } from '../collisionEnhanced.ts';
import type { LevelGeometry, RampVolume, CollisionRect } from '../../types.ts';

// 测试用的斜坡数据
const testRamp: RampVolume = {
  cx: 0,
  cz: 0,
  halfSlope: 5,
  halfPerp: 5,
  slopeDirX: 1,
  slopeDirZ: 0,
  lowY: 0,
  highY: 4
};

// 测试用的平台数据
const testRect: CollisionRect = {
  cx: 10,
  cz: 10,
  halfW: 2,
  halfD: 2,
  height: 3
};

// 测试用的关卡几何
const testLevelGeometry: LevelGeometry = {
  rects: [testRect],
  ramps: [testRamp],
  solidBoxes: [],
  climbs: [],
  wysiwyg: true
};

describe('增强碰撞系统', () => {
  beforeEach(async () => {
    await enhancedCollision.init(testLevelGeometry);
  });

  afterEach(() => {
    enhancedCollision.destroy();
  });

  it('应正确初始化RapierJS系统', () => {
    const status = enhancedCollision.getStatus();
    expect(status.rapierEnabled).toBe(true);
    expect(status.levelLoaded).toBe(true);
  });

  it('应在斜坡上精确计算高度', () => {
    // 测试斜坡低端
    const heightLow = enhancedCollision.getTerrainHeightAt(-5, 0);
    expect(heightLow).toBeCloseTo(0, 0.1);

    // 测试斜坡中端
    const heightMid = enhancedCollision.getTerrainHeightAt(0, 0);
    expect(heightMid).toBeCloseTo(2, 0.1);

    // 测试斜坡高端
    const heightHigh = enhancedCollision.getTerrainHeightAt(5, 0);
    expect(heightHigh).toBeCloseTo(4, 0.1);
  });

  it('应正确检测支撑面高度', () => {
    // 在斜坡低端，脚在y=0处
    const supportHeight = enhancedCollision.getSupportHeightAt(-5, 0, 0);
    expect(supportHeight).toBeCloseTo(0, 0.1);

    // 在斜坡高端，脚在y=0处，支撑面应该可达
    const supportHeightHigh = enhancedCollision.getSupportHeightAt(5, 0, 0);
    expect(supportHeightHigh).toBeCloseTo(4, 0.1);
  });

  it('应正确检测位置安全性', () => {
    // 安全位置（斜坡上）
    const safePosition = { x: 0, y: 2, z: 0 };
    expect(enhancedCollision.isPositionSafe(safePosition)).toBe(true);

    // 不安全位置（虚空）
    const unsafePosition = { x: 100, y: -10, z: 100 };
    expect(enhancedCollision.isPositionSafe(unsafePosition)).toBe(false);
  });

  it('应正确检测水平阻挡', () => {
    // 在平台上，不应被阻挡
    const notBlocked = enhancedCollision.isBlockedHorizontallyAt(10, 10, 3);
    expect(notBlocked).toBe(false);

    // 在平台下方，不应被阻挡（可从下方穿过）
    const notBlockedBelow = enhancedCollision.isBlockedHorizontallyAt(10, 10, 0);
    expect(notBlockedBelow).toBe(false);
  });

  it('应正确处理RapierJS初始化失败的回退', async () => {
    // 模拟RapierJS初始化失败
    const originalInit = enhancedCollision.init;
    enhancedCollision.init = async () => {
      // 模拟初始化失败
      throw new Error('RapierJS初始化失败');
    };

    try {
      await enhancedCollision.init(testLevelGeometry);
    } catch (error) {
      // 预期会回退到基础系统
      const status = enhancedCollision.getStatus();
      expect(status.rapierEnabled).toBe(false);
      expect(status.levelLoaded).toBe(true);
    }

    // 恢复原始方法
    enhancedCollision.init = originalInit;
  });

  it('应正确更新物理系统', () => {
    // 更新不应抛出错误
    expect(() => {
      enhancedCollision.update(1/60);
    }).not.toThrow();
  });
});