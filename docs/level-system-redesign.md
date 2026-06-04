# Level System Redesign（数据驱动关卡 + 立体移动）

> 状态：Draft v1
> 最后更新：2026-06-03
> 负责人：关卡组（feature 分支开发）
> 关联代码：`game/client/source/index.ts`（LevelLoader / buildArena）、`game/core/source/systems/terrain.ts`、`systems/player.ts`、`physics.ts`、`ai/behaviors/_move.ts`、`systems/chests.ts`、`types.ts`、`config.ts`
> 关联文档：`level-editor/WORKFLOW.md`、`level-editor/METRIC_HANDBOOK.md`、`docs/contract.md`

---

## 0. 一句话目标

把关卡从「**代码硬编码 + 只有地面高度 + 玩家只能靠跳**」升级为「**Blender 导出 glb 数据驱动 + 实心遮挡 + 小爬坡 / 跳跃 / 攀爬三段式立体移动 + 怪物自动寻高路径**」，并固化一套 Blender 建模规范，保证设计师产出的 glb 能被系统正确读出。

---

## 1. 现状（OLD）—— 必须先认清的 6 个事实

> 全部来自当前代码静态核对，不是文档转述。

| # | 维度 | 现状 | 来源 |
|---|---|---|---|
| O1 | 关卡来源 | **硬编码**。视觉在 `buildArena()` 用 ~280 次 `placeModel()` 摆；碰撞在 `terrain.ts` 的 `PLATFORMS` 常量（29 个矩形）。**没有 level glb，没有 LevelLoader** | `client/index.ts:1065`、`systems/terrain.ts:15` |
| O2 | 「碰撞」的真实语义 | 只有 **`getTerrainHeight(x,z)` = 脚下地面高度**。**没有水平阻挡** —— 柱子/围栏/墙玩家能直接穿过 | `terrain.ts`、`physics.ts:applyMovement3D` |
| O3 | 玩家垂直移动 | **只能靠跳**。`isGrounded` 为真时整段重力/贴地逻辑被跳过 → **走路时 y 冻结，不跟随坡道**；走出平台边缘会悬空 | `systems/player.ts:115-134` |
| O4 | 怪物垂直移动 | **每帧 `enemy.y = getTerrainHeight(x,z)` 自动贴地**（gargoyle 飞行除外）→ 怪物会自动走坡/爬升，但**直线追玩家、无绕障、无寻路** | `ai/behaviors/_move.ts:41` |
| O5 | 宝箱 | **运行时随机生成** 4 个（绕玩家随机角度/距离），**不读关卡** | `systems/chests.ts:15` |
| O6 | 攀爬 | **不存在该机制**。垂直可达性纯由「高度差 ≤ 跳跃峰值 + 坡道」涌现 | —— |

**OLD 的两个致命限制：**
1. 玩家「走路上坡」实际不工作（O3），4 层平台只能靠在坡道边缘反复跳「楼梯式」上去 —— 体感很差。
2. 没有遮挡物（O2），关卡无法做掩体 / 迷宫 / 阻挡视线，战斗空间是纯平面博弈。

---

## 2. 目标（NEW）—— 新版增加了什么

> 🆕 = 全新能力；🔧 = 修复/改造现有；♻️ = 数据驱动化。

| 能力 | OLD | NEW | 标记 |
|---|---|---|---|
| 关卡数据来源 | 硬编码 | Blender glb → LevelLoader 解析 | ♻️ |
| 地面高度 | 写死 PLATFORMS | glb 内 `col_` 解析 | ♻️ |
| **小爬坡（迈步）** | 无，走路不跟地形 | 高度差 ≤ `STEP_HEIGHT` 自动迈上去（走路即可） | 🆕🔧 |
| **斜坡行走** | 坏（y 冻结） | grounded 时跟随地形高度，坡道真正能走 | 🔧 |
| 跳跃 | 1.0 / 兔子跳 1.44 | 不变（保留手感） | — |
| **攀爬** | 无 | `climb_` 攀爬体：玩家可贴附攀爬，**可爬到一半跳下**；怪物可走攀爬路径 | 🆕 |
| **遮挡物 / 实心墙** | 无（可穿） | `wall_` 解析为水平阻挡体（挡移动，可选挡投射物/视线） | 🆕 |
| 怪物立体寻路 | 直线 + 自动贴地 | 直线 + 自动贴地 + **遇墙绕行 / 走攀爬路径登高** | 🆕 |
| 手摆宝箱 | 随机 | `spawn_chest` 指定坐标 | 🆕 |
| 出生点 | Boss 写死 (0,0,-36)，玩家原点 | `spawn_player` / `spawn_boss` / `spawn_altar` 驱动 | 🆕🔧 |

