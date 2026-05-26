# MegaBonk 关卡编辑工作流

## 快速开始

### 第一步：导入模型库

1. 打开 Blender (3.6+)
2. 删除默认物体 (A 全选 → X 删除)
3. 切换到 **Scripting** 工作区
4. 打开 `import_assets.py`
5. 确认脚本顶部路径正确:
   ```python
   MODELS_DIR = "/Users/liusheng/Documents/megabonk-game/dist/models"
   ```
6. 运行脚本 (Alt+P)
7. **File → Save As** → `megabonk_asset_library.blend`

### 第二步：搭建关卡

1. 在同一文件中新建 Collection，命名为你的关卡名 (如 `Level_CyberCity`)
2. 从左侧的模型 Collection 中 **Shift+D 复制** 模型到你的关卡 Collection
3. 摆放、旋转、缩放模型

### 第三步：标记碰撞区域

1. 在 `_Collision_Templates` 中找到碰撞模板
2. Shift+D 复制到你的关卡 Collection
3. 移动到平台位置，调整 Scale 匹配平台大小
4. **命名规则**:
   - `col_` 开头 = 碰撞体积
   - Scale X/Y = 碰撞范围的半宽/半深
   - 位置 Z = 平台高度

### 第四步：导出

1. 只选中你的关卡 Collection 中的物体
2. **File → Export → glTF 2.0 (.glb)**
3. 设置:
   - Format: `GLB`
   - Include: `Selected Objects`
   - Transform: Y Up ✓
   - 勾选 `+Y Up`
4. 保存为 `level_cybercity.glb`
5. 放到 `dist/models/levels/` 目录

---

## 命名规范 (重要!)

我的代码通过物体名字的**前缀**来识别模型类型:

| 物体名前缀 | 类型 | 示例 |
|-----------|------|------|
| `platform_4x4` | 4×4 平台 | `platform_4x4.001`, `platform_4x4.002` |
| `platform_4x2` | 4×2 平台 | `platform_4x2.015` |
| `support_long` | 长支撑柱 | `support_long.003` |
| `col_` | 碰撞体积 | `col_ground_center`, `col_plat_tower_n` |
| `spawn_` | 游戏逻辑点 | `spawn_player`, `spawn_boss` |

### Blender 自动编号

当你 Shift+D 复制物体时，Blender 会自动加 `.001`, `.002` 等后缀。
这完全没问题！我的代码会提取 `.` 前面的部分作为模型类型。

---

## 碰撞体积详细说明

碰撞体积是 **Empty 物体 (Cube 显示模式)**:

```
物体名:   col_platform_north_tower
位置:     (0, 4, -40)         ← X, Z(高度), Y(深度) 注意 Blender Y=深度
Scale:    (5, 0.1, 5)         ← 半宽, 厚度(忽略), 半深
```

游戏中的碰撞格式是 `[centerX, centerZ, halfWidth, halfDepth, height]`

转换规则 (Blender → 游戏):
- 游戏 X = Blender X
- 游戏 Z = Blender -Y  (Blender Y轴 = 游戏 -Z轴)
- 游戏 height = Blender Z
- 游戏 halfWidth = Blender Scale X
- 游戏 halfDepth = Blender Scale Y (或 Z 取决于导出设置)

---

## 生成点类型

| 名字 | 功能 | 数量要求 |
|------|------|---------|
| `spawn_player` | 玩家出生点 | 必须 1 个 |
| `spawn_boss` | Boss 出生位置 | 必须 1 个 |
| `spawn_teleporter` | 传送器可能出现的位置 | 0-3 个 |
| `spawn_enemy_N` | 敌人刷新点 (N=北) | 可选，默认从边缘 |

---

## 性能建议

| 模型类型 | 建议最大实例数 | 原因 |
|---------|--------------|------|
| platform_4x4 | 50 | 大面积覆盖，不需要太多 |
| platform_4x2 | 80 | 走廊/过道 |
| support/support_long | 100 | 结构支撑 |
| fence_platform | 150 | 围栏，数量多但简单 |
| light_street | 40 | 中等复杂度 |
| sign_1/sign_2 | 20 | 有纹理，适度使用 |
| ac_unit/pipe | 60 | 小物件装饰 |
| **总计建议** | **< 800** | 超过后考虑合并静态物体 |

---

## 文件结构

```
level-editor/
├── import_assets.py          ← 导入脚本 (运行一次)
├── README.md                 ← 本文档
└── (你创建的)
    ├── megabonk_asset_library.blend  ← 模型库
    ├── level_cybercity.blend         ← 关卡1源文件
    ├── level_rooftop.blend           ← 关卡2源文件
    └── exports/
        ├── level_cybercity.glb       ← 导出的关卡文件
        └── level_rooftop.glb
```

---

## 关卡导出后我的处理

你导出 `.glb` 给我后，我的代码会:

1. **解析物体名** → 识别模型类型
2. **同类合并** → 500 个 platform_4x4 变成 1 个 InstancedMesh (1 draw call)
3. **提取碰撞** → `col_` 前缀的 Empty → 生成 `getTerrainHeight()` 数据
4. **提取生成点** → `spawn_` 前缀 → 设置玩家/Boss/传送器位置
5. **加载关卡** → 根据 Tier 加载对应 `.glb`

---

## 坐标系对照

```
         Blender              游戏 (Three.js)
         +Z (上)              +Y (上)
          |                    |
          |                    |
          +--- +X (右)        +--- +X (右)
         /                    /
        +Y (前/深度)         +Z (前)

转换: 
  游戏 X = Blender X
  游戏 Y = Blender Z (高度)
  游戏 Z = -Blender Y (深度翻转)
```

导出 GLB 时勾选 `+Y Up` 会自动处理这个转换。
