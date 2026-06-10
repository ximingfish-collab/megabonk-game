/**
 * RapierJS 物理系统集成
 *
 * 解决：斜面碰撞精度、模型错位、"下线"问题
 *
 * 实施计划：
 * 1. 斜坡高度场精确碰撞
 * 2. 连续碰撞检测防穿透
 * 3. 视觉模型与碰撞体同步
 * 4. 多射线安全检测
 */

import * as RAPIER from '@dimforge/rapier3d-compat';
import type { RampVolume, LevelData, CollisionRect, ClimbVolume } from '../types.ts';
import { STEP_HEIGHT } from '../config.ts';

// 使用与现有碰撞系统相同的常量
const PLAYER_BODY_HEIGHT = 1.4;
const PLAYER_RADIUS = 0.45;

export class RapierPhysicsSystem {
  private world: RAPIER.World | null = null;
  private isInitialized = false;
  private collisionBodies = new Map<string, RAPIER.Collider>();

  /**
   * 初始化RapierJS物理系统
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    console.log('正在初始化RapierJS物理引擎...');

    try {
      // 初始化Rapier WASM
      await RAPIER.init();

      // 创建物理世界
      const gravity = new RAPIER.Vector3(0, -9.81, 0);
      this.world = new RAPIER.World(gravity);

      // 配置物理参数
      this.world.timestep = 1 / 60; // 60FPS

      this.isInitialized = true;
      console.log('RapierJS物理引擎初始化成功');
    } catch (error) {
      console.error('RapierJS初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取物理世界实例
   */
  getWorld(): RAPIER.World {
    if (!this.world) {
      throw new Error('RapierJS物理系统未初始化');
    }
    return this.world;
  }

  /**
   * 创建斜坡高度场碰撞体
   */
  createRampCollider(ramp: RampVolume): RAPIER.Collider {
    try {
      const heights = this.generateRampHeightfield(ramp);
      const gridSize = Math.sqrt(heights.length);

      // 修复高度场创建参数 - 使用正确的尺寸计算
      const colliderDesc = RAPIER.ColliderDesc.heightfield(
        gridSize,
        gridSize,
        heights,
        new RAPIER.Vector3(ramp.halfPerp * 2, 1, ramp.halfPerp * 2) // 修正尺寸参数
      );

      // 设置位置
      colliderDesc.setTranslation(ramp.cx, 0, ramp.cz);

      // 静态碰撞体无需 CCD（CCD 仅对动态刚体有效）
      colliderDesc.setFriction(0.7);
      colliderDesc.setRestitution(0.1);

      const collider = this.getWorld().createCollider(colliderDesc);
      this.collisionBodies.set(`ramp_${ramp.cx}_${ramp.cz}`, collider);
      return collider;
    } catch (error) {
      console.warn('高度场创建失败，使用三角网格替代:', (error as Error).message);
      // 回退到三角网格
      return this.createRampTrimesh(ramp);
    }
  }

  /**
   * 使用三角网格创建斜坡（高度场失败时的替代方案）
   */
  private createRampTrimesh(ramp: RampVolume): RAPIER.Collider {
    const { cx, cz, halfSlope, halfPerp, slopeDirX, slopeDirZ, lowY, highY } = ramp;

    // 创建更精确的三角网格（8个顶点，12个三角形）
    const vertices = new Float32Array([
      // 低端顶点
      cx - halfPerp, lowY, cz - halfSlope,
      cx + halfPerp, lowY, cz - halfSlope,
      cx - halfPerp, lowY, cz + halfSlope,
      cx + halfPerp, lowY, cz + halfSlope,
      // 高端顶点
      cx - halfPerp, highY, cz - halfSlope,
      cx + halfPerp, highY, cz - halfSlope,
      cx - halfPerp, highY, cz + halfSlope,
      cx + halfPerp, highY, cz + halfSlope
    ]);

    const indices = new Uint32Array([
      // 底面
      0, 1, 2, 1, 3, 2,
      // 顶面
      4, 5, 6, 5, 7, 6,
      // 侧面
      0, 4, 1, 1, 4, 5,
      1, 5, 3, 3, 5, 7,
      3, 7, 2, 2, 7, 6,
      2, 6, 0, 0, 6, 4
    ]);

    const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
    colliderDesc.setFriction(0.7);
    colliderDesc.setRestitution(0.1);

    const collider = this.getWorld().createCollider(colliderDesc);
    this.collisionBodies.set(`ramp_trimesh_${ramp.cx}_${ramp.cz}`, collider);
    return collider;
  }

