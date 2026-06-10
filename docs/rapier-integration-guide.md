# RapierJS 集成指南

## 概述

本指南介绍如何将RapierJS物理引擎集成到MegaBonk游戏中，以解决以下问题：
- 斜面碰撞精度不足
- 表现模型与碰撞模型错位
- 玩家"下线"问题

## 架构设计

### 1. 分层架构
```
游戏逻辑层 (GameInstance)
    ↓
增强碰撞系统 (EnhancedCollisionSystem)
    ↓
RapierJS物理引擎 (RapierPhysicsSystem)
    ↓
现有碰撞系统 (LegacyCollisionSystem) ← 回退方案
```

### 2. 渐进式迁移策略
- **阶段1**：斜坡精度优化（2天）
- **阶段2**：实体碰撞迁移（3天）
- **阶段3**：防"下线"机制（1天）
- **阶段4**：性能优化（1天）

## 核心组件

### RapierPhysicsSystem (`/game/core/source/physics/rapierPhysics.ts`)
- 封装RapierJS物理引擎
- 提供斜坡高度场、碰撞检测等高级功能
- 自动回退机制（高度场失败时使用三角网格）

### EnhancedCollisionSystem (`/game/core/source/systems/collisionEnhanced.ts`)
- 与现有API兼容的增强碰撞系统
- 优先使用RapierJS，失败时回退到现有系统
- 提供防"下线"安全检测

## 集成步骤

### 1. 环境准备
```bash
# 安装依赖
pnpm add -w @dimforge/rapier3d-compat
```

### 2. 初始化系统
```typescript
import { enhancedCollision } from './systems/collisionEnhanced.ts';

// 在游戏初始化时调用
await enhancedCollision.init(levelGeometry);
```

### 3. 每帧更新
```typescript
// 在游戏主循环中调用
enhancedCollision.update(deltaTime);
```

### 4. 使用增强功能
```typescript
// 精确的斜坡高度查询
const height = enhancedCollision.getTerrainHeightAt(x, z);

// 位置安全检测（防"下线"）
const isSafe = enhancedCollision.isPositionSafe(playerPosition);

// 水平阻挡检测
const isBlocked = enhancedCollision.isBlockedHorizontallyAt(x, z, feetY);
```

## 解决的核心问题

### 1. 斜面碰撞精度
**问题**：现有系统使用线性插值，精度不足
**解决方案**：RapierJS高度场碰撞体
```typescript
// 创建精确的斜坡高度场
createRampCollider(ramp: RampVolume): RAPIER.Collider {
  const heights = generateRampHeightfield(ramp);
  return RAPIER.ColliderDesc.heightfield(gridSize, gridSize, heights, scale);
}
```

### 2. 模型错位
**问题**：视觉模型与碰撞模型不同步
**解决方案**：精确的碰撞体同步
```typescript
syncModelPosition(visualMesh: THREE.Mesh, collider: RAPIER.Collider): void {
  const position = collider.translation();
  visualMesh.position.set(position.x, position.y, position.z);
}
```

### 3. "下线"问题
**问题**：玩家掉出关卡边界
**解决方案**：多方向安全检测
```typescript
isPositionSafe(position: Vector3, radius: number): boolean {
  // 8方向射线检测
  const directions = [/* 8个方向向量 */];
  
  for (const dir of directions) {
    const hit = world.castRay(ray, radius, true);
    if (!hit) return false;
  }
  return true;
}
```

## 性能优化

### 1. 动态LOD
- 根据距离调整碰撞精度
- 远处物体使用简化碰撞体

### 2. 对象池
- 重用物理对象减少内存分配
- 预分配碰撞体池

### 3. 空间分区
- 使用RapierJS内置的空间哈希
- 优化碰撞检测性能

## 测试验证

### 单元测试
```typescript
// 斜坡精度测试
it('应在斜坡上精确计算高度', () => {
  const height = enhancedCollision.getTerrainHeightAt(2.5, 2.5);
  expect(height).toBeCloseTo(2.0, 0.01);
});
```

### 集成测试
```typescript
// 防"下线"测试
it('应检测并防止玩家掉落', () => {
  const unsafePosition = { x: 100, y: -10, z: 100 };
  const isSafe = enhancedCollision.isPositionSafe(unsafePosition);
  expect(isSafe).toBe(false);
});
```

## 故障排除

### 常见问题

1. **WASM加载失败**
   - 检查网络连接
   - 验证RapierJS版本兼容性

2. **高度场创建失败**
   - 使用三角网格替代方案
   - 检查高度数据格式

3. **性能问题**
   - 启用动态LOD
   - 优化碰撞体数量

### 调试工具
```typescript
// 获取系统状态
const status = enhancedCollision.getStatus();
console.log('RapierJS状态:', status);

// 调试可视化
showCollisionDebugVisualization();
```

## 回滚方案

如果RapierJS集成出现问题，系统会自动回退到现有碰撞系统：

```typescript
// 初始化失败时自动回退
try {
  await enhancedCollision.init(levelGeometry);
} catch (error) {
  console.warn('RapierJS初始化失败，使用基础碰撞系统');
  // 系统自动回退，无需额外处理
}
```

## 下一步计划

1. **性能基准测试**：对比RapierJS与现有系统的性能差异
2. **移动端优化**：针对移动设备优化WASM加载
3. **高级功能**：实现更复杂的物理效果（如布料、流体）

## 相关文件

- `game/core/source/physics/rapierPhysics.ts` - RapierJS封装
- `game/core/source/systems/collisionEnhanced.ts` - 增强碰撞系统
- `test-rapier.js` - 集成测试脚本
- `docs/rapier-integration-guide.md` - 本指南

## 技术支持

- RapierJS官方文档：https://rapier.rs/
- Three.js物理集成示例
- 项目内测试用例参考