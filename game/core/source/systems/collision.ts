/**
 * 关卡 / 碰撞系统 —— 单一权威来源，管理一关的全部静态几何与空间查询。
 *
 * 这是"建立各个系统"里的第一个独立系统：把原本散落在 terrain.ts（地表高度）
 * 与 player.ts（实体盒 / 攀爬体横向阻挡）里的关卡几何统一收拢，对外只暴露
 *   - loadLevel(level) / clearLevel()  —— 注入 / 清空关卡（换地图测试）
 *   - getTerrainHeight / getSupportHeight —— 竖直查询（敌人贴地 / 玩家站立）
 *   - isBlockedHorizontally / findClimb   —— 水平查询（任何 mover 通用）
 *
 * 纯数据 + 纯函数，无副作用、无渲染依赖。模块级状态——同一时刻只跑一个
 * GameInstance，可接受。玩家 / 敌人 / 投射物都查询同一份几何，
 * 为后续共享移动系统（Stage 2）与 ECS 实体化（Stage 3）打地基。
 */

import type { CollisionRect, RampVolume, ClimbVolume, LevelData } from '../types.ts';
import { STEP_HEIGHT, CLIMB_GRAB_MARGIN } from '../config.ts';

type Rect = readonly [number, number, number, number, number];

/** 实体碰撞盒（col_ + wall_ 统一）。横向阻挡 + 竖直占据区间 [bottomY, topY]。 */
export interface SolidBox {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  bottomY: number;
  topY: number;
}

/** 内置 Neon Crucible 几何（缺省关卡 / 单测基线）。 */
const NEON_CRUCIBLE: readonly Rect[] = [
  // Ground floor
  [0, 0, 15, 15, 0],
  [0, -30, 6, 15, 0], [0, 30, 6, 15, 0],
  [30, 0, 15, 6, 0], [-30, 0, 15, 6, 0],
  [15, -15, 5, 5, 0], [-15, -15, 5, 5, 0],
  [15, 15, 5, 5, 0], [-15, 15, 5, 5, 0],
  [0, -50, 8, 5, 0], [0, 50, 8, 5, 0],
  [50, 0, 5, 8, 0], [-50, 0, 5, 8, 0],

  // Mid catwalks (y=2)
  [0, -25, 5, 4, 2], [0, 25, 5, 4, 2],
  [25, 0, 4, 5, 2], [-25, 0, 4, 5, 2],
  [20, -20, 5, 5, 2], [-20, -20, 5, 5, 2],
  [20, 20, 5, 5, 2], [-20, 20, 5, 5, 2],

  // Watchtowers (y=4)
  [0, -40, 5, 5, 4], [0, 40, 5, 5, 4],
  [40, 0, 5, 5, 4], [-40, 0, 5, 5, 4],

  // Nests (y=6)
  [38, -38, 3, 3, 6], [-38, -38, 3, 3, 6],
  [38, 38, 3, 3, 6], [-38, 38, 3, 3, 6],
];

const RAMP_WIDTH = 3;

/** 玩家碰撞体竖直高度 / 水平半径。 */
const PLAYER_BODY_HEIGHT = 1.4;
const PLAYER_RADIUS = 0.45;

/** 虚空高度：脚下没有任何碰撞体积时返回此值，mover 会因此下落。 */
export const VOID_HEIGHT = Number.NEGATIVE_INFINITY;

// ─── 当前生效的关卡几何（模块级状态） ──────────────────────────────────────

/** 平台矩形（可站立的顶面）。默认 Neon Crucible。 */
let activeRects: readonly Rect[] = NEON_CRUCIBLE;

/**
 * 所见即所得模式。
 * - true（加载关卡）：只有 col_ 盒子顶面之上可站，盒外为虚空（VOID_HEIGHT），无自动斜坡。
 * - false（内置 Neon Crucible / 单测基线）：保留旧行为——默认 y=0 地板 + 边缘自动斜坡。
 */
let wysiwyg = false;

/** 可行走的倾斜地面（ramp_）。 */
let activeRamps: readonly RampVolume[] = [];

