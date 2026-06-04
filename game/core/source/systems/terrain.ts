/**
 * 地形高度查询 —— 兼容层（已废弃，保留是为了让旧 terrain.test.ts 能通过）。
 *
 * Phase 3：collision.ts 移除了模块级状态，改用 LevelGeometry 显式传参。
 * 新代码请使用 `getTerrainHeightAt(geo, x, z)` 等带 At 后缀的 API。
 *
 * 这里只为内置 Neon Crucible 提供一个无参 fallback —— 仅供旧 terrain.test.ts 使用。
 */
import { getTerrainHeightAt, NEON_CRUCIBLE_GEOMETRY } from './collision.ts';
export { VOID_HEIGHT } from './collision.ts';

/** @deprecated 用 `getTerrainHeightAt(engine.geo, x, z)`。本函数固定查询 Neon Crucible。 */
export function getTerrainHeight(x: number, z: number): number {
  return getTerrainHeightAt(NEON_CRUCIBLE_GEOMETRY, x, z);
}