---

## 3. 三段式垂直移动模型（核心设计）

把垂直可达性拆成**三个明确的高度带**，每带对应一种动作。这是关卡设计的「物理语法」。

```
高度差 Δh（相邻可站立面）
  Δh ≤ STEP_HEIGHT          → 自动迈步（走路无缝上去，无动作）
  STEP_HEIGHT < Δh ≤ JUMP   → 需要跳跃（1.0 普通 / 1.44 兔子跳）
  Δh > JUMP                 → 需要攀爬体 climb_ 或坡道；否则不可达
```

### 3.1 小爬坡 / 自动迈步 🆕🔧

**问题**：当前 grounded 时 y 冻结。**新设计**：grounded 时每帧用 `getTerrainHeight` 重新贴地，但加一个迈步上限：

```ts
// systems/player.ts，grounded 分支新增
const targetH = getTerrainHeight(player.x, player.z);
const dh = targetH - player.y;
if (dh > 0 && dh <= STEP_HEIGHT) {
  player.y = targetH;                 // 小台阶：直接迈上
} else if (dh > STEP_HEIGHT) {
  // 太高：不自动上去，玩家被「挡」在原高度（水平位置可回退或贴边）
  // → 需要跳跃或攀爬
} else if (dh < 0) {
  // 地面下降：进入下落（isGrounded=false 走重力），实现走下台阶/走出边缘会掉
  player.isGrounded = false;
}
```

- `STEP_HEIGHT`（新常量，建议 **0.5**）= 迈步高度，关卡里 < 0.5 的高度差玩家走路无缝通过。
- 下降沿（走出平台）改为**触发下落**，修掉 O3 的悬空 bug。

### 3.2 跳跃（保留）

`JUMP_FORCE=6 / GRAVITY=18` → 峰值 1.0；兔子跳 ×1.2 → 1.44。不动公式，保证老手感。
（注：`jumpHeightMult` 字段目前未接线，本次顺带接上，让神殿「跳跃+10%」奖励生效。）

### 3.3 攀爬 🆕

**攀爬体 = Blender 里 `climb_` 前缀的体积**，解析为 `ClimbVolume { x, z, halfW, halfD, bottomY, topY }`。

玩家攀爬状态机：
```
walking ──(进入 climb_ 体积 XZ 范围 且 面朝它 且 按攀爬键/顶住)──▶ climbing
climbing：
  · 垂直速度 = ±CLIMB_SPEED（上/下由 moveY 控制）
  · y 在 [bottomY, topY] 间移动
  · 到 topY → 自动翻上去落到顶部地面（grounded）
  · 按跳跃键 → 🆕「爬到一半跳下」：脱离攀爬 + 给一个外向 + 向上的初速度
  · 走出 XZ 范围 / 到 bottomY → 回 walking
```

- `CLIMB_SPEED`（新常量，建议 **3.0** 单位/秒）。
- 「爬一半跳下」：`isClimbing=false; velocityY = JUMP_FORCE*0.6; 水平推离墙面`，给玩家容错/战术空间。

### 3.4 怪物的立体路径 🆕