/** 实体盒子（col_ + wall_ 合并），横向阻挡。 */
let solidBoxes: readonly SolidBox[] = [];

/** 攀爬体（climb_），走不穿、可攀爬。 */
let levelClimbs: readonly ClimbVolume[] = [];

// ─── 关卡注入 / 清空 ──────────────────────────────────────────────────────

/**
 * 加载一关：把 LevelData 拆成各类几何并进入所见即所得模式。
 * col_ + wall_ 合并为实体盒（横向阻挡）；col_ 缺省 baseY 视为实心到底。
 * climb_ 的"走不穿"由调用方按需启用（见 isBlockedHorizontally 的 includeClimb）。
 */
export function loadLevel(level: LevelData): void {
  activeRects = level.collisionRects.map(
    (r) => [r.cx, r.cz, r.halfW, r.halfD, r.height] as Rect,
  );
  activeRamps = level.ramps ?? [];
  solidBoxes = [
    ...level.collisionRects.map((r) => ({
      cx: r.cx, cz: r.cz, halfW: r.halfW, halfD: r.halfD,
      bottomY: r.baseY ?? Number.NEGATIVE_INFINITY,
      topY: r.height,
    })),
    ...(level.walls ?? []).map((w) => ({
      cx: w.cx, cz: w.cz, halfW: w.halfW, halfD: w.halfD,
      bottomY: w.bottomY, topY: w.topY,
    })),
  ];
  levelClimbs = level.climbVolumes ?? [];
  wysiwyg = true;
}

/** 恢复内置 Neon Crucible 几何（含默认地板 + 自动斜坡），清空关卡几何。 */
export function clearLevel(): void {
  activeRects = NEON_CRUCIBLE;
  activeRamps = [];
  solidBoxes = [];
  levelClimbs = [];
  wysiwyg = false;
}

// ─── 竖直查询 ─────────────────────────────────────────────────────────────

/** 斜坡在 (x,z) 处的顶面高度；不在 footprint 内返回 null。 */
function rampHeightAt(ramp: RampVolume, x: number, z: number): number | null {
  if (Math.abs(x - ramp.cx) > ramp.halfW || Math.abs(z - ramp.cz) > ramp.halfD) return null;
  const isX = ramp.axis === 'x';
  const coord = isX ? x : z;
  const half = isX ? ramp.halfW : ramp.halfD;
  const lo = (isX ? ramp.cx : ramp.cz) - half;
  const run = half * 2;
  let t = run > 0 ? (coord - lo) / run : 0; // 0..1 从 -axis 端到 +axis 端
  if (!ramp.ascendPositive) t = 1 - t;
  return ramp.lowY + (ramp.highY - ramp.lowY) * t;
}

/**
 * 单个矩形在 (x,z) 处的地表高度贡献。不覆盖返回 null。
 * 非所见即所得模式（内置 Neon Crucible）保留边缘自动斜坡。
 */
function rectHeightAt(rect: Rect, x: number, z: number): number | null {
  const [cx, cz, hw, hd, h] = rect;
  const dx = Math.abs(x - cx);
  const dz = Math.abs(z - cz);

  if (dx <= hw && dz <= hd) return h;

  if (!wysiwyg && dx <= hw + RAMP_WIDTH && dz <= hd + RAMP_WIDTH) {
    const edgeDist = Math.max(dx - hw, dz - hd, 0);
    if (edgeDist <= RAMP_WIDTH) return h * (1 - edgeDist / RAMP_WIDTH);
  }
  return null;
}

/**
 * (x,z) 处的最高地表高度（不考虑 mover 当前高度）。
 * 用于敌人贴地、抛射物、出生点。无 col_ 覆盖时回落到 y=0 默认地板，避免
 * 把 -Infinity 传染给 boss / 投射物 / 敌人 y（这些 mover 没有"虚空回收"逻辑）。
 * 玩家"掉出关卡 → 复活"语义改由玩家自己读 getSupportHeight 判定。
 */
