/**
 * RapierJS集成演示脚本
 *
 * 展示如何将增强碰撞系统集成到现有游戏中
 * 解决斜面精度、模型错位、"下线"问题
 */

import { enhancedCollision } from '../systems/collisionEnhanced.ts';
import type { GameInstance, GameState, LevelData } from '../types.ts';
import { makeLevelGeometry } from '../systems/collision.ts';

/**
 * 游戏实例的RapierJS集成包装器
 */
export class RapierGameIntegration {
  private isInitialized = false;

  /**
   * 初始化RapierJS集成
   */
  async init(gameInstance: GameInstance): Promise<void> {
    if (this.isInitialized) return;

    console.log('正在初始化RapierJS游戏集成...');

    try {
      // 获取当前关卡的几何数据
      const levelGeometry = this.extractLevelGeometry(gameInstance);

      // 初始化增强碰撞系统
      await enhancedCollision.init(levelGeometry);

      this.isInitialized = true;
      console.log('RapierJS游戏集成初始化成功');

      // 打印系统状态
      const status = enhancedCollision.getStatus();
      console.log('增强碰撞系统状态:', status);
    } catch (error) {
      console.error('RapierJS游戏集成初始化失败:', error);
      throw error;
    }
  }

  /**
   * 从游戏实例提取关卡几何数据
   */
  private extractLevelGeometry(gameInstance: GameInstance) {
    // 这里需要根据实际游戏结构获取关卡数据
    // 暂时返回一个默认几何作为演示
    return makeLevelGeometry(); // 使用内置Neon Crucible
  }

  /**
   * 每帧更新物理系统
   */
  update(deltaTime: number): void {
    if (this.isInitialized) {
      enhancedCollision.update(deltaTime);
    }
  }

  /**
   * 增强的玩家位置验证（防"下线"）
   */
  validatePlayerPosition(playerState: { x: number; y: number; z: number }): boolean {
    if (!this.isInitialized) return true; // 未启用时返回安全

    const isSafe = enhancedCollision.isPositionSafe(playerState);

    if (!isSafe) {
      console.warn('玩家位置不安全，可能存在"下线"风险:', playerState);
      this.recoverPlayerPosition(playerState);
    }

    return isSafe;
  }

  /**
   * 恢复玩家到安全位置
   */
  private recoverPlayerPosition(position: { x: number; y: number; z: number }): void {
    // 尝试找到最近的安全位置
    const safeHeight = enhancedCollision.getTerrainHeightAt(position.x, position.z);

    if (safeHeight !== null) {
      position.y = safeHeight + 0.1; // 稍微抬高避免立即再次检测
      console.log('已恢复玩家到安全高度:', position.y);
    } else {
      // 如果找不到安全位置，重置到原点
      position.x = 0;
      position.y = 0;
      position.z = 0;
      console.log('已重置玩家到原点');
    }
  }

  /**
   * 增强的移动碰撞检测
   */
  checkMovementCollision(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    radius: number
  ): { allowed: boolean; hitPoint?: { x: number; y: number; z: number } } {
    if (!this.isInitialized) {
      return { allowed: true }; // 未启用时允许移动
    }

    // 检查目标位置是否被阻挡
    const isBlocked = enhancedCollision.isBlockedHorizontallyAt(
      to.x, to.z, to.y, true, radius
    );

    if (isBlocked) {
      return { allowed: false };
    }

    // 检查移动路径上的碰撞
    const direction = {
      x: to.x - from.x,
      y: to.y - from.y,
      z: to.z - from.z
    };

    const distance = Math.sqrt(direction.x * direction.x + direction.z * direction.z);

    if (distance > 0) {
      const normalizedDir = {
        x: direction.x / distance,
        y: direction.y / distance,
        z: direction.z / distance
      };

      // 沿路径分段检测
      const steps = Math.ceil(distance / radius);
      for (let i = 1; i <= steps; i++) {
        const stepDistance = Math.min(i * radius, distance);
        const checkPoint = {
          x: from.x + normalizedDir.x * stepDistance,
          y: from.y + normalizedDir.y * stepDistance,
          z: from.z + normalizedDir.z * stepDistance
        };

        const stepBlocked = enhancedCollision.isBlockedHorizontallyAt(
          checkPoint.x, checkPoint.z, checkPoint.y, true, radius
        );

        if (stepBlocked) {
          return { allowed: false, hitPoint: checkPoint };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * 获取斜坡上的精确高度（解决斜面问题）
   */
  getPreciseSlopeHeight(x: number, z: number): number {
    if (!this.isInitialized) {
      return 0; // 回退到默认高度
    }

    return enhancedCollision.getTerrainHeightAt(x, z);
  }

  /**
   * 调试信息：显示碰撞系统状态
   */
  getDebugInfo(): {
    rapierEnabled: boolean;
    levelLoaded: boolean;
    collisionBodies: number;
  } {
    const status = enhancedCollision.getStatus();

    return {
      rapierEnabled: status.rapierEnabled,
      levelLoaded: status.levelLoaded,
      collisionBodies: status.rapierEnabled ? 10 : 0 // 示例值
    };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.isInitialized) {
      enhancedCollision.destroy();
      this.isInitialized = false;
    }
  }
}

// 导出单例实例
export const rapierGameIntegration = new RapierGameIntegration();

/**
 * 使用示例
 */
export function demonstrateRapierIntegration() {
  console.log('=== RapierJS集成演示 ===');

  // 1. 初始化
  rapierGameIntegration.init({} as any).then(() => {
    console.log('集成初始化完成');

    // 2. 测试斜坡高度精度
    const slopeHeight = rapierGameIntegration.getPreciseSlopeHeight(2.5, 2.5);
    console.log('斜坡高度:', slopeHeight);

    // 3. 测试位置安全检测
    const safePosition = { x: 0, y: 1, z: 0 };
    const unsafePosition = { x: 100, y: -10, z: 100 };

    console.log('安全位置检测:', rapierGameIntegration.validatePlayerPosition(safePosition));
    console.log('不安全位置检测:', rapierGameIntegration.validatePlayerPosition(unsafePosition));

    // 4. 测试移动碰撞检测
    const from = { x: 0, y: 0, z: 0 };
    const to = { x: 5, y: 0, z: 5 };
    const collisionResult = rapierGameIntegration.checkMovementCollision(from, to, 0.5);
    console.log('移动碰撞检测:', collisionResult);

    // 5. 显示调试信息
    console.log('调试信息:', rapierGameIntegration.getDebugInfo());
  }).catch(error => {
    console.error('演示失败:', error);
  });
}