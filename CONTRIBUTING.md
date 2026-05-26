# 贡献指南

感谢你对 MegaBonk 项目的兴趣！请按以下流程提交你的贡献。

## 贡献流程

```
1. Fork 本仓库到你自己的 GitHub 账号
2. Clone 你 fork 的仓库到本地
3. 创建功能分支
4. 开发 + 测试
5. 提交 Pull Request (PR) 到本仓库的 master 分支
6. 等待 Review → 合并
```

## 详细步骤

### 1. Fork & Clone

```bash
# 在 GitHub 上点击右上角 "Fork" 按钮

# Clone 你自己的 fork
git clone https://github.com/<你的用户名>/megabonk-game.git
cd megabonk-game

# 添加上游仓库（用于同步最新代码）
git remote add upstream https://github.com/Adios94/megabonk-game.git
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 创建功能分支

```bash
# 先同步最新代码
git fetch upstream
git checkout master
git merge upstream/master

# 创建你的功能分支
git checkout -b feature/你的功能名
```

分支命名建议：
- `feature/新功能名` — 新功能
- `fix/问题描述` — Bug 修复
- `level/关卡名` — 新关卡
- `balance/调整内容` — 数值平衡调整

### 4. 开发 & 测试

```bash
# 启动开发服务器
pnpm dev

# 类型检查（提交前必须通过）
npx tsc --noEmit

# 构建测试（提交前必须通过）
pnpm build
```

### 5. 提交代码

```bash
git add <你修改的文件>
git commit -m "类型: 简短描述"
git push origin feature/你的功能名
```

Commit 消息格式：
- `功能: 添加新武器-激光炮`
- `修复: 玩家穿墙问题`
- `平衡: 降低火焰法杖冷却时间`
- `关卡: 添加屋顶主题关卡`
- `文档: 更新武器属性表`

### 6. 提交 Pull Request

1. 在 GitHub 上打开你的 fork 仓库
2. 点击 "Compare & pull request"
3. 填写 PR 描述（说清楚改了什么、为什么改）
4. 等待 Review

## PR 要求

提交 PR 前请确保：

- [ ] `npx tsc --noEmit` 无报错
- [ ] `pnpm build` 构建成功
- [ ] 本地运行游戏测试过功能正常
- [ ] 没有引入新的模型文件（必须使用 `dist/models/` 已有资源）
- [ ] 如果修改了关卡碰撞，确保视觉和碰撞数据同步

## 开发方向

当前接受以下类型的贡献：

| 方向 | 说明 | 参考文件 |
|------|------|---------|
| 数值平衡 | 武器伤害/冷却/敌人属性调整 | `game/core/source/config.ts` |
| 新武器/技能 | 添加武器类型或被动宝典 | `config.ts` + `weapons.ts` |
| 关卡设计 | 用 Blender 搭建新关卡 | `level-editor/WORKFLOW.md` |
| UI/画面 | HUD 改进、粒子效果、动画 | `game/client/source/index.ts` |
| Bug 修复 | 任何已知问题 | Issues 列表 |
| 翻译 | 添加/修正文本 | `i18n/*.json` |

## 不接受的贡献

- 引入新的 npm 包（除非有充分理由并提前讨论）
- 添加新的 3D 模型文件（资源锁定）
- 修改 `packages/` 下的共享基础设施（除非必要）
- 大规模重构（请先开 Issue 讨论）

## 同步上游代码

当主仓库有新的提交时，同步到你的 fork：

```bash
git fetch upstream
git checkout master
git merge upstream/master
git push origin master
```

如果你的功能分支与最新 master 有冲突：

```bash
git checkout feature/你的功能名
git rebase master
# 解决冲突后
git push origin feature/你的功能名 --force-with-lease
```

## 有问题？

- 开一个 Issue 描述你的想法或问题
- 不确定方向时先讨论再动手