怪物已自动贴地（O4）。新增两点：
1. **遇墙绕行**：`wall_` 体积挡住直线路径时，做简单绕行（沿墙切向 + 重新指向玩家），避免卡墙。
2. **自动攀爬**：当怪物与玩家存在 `Δh > 可迈步` 且路径上有 `climb_` 体积时，怪物把攀爬体当作「可通行的斜坡」，沿其 y 渐进上升（对怪物简化为：进入 climb_ XZ 范围则 y 朝 topY 逼近，不做贴附动画）。

> 设计取舍：怪物攀爬**不做真寻路（A\*）**，用「直线 + 遇墙切向绕 + 攀爬体内自动升降」的轻量近似即可，符合幸存者类「大量低智怪」的性能预算（同屏 100~150）。

---

## 4. Metric 规范（关卡设计硬约束）

> 单位：世界单位 / 秒。**标 🆕 的是本方案新增常量，加在 `config.ts`。**

### 4.1 移动能力上限

| 参数 | 值 | 常量 | 关卡含义 |
|---|---|---|---|
| 迈步高度 🆕 | **0.5** | `STEP_HEIGHT` | Δh ≤ 0.5 走路无缝过；做台阶/路缘用这个粒度 |
| 普通跳跃峰值 | **1.0** | 由 `JUMP_FORCE/GRAVITY` 推 | 0.5 < Δh ≤ 1.0 需跳 |
| 兔子跳峰值 | **1.44** | `BUNNY_HOP_BONUS` | 落地 0.15s 内连跳的上限 |
| 攀爬速度 🆕 | **3.0** | `CLIMB_SPEED` | 攀爬体内垂直速率 |
| 攀爬可达高度 🆕 | 由 `climb_` 体积 `topY-bottomY` 决定 | —— | 想让玩家上 y=4/6，用攀爬体而非纯跳 |
| 玩家移速 | 4.0（角色 3.2~5.0） | `PLAYER_BASE_SPEED` | 水平节奏 |
| Dash | 6 单位 / 0.2s / CD 5s | `DASH_*` | 纯水平，无垂直 |
| 滑铲 | ×1.6 / 0.5s | `SLIDE_*` | 纯水平，不能登高 |

### 4.2 关卡尺寸与边界（不变）

| 参数 | 值 | 说明 |
|---|---|---|
| 地图 | 120×120（半边 60） | `MAP_SIZE` |
| `col_` / `wall_` 摆放安全区 | 控制在 **±55** 内 | 留围栏 + 敌人 ±65 外溢 + 投射物 ±70 缓冲 |
| 高度层建议 | 0 / 2 / 4 / 6 | 维持 4 层语汇，但层间务必由坡道 / climb 连接 |
| Boss 战场 | z≈−36 附近留 ≥10×10 空地 | `spawn_boss` 周围 |
| 祭坛/传送门环带 | 距出生点 25~40 单位 | 至少 1 处可放 |

### 4.3 可达性矩阵（设计师速查）

| 相邻高度差 Δh | 走路 | 跳 | 兔子跳 | 需 climb_ |
|---|---|---|---|---|
| ≤ 0.5 | ✅ | ✅ | ✅ | — |
| 0.5–1.0 | ❌ | ✅ | ✅ | — |
| 1.0–1.44 | ❌ | ❌ | ✅(贴坡) | 建议加 |
| > 1.44 | ❌ | ❌ | ❌ | **必须** |

### 4.4 坡道与间距规则（沿用 + 强调）

- `col_` 边缘**自动生成 3 单位线性坡道**（`RAMP_WIDTH=3`），无需手建坡。
- 两相邻平台**水平间距 ≤ 6 单位**坡道才能无缝接上（各 3 单位）；> 6 需手动桥接或放 climb_。
- 多平台重叠取最大高度（`Math.max`）。

---

## 5. Blender 建模规范（保证能被正确读出）

> 这是设计师产出 glb 的**强制约定**。代码只认**物体名前缀**，名字错一个字符就识别不到。Blender 自动加的 `.001/.002` 后缀会被忽略。

### 5.1 坐标系转换（Blender Z-up → 游戏 Y-up）

