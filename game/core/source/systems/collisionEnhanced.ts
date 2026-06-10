/**
 * 增强碰撞系统 - RapierJS集成
 *
 * 功能：
 * 1. 使用RapierJS提供更精确的斜坡碰撞检测
 * 2. 保持与现有collision.ts API的完全兼容
 * 3. 渐进式迁移，可回退到现有系统
 * 4. 解决斜面精度和"下线"问题
 */

import { rapierPhysics } from '../physics/rapierPhysics.ts';
import type { RampVolume, CollisionRect, ClimbVolume } from '../types.ts';
import type { LevelGeometry } from './collision.ts';
import { STEP_HEIGHT } from '../config.ts';
import { getTerrainHeightAt, getSupportHeightAt, isBlockedHorizontallyAt, findClimbAt, VOID_HEIGHT } from './collision.ts';

// 使用与现有系统相同的常量
const PLAYER_BODY_HEIGHT = 1.4;
const PLAYER_RADIUS = 0.45;

export class EnhancedCollisionSystem {
  private isRapierEnabled = false;
  private levelGeometry: LevelGeometry | null = null;

  /**
   * 初始化增强碰撞系统
   */
  async init(levelGeometry?: LevelGeometry): Promise<void> {
    try {
      // 尝试初始化RapierJS
      await rapierPhysics.init();
      this.isRapierEnabled = true;
      console.log('🎯 增强碰撞系统已启用（RapierJS）');

      if (levelGeometry) {
        this.setLevelGeometry(levelGeometry);
      }
    } catch (error) {
      console.warn('⚠️ RapierJS初始化失败，回退到基础碰撞系统:', error.message);
      this.isRapierEnabled = false;
    }
  }

  /**
   * 设置关卡几何数据
   */
  setLevelGeometry(geo: LevelGeometry): void {
    this.levelGeometry = geo;

    if (this.isRapierEnabled && geo) {
      this.createRapierColliders(geo);
    }
  }

  /**
   * 在Rapier中创建碰撞体
   */
  private createRapierColliders(geo: LevelGeometry): void {
    // 创建斜坡碰撞体
    geo.ramps.forEach(ramp => {
      rapierPhysics.createRampCollider(ramp);
    });

    // 创建矩形平台碰撞体
    geo.rects.forEach(rect => {
      rapierPhysics.createRectCollider(rect);
    });

    // 创建攀爬体碰撞体
    geo.climbs.forEach(climb => {
      rapierPhysics.createClimbCollider(climb);
    });
  }

  /**
   * 增强的地形高度查询（优先使用RapierJS）
   */
  getTerrainHeightAt(x: number, z: number): number {
    if (this.isRapierEnabled) {
      const rapierHeight = rapierPhysics.getTerrainHeightAt(x, z);
      if (rapierHeight !== null) {
        return rapierHeight;
      }
    }

    // 回退到现有系统
    if (this.levelGeometry) {
      return getTerrainHeightAt(this.levelGeometry, x, z);
    }

    return 0; // 默认地板高度
  }

  /**
   * 增强的支撑面高度查询（考虑迈步高度）
   */
  getSupportHeightAt(x: number, z: number, feetY: number): number {
    if (this.isRapierEnabled) {
      const rapierHeight = rapierPhysics.getTerrainHeightAt(x, z);
      if (rapierHeight !== null && rapierHeight <= feetY + STEP_HEIGHT) {
        return rapierHeight;
      }
    }

    // 回退到现有系统
    if (this.levelGeometry) {
      return getSupportHeightAt(this.levelGeometry, x, z, feetY);
    }

    return feetY < -STEP_HEIGHT ? VOID_HEIGHT : 0;
  }

  /**
   * 增强的水平阻挡检测
   */
  isBlockedHorizontallyAt(
    x: number, z: number, feetY: number,
    includeClimb = true, radius = PLAYER_RADIUS
  ): boolean {
    if (this.isRapierEnabled) {
      // 使用RapierJS的多方向射线检测
      const position = { x, y: feetY, z };

      if (rapierPhysics.isHorizontallyBlocked(position, radius)) {
        return true;
      }

      // 检查是否被阻挡（考虑迈步高度）
      const terrainHeight = rapierPhysics.getTerrainHeightAt(x, z);
      if (terrainHeight !== null && terrainHeight - feetY > STEP_HEIGHT) {
        return true;
      }
    }

    // 回退到现有系统
    if (this.levelGeometry) {
      return isBlockedHorizontallyAt(this.levelGeometry, x, z, feetY, includeClimb, radius);
    }

    return false;
  }

  /**
   * 位置安全检测（防"下线"）
   */
  isPositionSafe(position: { x: number; y: number; z: number }, radius = PLAYER_RADIUS): boolean {
    if (this.isRapierEnabled) {
      return rapierPhysics.isPositionSafe(position, radius);
    }

    // 回退到基础检测
    return position.y >= -STEP_HEIGHT;
  }

  /**
   * 查找可攀爬体
   */
  findClimbAt(x: number, z: number, feetY: number): ClimbVolume | null {
    if (!this.levelGeometry) return null;

    // 暂时使用现有逻辑，后续可增强
    return findClimbAt(this.levelGeometry, x, z, feetY);
  }

  /**
   * 检查移动碰撞
   */
  checkMovementCollision(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    radius = PLAYER_RADIUS
  ): { allowed: boolean; hitPoint?: { x: number; y: number; z: number } } {
    if (this.isRapierEnabled) {
      // 检查目标位置是否被阻挡
      const isBlocked = this.isBlockedHorizontallyAt(to.x, to.z, to.y, true, radius);

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

          const stepBlocked = this.isBlockedHorizontallyAt(
            checkPoint.x, checkPoint.z, checkPoint.y, true, radius
          );

          if (stepBlocked) {
            return { allowed: false, hitPoint: checkPoint };
          }
        }
      }

      return { allowed: true };
    }

    // 回退到基础检测
    return { allowed: true };
  }

  /**
   * 更新物理系统（每帧调用）
   */
  update(deltaTime: number): void {
    if (this.isRapierEnabled) {
      rapierPhysics.update(deltaTime);
    }
  }

  /**
   * 获取系统状态
   */
  getStatus(): { rapierEnabled: boolean; levelLoaded: boolean } {
    return {
      rapierEnabled: this.isRapierEnabled,
      levelLoaded: this.levelGeometry !== null
    };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.isRapierEnabled) {
      rapierPhysics.destroy();
    }
    this.levelGeometry = null;
    this.isRapierEnabled = false;
  }
}

// 导出单例实例
export const enhancedCollision = new EnhancedCollisionSystem();