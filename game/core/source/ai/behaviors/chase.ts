/**
 * chase 行为：直奔玩家。
 *
 * 等价于原 `computeEnemyTarget` 的 'chase' case + `moveEnemy`：
 * - 错峰 (`i % 4 === aiGroup`) 时重算 target = player 坐标
 * - 每帧调 applyMovement 朝 target 移动
 */
import type { EnemyBehaviorFn } from '../types.ts';
import { applyMovement } from './_move.ts';

export const chase: EnemyBehaviorFn = (enemy, ctx, i) => {
  // 错峰重算 target（每帧只有对应aiPhase的敌人重算，节省CPU）
  if (enemy.aiPhase === ctx.aiGroup) {
    enemy.targetX = ctx.player.x;
    enemy.targetZ = ctx.player.z;
  }
  applyMovement(enemy, ctx);
};