| Blender | → 游戏 | 说明 |
|---|---|---|
| Position X | X | 不变 |
| Position Y | **−Z** | 深度轴取负 |
| Position Z | Y（height） | 高度 |
| Scale X | halfWidth | 实际宽 = 2 × halfWidth |
| Scale Y | halfDepth | 实际深 = 2 × halfDepth |
| Scale Z | （忽略） | 厚度无意义 |
| 导出 | **必须勾选 `+Y Up`** | 否则整关躺倒 |

### 5.2 物体命名前缀总表

#### A. 逻辑体积（用 Empty / Cube，不渲染）

| 前缀 | 类型 | 解析为 | 状态 |
|---|---|---|---|
| `col_` | 地面/平台高度 | `CollisionRect[cx,cz,halfW,halfD,height]` → `getTerrainHeight` | 沿用 |
| `wall_` 🆕 | 实心遮挡 | `WallBox{cx,cz,halfW,halfD,bottomY,topY,blockProjectile?}` → 水平阻挡 | 新增 |
| `climb_` 🆕 | 攀爬体 | `ClimbVolume{cx,cz,halfW,halfD,bottomY,topY}` | 新增 |

> 约定：`wall_` / `climb_` 用 Cube 的 **Position Z = bottomY**、**Scale Z 表示高度的一半**（即 topY = bottomY + 2×ScaleZ）。这是与 `col_`（忽略 Scale Z）唯一不同的地方，必须在 WORKFLOW.md 同步写明。

#### B. 出生点（用 Empty → Arrows）

| 前缀 | 含义 | 数量 | 状态 |
|---|---|---|---|
| `spawn_player` | 玩家出生点 | 必须 1 | 解析待接 core |
| `spawn_boss` | Boss 出生点 | 必须 1 | 同上 |
| `spawn_altar` / `spawn_teleporter` | 祭坛/传送门 | 0–N | 对接 boss-loop |
| `spawn_chest` 🆕 | 宝箱位置 | 0–N | 新增（替代随机） |
| `spawn_enemy_N/S/E/W` | 敌人刷新区 | 可选 | 不设则默认地图边缘 ±65 |

#### C. 视觉模型（用现有 `public/models/` 零件，名字 = 模型 key）

`platform_4x4` / `platform_4x2` / `platform_2x2` / `platform_1x1` / `platform_4x1` / `support` / `support_long` / `rail_long` / `fence_platform` / `light_street` / `sign_1` / `sign_2` / `ac_unit` / `pipe_1` / `door` …（完整可用清单见 §7）

> ⚠️ 视觉模型**纯渲染、无碰撞**。要让玩家站上去/被挡住，必须**另配 `col_` / `wall_`** 对齐其位置。视觉与逻辑分离是刻意的。

### 5.3 建模自检清单（导出前）

- [ ] 有且仅有 1 个 `spawn_player`、1 个 `spawn_boss`
- [ ] 每个可站立平台都有对应 `col_` 覆盖，且高度差遵守 §4.3 可达性矩阵
- [ ] 想挡住玩家的墙用 `wall_`（不是只摆视觉柱子）
- [ ] 想让玩家上 y>1.44 的高台：配了 `climb_` 或坡道间距 ≤6
- [ ] 所有 `col_/wall_/climb_` 在 ±55 内
- [ ] 勾选 `+Y Up` 导出 GLB，输出到 `public/models/levels/level_<名>.glb`
- [ ] 文件 < 5MB

---

## 6. 代码实现设计

### 6.1 数据流（client 解析 → core 消费）

```
Blender level_x.glb
   │ GLTFLoader.loadAsync（client）
   ▼
LevelLoader.parse(gltf)  🆕  [client/source/index.ts 或新 module]
   ├─ traverse 按前缀分流：
   │    col_   → collisionRects[]
   │    wall_  → walls[]
   │    climb_ → climbVolumes[]
   │    spawn_*→ spawnPoints{}
   │    模型前缀 → InstancedMesh 分组（渲染，取代 buildArena）
   ▼
LevelData { collisionRects, walls, climbVolumes, spawnPoints, chestSpawns }
   │ 经 GameConfig.level 传入（new GameInstance(config)）
   ▼
core 消费：
   terrain.ts   ← collisionRects（数据驱动化 getTerrainHeight）
   physics.ts   ← walls（水平阻挡）
   player.ts    ← climbVolumes（攀爬）、STEP_HEIGHT（迈步）
   _move.ts     ← walls/climbVolumes（怪物绕行/攀爬）
   chests.ts    ← chestSpawns（替代随机）
   GameInstance ← spawnPoints（玩家/Boss 出生）
```