export function getTerrainHeight(x: number, z: number): number {
  let height = 0; // 统一保底地板，软虚空
  for (const rect of activeRects) {
    const h = rectHeightAt(rect, x, z);
    if (h !== null && h > height) height = h;
  }
  for (const ramp of activeRamps) {
    const h = rampHeightAt(ramp, x, z);
    if (h !== null && h > height) height = h;
  }
  return height;
}

/**
 * mover 脚下的"支撑面"高度：覆盖 (x,z) 且顶面 ≤ feetY + STEP_HEIGHT 的最高地表。
 *
 * 与 getTerrainHeight 的区别：**只返回够得着的面**，比脚高出超过迈步高度的
 * 平台被忽略 —— 因此 mover 能从下方走过高架平台（不再有"空气墙"），
 * 想上高台必须跳到足够高度让其顶面进入迈步范围。无可站面则返回 VOID_HEIGHT（下落）。
 */
export function getSupportHeight(x: number, z: number, feetY: number): number {
  const limit = feetY + STEP_HEIGHT;
  // 默认 y=0 地板（在迈步范围内才算够得着）；玩家掉出关卡时 limit < 0 → 不再有支撑 → 进入下落 / FALL_RESPAWN。
  let best = 0 <= limit ? 0 : VOID_HEIGHT;
  for (const rect of activeRects) {
    const h = rectHeightAt(rect, x, z);
    if (h !== null && h <= limit && h > best) best = h;
  }
  for (const ramp of activeRamps) {
    const h = rampHeightAt(ramp, x, z);
    if (h !== null && h <= limit && h > best) best = h;
  }
  return best;
}

// ─── 水平查询 ─────────────────────────────────────────────────────────────

/**
 * (x,z,feetY) 是否被某组竖直盒子挡住（统一规则）：
 * - 顶面 ≤ feetY + STEP_HEIGHT：可直接迈上去，不挡（当作台阶/地面）。
 * - 盒子整体在头顶之上（底 ≥ 头）：不挡（可从下方穿过）。
 * - 否则盒子竖直区间与身体重叠 → 挡。
 */
function blockedByAny(
  boxes: readonly SolidBox[], x: number, z: number, feetY: number, radius: number,
): boolean {
  const headY = feetY + PLAYER_BODY_HEIGHT;
  for (const b of boxes) {
    if (
      Math.abs(x - b.cx) <= b.halfW + radius &&
      Math.abs(z - b.cz) <= b.halfD + radius
    ) {
      if (b.topY - feetY <= STEP_HEIGHT) continue; // 迈步范围内 → 踩上去，不挡
      if (b.bottomY >= headY) continue;            // 高架/头顶 → 从下方穿过
      return true;
    }
  }
  return false;
}

/**
 * 横向是否被挡：col_/wall_ 实体盒永远挡。
 * climb_ 攀爬体平时也挡（走不穿）；调用方在蹬墙释放窗口内传 includeClimb=false 放行，
 * 使"跳+方向"能离开 climb 范围下落。
 */
export function isBlockedHorizontally(
  x: number, z: number, feetY: number,
  includeClimb = true, radius = PLAYER_RADIUS,
): boolean {
  if (blockedByAny(solidBoxes, x, z, feetY, radius)) return true;
  if (includeClimb && levelClimbs.length > 0) {
    for (const c of levelClimbs) {
      if (
        Math.abs(x - c.cx) <= c.halfW + radius &&
        Math.abs(z - c.cz) <= c.halfD + radius
      ) {
        if (c.topY - feetY <= STEP_HEIGHT) continue;
        if (c.bottomY >= feetY + PLAYER_BODY_HEIGHT) continue;
        return true;
      }
    }
  }
  return false;
}

/** 找到 (x,z,feetY) 处可抓取的攀爬体；无则返回 null。 */
export function findClimb(x: number, z: number, feetY: number): ClimbVolume | null {
  for (const c of levelClimbs) {
    if (
      Math.abs(x - c.cx) <= c.halfW + CLIMB_GRAB_MARGIN &&
      Math.abs(z - c.cz) <= c.halfD + CLIMB_GRAB_MARGIN &&
      feetY >= c.bottomY - 0.5 &&
      feetY <= c.topY + 0.2
    ) {
      return c;
    }
  }
  return null;
}