  /**
   * 生成斜坡高度场数据
   */
  private generateRampHeightfield(ramp: RampVolume): Float32Array {
    const { cx, cz, halfSlope, halfPerp, slopeDirX, slopeDirZ, lowY, highY } = ramp;
    const gridSize = 16; // 16x16网格，可调整精度

    const heights = new Float32Array(gridSize * gridSize);

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        // 计算网格点在斜坡局部坐标
        const x = (i / (gridSize - 1) - 0.5) * 2 * halfPerp;
        const z = (j / (gridSize - 1) - 0.5) * 2 * halfPerp;

        // 投影到斜坡方向
        const slopeCoord = x * slopeDirX + z * slopeDirZ;

        // 计算高度插值 (0到1之间)
        let t = (slopeCoord + halfSlope) / (2 * halfSlope);
        t = Math.max(0, Math.min(1, t)); // 钳制到[0,1]

        // 线性插值高度
        heights[i * gridSize + j] = lowY + (highY - lowY) * t;
      }
    }

    return heights;
  }

  /**
   * 创建矩形平台碰撞体
   */
  createRectCollider(rect: CollisionRect): RAPIER.Collider {
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      rect.halfW,
      0.1, // 薄层，只检测顶面
      rect.halfD
    );

    colliderDesc.setTranslation(rect.cx, rect.height, rect.cz);

    const collider = this.getWorld().createCollider(colliderDesc);
    this.collisionBodies.set(`rect_${rect.cx}_${rect.cz}`, collider);

    return collider;
  }

  /**
   * 创建攀爬体碰撞体
   */
  createClimbCollider(climb: ClimbVolume): RAPIER.Collider {
    const height = climb.topY - climb.bottomY;
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      climb.halfW,
      height / 2,
      climb.halfD
    );

    colliderDesc.setTranslation(
      climb.cx,
      climb.bottomY + height / 2,
      climb.cz
    );

    const collider = this.getWorld().createCollider(colliderDesc);
    this.collisionBodies.set(`climb_${climb.cx}_${climb.cz}`, collider);

    return collider;
  }

  /**
   * 射线检测获取地形高度
   */
  getTerrainHeightAt(x: number, z: number, maxDistance = 100): number | null {
    const origin = new RAPIER.Vector3(x, maxDistance, z);
    const direction = new RAPIER.Vector3(0, -1, 0);

    const ray = new RAPIER.Ray(origin, direction);
    const hit = this.getWorld().castRay(ray, maxDistance * 2, true);

    if (hit && hit.collider) {
      // rapier 0.19+: 命中点由 ray.pointAt(toi) 计算
      return ray.pointAt(hit.timeOfImpact).y;
    }

    return null;
  }

  /**
   * 多方向安全检测（防"下线"）
   */
  isPositionSafe(position: { x: number; y: number; z: number }, radius = PLAYER_RADIUS): boolean {
    const directions = [
      new RAPIER.Vector3(1, 0, 0),   // 右
      new RAPIER.Vector3(-1, 0, 0),  // 左
      new RAPIER.Vector3(0, 0, 1),   // 前
      new RAPIER.Vector3(0, 0, -1), // 后
      new RAPIER.Vector3(0.7, 0, 0.7),   // 右前
      new RAPIER.Vector3(-0.7, 0, 0.7),  // 左前
      new RAPIER.Vector3(0.7, 0, -0.7),  // 右后
      new RAPIER.Vector3(-0.7, 0, -0.7), // 左后
    ];

    let safeDirections = 0;

    for (const dir of directions) {
      const ray = new RAPIER.Ray(
        new RAPIER.Vector3(position.x, position.y + 0.5, position.z),
        dir
      );

      const hit = this.getWorld().castRay(ray, radius * 1.5, true);

      if (hit) {
        safeDirections++;
      }
    }

    // 至少需要6个方向安全才认为是安全位置
    return safeDirections >= 6;
  }

  /**
   * 检查水平方向是否被阻挡
   */
  isHorizontallyBlocked(position: { x: number; y: number; z: number }, radius = PLAYER_RADIUS): boolean {
    const directions = [
      new RAPIER.Vector3(1, 0, 0),
      new RAPIER.Vector3(-1, 0, 0),
      new RAPIER.Vector3(0, 0, 1),
      new RAPIER.Vector3(0, 0, -1),
    ];

    for (const dir of directions) {
      const ray = new RAPIER.Ray(
        new RAPIER.Vector3(position.x, position.y + PLAYER_BODY_HEIGHT / 2, position.z),
        dir
      );

      const hit = this.getWorld().castRay(ray, radius, true);

      if (hit) {
        // 检查碰撞体是否在可迈步范围内
        const hitPointY = ray.pointAt(hit.timeOfImpact).y;
        const stepLimit = position.y + STEP_HEIGHT;

        if (hitPointY > stepLimit) {
          return true; // 被阻挡
        }
      }
    }

    return false;
  }

  /**
   * 更新物理世界（每帧调用）
   */
  update(deltaTime: number): void {
    if (this.world) {
      this.world.step();
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.world) {
      // 清理所有碰撞体
      this.collisionBodies.forEach((collider) => {
        this.world!.removeCollider(collider, true);
      });
      this.collisionBodies.clear();
    }
    this.isInitialized = false;
  }
}

// 导出单例实例
export const rapierPhysics = new RapierPhysicsSystem();