### 6.2 terrain.ts 数据驱动化（核心改造）🔧

OLD：模块常量 `PLATFORMS` + 纯函数 `getTerrainHeight(x,z)`，被 4 处直接 import。

NEW（保持「纯」的两种方案，二选一）：
- **方案 a（工厂）**：`makeTerrain(rects): (x,z)=>number`，GameInstance 构造时用 LevelData 建一个实例，传进各 system 的 ctx（AiContext 已经有 `getTerrainHeight` 字段，玩家侧也改成从 engine 取）。
- **方案 b（模块状态）**：`setTerrain(rects)` 在开局调用一次，`getTerrainHeight` 读模块级 `currentRects`。改动最小，但有全局状态。

> 推荐 **方案 a**：无全局状态、可测试性好（terrain.test.ts 改成喂固定 rects）。代价是 4 个调用点改为从 ctx/engine 取函数。仍在 ♻️ 自由区。

### 6.3 新增类型（`types.ts`，加在公开导出里）📐

```ts
export interface CollisionRect { cx: number; cz: number; halfW: number; halfD: number; height: number; }
export interface WallBox { cx: number; cz: number; halfW: number; halfD: number; bottomY: number; topY: number; blockProjectile?: boolean; }
export interface ClimbVolume { cx: number; cz: number; halfW: number; halfD: number; bottomY: number; topY: number; }
export interface SpawnPoints { player?: {x:number;z:number}; boss?: {x:number;z:number}; altars?: {x:number;z:number}[]; enemyZones?: Record<string,{x:number;z:number}>; }
export interface LevelData {
  collisionRects: CollisionRect[];
  walls: WallBox[];
  climbVolumes: ClimbVolume[];
  spawnPoints: SpawnPoints;
  chestSpawns: { x:number; z:number }[];
}
// GameConfig 新增（可选，缺省回退到内置 Neon Crucible）
//   level?: LevelData;
```

`PlayerState` 新增：`isClimbing: boolean`、`climbVolumeId?: number`。
`InputState` 新增：`climb: boolean`（PC 绑定，可复用 jump/上方向键语义）。
均为**新增字段**，不破坏现有消费者。

### 6.4 涉及文件清单 + 契约归类

| 文件 | 改动 | 契约 |
|---|---|---|
| `client/source/index.ts` | 新增 LevelLoader、glb 解析、InstancedMesh 渲染、攀爬/墙体可视、输入加 climb | ♻️ 自由区 |
| `core/systems/terrain.ts` | 数据驱动化 | ♻️ |
| `core/physics.ts` | `applyMovement3D` 增加 wall 阻挡参数（签名变化→同步调用方） | ♻️（内部协作 API，非锁定签名） |
| `core/systems/player.ts` | 迈步 / 斜坡跟随 / 攀爬状态机 | ♻️ |
| `core/ai/behaviors/_move.ts` | 绕墙 + 攀爬路径 | ♻️ |
| `core/systems/chests.ts` | 读 chestSpawns | ♻️ |
| `core/GameInstance.ts` | 用 spawnPoints 定位玩家/Boss；构造 terrain | ♻️（保持 5 方法签名） |
| `core/types.ts` | 新增上述类型 + GameConfig/PlayerState/InputState 加字段 | 📐 加字段（允许） |
| `core/source/index.ts` | re-export 新类型 | 📐 **改完跑 check-contract** |
| `core/config.ts` | `STEP_HEIGHT` / `CLIMB_SPEED` | ♻️ |
| `i18n/{en,zh}.json` | 攀爬/宝箱提示文案 | 增删键**两份同步** |
| `level-editor/WORKFLOW.md` | 补 `wall_`/`climb_`/`spawn_chest` 约定 + Scale Z 语义 | 文档 |

