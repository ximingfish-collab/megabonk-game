# MegaBonk — 赛博朋克肉鸽生存游戏

一款基于 Three.js 的 3D 网页肉鸽生存游戏（类似 Vampire Survivors）。

## 快速开始

```bash
# 1. 克隆项目
git clone <你的仓库地址>
cd megabonk-game

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev

# 4. 打开浏览器
# 本机: http://localhost:15173
# 局域网: http://<你的IP>:15173 (用 --host 参数)
```

## 技术栈

| 技术 | 用途 |
|------|------|
| Three.js | 3D 渲染 |
| TypeScript | 类型安全 |
| Vite | 开发/构建 |
| pnpm workspace | 内部包管理 |

## 项目结构

```
megabonk-game/
├── game/
│   ├── core/source/          ← 游戏逻辑（纯计算，无渲染）
│   │   ├── GameInstance.ts   ← 主游戏循环
│   │   ├── config.ts         ← 所有游戏常量/配置
│   │   ├── types.ts          ← TypeScript 类型定义
│   │   ├── physics.ts        ← 移动/碰撞
│   │   ├── weapons.ts        ← 武器系统
│   │   ├── upgrades.ts       ← 升级系统
│   │   ├── quests.ts         ← 任务系统
│   │   ├── shop.ts           ← 商店系统
│   │   └── save.ts           ← 存档系统
│   └── client/source/        ← 渲染层
│       └── index.ts          ← Three.js 场景、相机、HUD、关卡
├── dist/models/              ← 3D 模型资源 (GLTF/GLB)
├── i18n/                     ← 多语言文本 (en.json, zh.json)
├── level-editor/             ← 关卡编辑工具和文档
│   ├── WORKFLOW.md           ← ⭐ 关卡制作完整流程
│   ├── build_asset_library.py
│   └── import_assets.py
├── packages/                 ← 内部共享包（一般不需要改）
├── LEVEL_DESIGN.md           ← 关卡设计数据参考
└── README.md                 ← 本文件
```

## 参与开发

### 我想改游戏玩法

修改这些文件：
- `game/core/source/config.ts` — 数值调整（伤害、速度、冷却等）
- `game/core/source/GameInstance.ts` — 游戏逻辑
- `game/core/source/weapons.ts` — 武器行为

### 我想改画面/UI

修改这个文件：
- `game/client/source/index.ts` — 场景、相机、HUD、粒子、动画

### 我想做关卡

阅读这个文档：
- `level-editor/WORKFLOW.md` — 完整的关卡制作流程

简要流程：
1. 在 Blender 中用 `dist/models/` 里的模型拼接场景
2. 用 `col_` 前缀的 Empty 标记碰撞区域
3. 用 `spawn_player` / `spawn_boss` 标记生成点
4. 导出为 `.glb` → 放到 `dist/models/levels/`

### 我想加新文本/翻译

修改这两个文件：
- `i18n/en.json` — 英文
- `i18n/zh.json` — 中文

在代码中使用：
```typescript
import { t } from '@minigame/i18n'
t('hud.level', { level: '5' })
```

## 常用命令

```bash
pnpm dev              # 启动开发服务器
pnpm dev:manual       # 手动模式（端口 5173）
pnpm build            # 生产构建
pnpm preview          # 预览构建结果
npx tsc --noEmit      # 类型检查
```

## 游戏功能概览

- 3 个可选角色（不同属性/初始武器）
- 13 种武器 + 武器进化系统
- 10 种被动宝典（Tomes）
- 波次敌人系统（5 波 + Boss 战）
- 3 个难度等级（Normal / Hard / Nightmare）
- 商店 + 永久升级
- 任务系统
- 传送器机制
- 跳跃 / 滑铲 / 兔子跳动作系统

## 模型资源

所有 3D 模型在 `dist/models/` 中，格式为 GLTF/GLB。
完整模型清单见 `LEVEL_DESIGN.md`。

**重要：不能自行添加新模型文件。所有关卡搭建必须使用已有资源。**

## 相关文档

| 文档 | 内容 |
|------|------|
| `LEVEL_DESIGN.md` | 关卡数据、碰撞格式、可用模型清单 |
| `level-editor/WORKFLOW.md` | 关卡制作完整工作流 |
| `level-editor/README.md` | 快速操作指南 |
| `KUBEE.md` | 项目模板开发指南 |

## License

MIT
