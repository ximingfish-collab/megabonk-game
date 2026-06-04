/**
 * tryMoveHorizontally 单元测试。
 *
 * 验证 4 种 path 的 fallback 顺序：full → slide-Z → slide-X → 原地。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { tryMoveHorizontally } from '../horizontalMove.ts';
import { loadLevel, clearLevel } from '../collision.ts';
import type { LevelData } from '../../types.ts';

function levelWithWall(wall: { cx: number; cz: number; halfW: number; halfD: number; bottomY: number; topY: number }): LevelData {
  return {
    collisionRects: [],
    walls: [wall],
    climbVolumes: [],
    ramps: [],
    spawnPoints: {},
    chestSpawns: [],
  };
}

describe('tryMoveHorizontally', () => {
  beforeEach(() => clearLevel());

  it('无关卡 / 无障碍 → 直接到目标', () => {
    const r = tryMoveHorizontally(0, 0, 5, 5, 0);
    expect(r.x).toBe(5);
    expect(r.z).toBe(5);
  });

  it('目标位置被墙挡，X 方向有空间 → 沿 Z 滑（保留新 X）', () => {
    // 在 (0, 5) 放一堵 z 方向薄墙（沿 x 长 6，沿 z 厚 0.5），玩家 (0, 0) 想去 (3, 5)：
    //  - 直走 (3, 5) → 撞墙
    //  - 沿 Z 滑 (3, 0) → 通
    loadLevel(levelWithWall({ cx: 0, cz: 5, halfW: 6, halfD: 0.5, bottomY: 0, topY: 3 }));
    const r = tryMoveHorizontally(0, 0, 3, 5, 0);
    expect(r.x).toBe(3);
    expect(r.z).toBe(0); // 被挡回 oldZ
  });

  it('Z 方向也被挡，X 方向有空间 → 沿 X 滑（保留新 Z）', () => {
    // 墙体只在 X=0~5 的区段内，玩家 (3, 0) 想去 (3, 5)：
    //  - 直走 → 撞
    //  - 沿 Z 滑 (3, 0) = 原地，等于不动 → 实际逻辑：先尝试 (desiredX, oldZ) = (3, 0) → 不挡（OK，但等于原地）→ 这测的是 path 2 短路了
    // 改用更精细 case：玩家在墙的"X 端"附近，沿 X 走能脱开。
    //
    // 用一堵 z=0 的墙（cx=0, cz=0, halfW=5, halfD=0.5）。玩家在 (-3, -2)，想去 (-3, 2)：
    //   - (−3, 2) 直走 → 撞墙
    //   - (−3, oldZ=−2) → 不撞（沿 Z 留在原地）
    //   - (oldX=−3, 2) → 撞
    //   → 命中 path 2（沿 Z），返回 (−3, −2)。等于原地。
    //
    // 要真测 path 3，需让 path 2 也挡。例如玩家 (0, -1)，墙在 (0, 0, hw=10, hd=0.5)，目标 (5, 1)：
    //   - 直走 (5, 1) → 在墙内 → 挡
    //   - 沿 Z (5, -1) → 不在墙内 → 通 ← 命中 path 2
    //
    // 真正命中 path 3 需要：直走挡、(desiredX, oldZ) 也挡、(oldX, desiredZ) 通。
    // 玩家 (-2, 0) 站在墙的左端外，墙 (cx=5, cz=0, hw=4, hd=0.5)；
    //   目标 (4, 0) — desiredX 就在墙正下方:
    //   - 直走 (4, 0) → 撞
    //   - 沿 Z (4, 0) 与直走相同 → 撞
    //   - 沿 X (-2, 0) → 不撞 ← path 3 被走但回原地
    // 仍然不好测。换思路：让 path 3 留下"新 Z 但旧 X"。
    //
    // 玩家 (-2, -1)，目标 (-2 + 0.1, 1)；墙 (cx=-2, cz=0, hw=2, hd=0.5)：
    //   - 直走 (-1.9, 1) → 离墙中心 0.1, halfW 2 → 在 footprint → 撞
    //   - 沿 Z (-1.9, -1) → 离墙中心 z 距 1, halfD 0.5 → 不在 → 通
    //   → path 2 命中, 返回 (-1.9, -1)
    //
    // 要让 path 2 撞、path 3 不撞：path 2 需 (desiredX, oldZ) 在墙内；path 3 (oldX, desiredZ) 在墙外。
    // 即：oldZ 在墙内、desiredZ 在墙外、desiredX 在墙内、oldX 在墙外。
    // 玩家 oldX=-3 (墙外)，desiredX=0 (墙中心，墙内)；oldZ=0 (墙内)，desiredZ=3 (墙外)。
    //   墙: (cx=0, cz=0, hw=2, hd=1)
    //   - (0, 3) 直走 → desiredZ 在墙外 → 不撞 → path 1 命中
    //   失败。需要直走也撞。让墙更长沿 z：hd=4。
    //   墙: (cx=0, cz=0, hw=2, hd=4)
    //   玩家 (-3, 0) 在墙外左侧
    //   目标 (0, 5)：
    //   - 直走 (0, 5) → desiredZ 5 > hd+pad 4.45 → 不在 → 通 → path 1
    //   失败。让 desiredZ 在墙内：目标 (0, 3)：
    //   - 直走 (0, 3) → 在墙内（abs(z-0)=3 ≤ 4.45）→ 撞
    //   - 沿 Z (0, oldZ=0) → 在墙内 → 撞
    //   - 沿 X (-3, 3) → abs(x)=3, halfW+r=2.45, 3>2.45 → 不在 → 通 ← path 3 命中, 返回 (-3, 3)
    loadLevel(levelWithWall({ cx: 0, cz: 0, halfW: 2, halfD: 4, bottomY: 0, topY: 3 }));
    const r = tryMoveHorizontally(-3, 0, 0, 3, 0);
    expect(r.x).toBe(-3);
    expect(r.z).toBe(3);
  });

  it('全方向被挡 → 原地不动', () => {
    // 玩家被三面墙包围。简单方法：墙在四个相邻位置都覆盖。
    // 用 4 堵墙构造一个 U 形围栏：玩家 (0, 0) 想去 (1, 0)，但前方/侧方都堵住。
    // 简化版：墙完全包围玩家 desired+old。
    loadLevel({
      collisionRects: [],
      walls: [
        { cx: 1, cz: 0, halfW: 0.3, halfD: 5, bottomY: 0, topY: 3 }, // 东墙
        { cx: -1, cz: 0, halfW: 0.3, halfD: 5, bottomY: 0, topY: 3 }, // 西墙
        { cx: 0, cz: 1, halfW: 5, halfD: 0.3, bottomY: 0, topY: 3 }, // 北墙
        { cx: 0, cz: -1, halfW: 5, halfD: 0.3, bottomY: 0, topY: 3 }, // 南墙
      ],
      climbVolumes: [], ramps: [], spawnPoints: {}, chestSpawns: [],
    });
    const r = tryMoveHorizontally(0, 0, 1, 1, 0);
    expect(r.x).toBe(0);
    expect(r.z).toBe(0);
  });

  it('includeClimb=false 时 climb_ 不再阻挡', () => {
    loadLevel({
      collisionRects: [],
      walls: [],
      climbVolumes: [{ cx: 0, cz: 5, halfW: 5, halfD: 0.5, bottomY: 0, topY: 4 }],
      ramps: [], spawnPoints: {}, chestSpawns: [],
    });
    // includeClimb=true → 撞 climb_ → 沿 Z 滑回 oldZ
    const r1 = tryMoveHorizontally(0, 0, 0, 5, 0, { includeClimb: true });
    expect(r1.z).toBe(0);

    // includeClimb=false → 直接穿过 climb_
    const r2 = tryMoveHorizontally(0, 0, 0, 5, 0, { includeClimb: false });
    expect(r2.z).toBe(5);
  });
});