> 🔒 锁定文件（index.html / vite / package.json / main.ts / packages/**）**全程不碰**。

---

## 7. 可用模型清单（Blender 素材库）

> 实际存在于 `public/models/`。✅ = 当前已加载；🟡 = 文件在但 loadModels 未加载（LevelLoader 要按需补加载）。

- **平台**：`platform_4x4`✅ `platform_4x2`✅ `platform_2x2`✅ `platform_1x1`✅ `platform_4x1`✅ `platform_2x1`🟡
- **支撑/护栏**：`support`✅ `support_long`✅ `support_short`🟡 `rail_long`✅ `rail_short`🟡 `rail_corner`🟡 `fence_platform`✅
- **灯/牌**：`light_street`✅ `light_street_2`🟡 `light_square`🟡 `sign_1`✅ `sign_2`✅ `sign_3`🟡 `sign_corner_1`🟡
- **装饰**：`ac_unit`✅ `ac_stacked`🟡 `pipe_1`✅ `pipe_2`🟡 `door`✅ `antenna_1`🟡 `tv_1`🟡 `computer`🟡 `turret_cannon`🟡 `lootbox`🟡
- **缺失**：`tree.glb` / `tombstone.glb`（代码引用但文件不存在）

---

## 8. 实施顺序（建议）

1. **本文档评审**（你正在看的这份）。
2. 类型与公开导出：`types.ts` + `index.ts` 加 `LevelData` 等，跑 `check-contract`。
3. `terrain.ts` 数据驱动化（方案 a）+ 改 `terrain.test.ts`。
4. LevelLoader 最小版：只解析 `col_` + `spawn_player/boss` + 模型前缀，能加载一个空 glb 跑起来（先与硬编码 buildArena 并存，加开关）。
5. 迈步 + 斜坡行走（`player.ts`）→ 修 O3。**先在浏览器验证走路上坡。**
6. `wall_` 遮挡（`physics.ts` + 渲染）。
7. `climb_` 攀爬（玩家状态机 + 爬一半跳下）。
8. 怪物绕墙 + 攀爬路径（`_move.ts`）。
9. `spawn_chest` + 出生点接线。
10. InstancedMesh 渲染优化（取代逐个 clone）。
11. i18n 同步 + 单测（terrain / wall / climb / step）。
12. `tsc --noEmit` + `pnpm build` + `check-contract` 全过。

> 每步都可独立 PR，避免一次性大改触发 CONTRIBUTING「大规模重构先开 Issue」。墙体改 `physics.ts` 的 PR 描述里要说明动了核心移动。

---

## 9. 验收标准

- [ ] 一个 Blender 导出的 `level_*.glb` 能被 LevelLoader 正确读出地面/墙/攀爬/出生点/宝箱
- [ ] Δh ≤ 0.5 走路无缝迈上；坡道能走上去（O3 修复）
- [ ] 0.5 < Δh ≤ 1.0 必须跳；> 1.44 必须攀爬/坡道
- [ ] `wall_` 真正挡住玩家水平移动（不可穿）
- [ ] 玩家可攀爬 `climb_`，且能爬到一半按跳脱离
- [ ] 怪物遇墙不卡死、能经攀爬体登高追玩家
- [ ] `spawn_player/boss` 决定出生位置；`spawn_chest` 决定宝箱位置
- [ ] `i18n/en.json` 与 `zh.json` 键集合一致
- [ ] `npx tsc --noEmit` / `pnpm build` / `check-contract` 全过

---

## 10. 不在本次范围

- 真寻路（A\*/导航网格）—— 怪物用轻量近似。
- 多关卡主题切换的美术 / 关卡间过场（对接 boss-loop 的 tier 推进另议）。
- 动态/可破坏地形。
- 新增 3D 模型文件（资源锁定，只用现有零件）。
