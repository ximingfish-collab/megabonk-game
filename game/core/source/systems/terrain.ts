/**
 * 地形高度查询 —— 兼容层。
 *
 * 几何与查询的权威实现已迁到 `collision.ts`（关卡 / 碰撞系统）。本文件仅 re-export
 * 竖直查询函数，保持 projectiles / spawning / AI context / 单测的旧 import 路径不变。
 * 新代码请直接 import 自 `./collision.ts`。
 */
export { getTerrainHeight, getSupportHeight, VOID_HEIGHT } from './collision.ts';
