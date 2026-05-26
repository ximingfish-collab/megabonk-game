"""
MegaBonk Level Editor - Asset Import Script
============================================

在 Blender 中运行此脚本，自动导入所有游戏模型到一个组织好的 .blend 文件中。

使用方法:
1. 打开 Blender (建议 3.6+)
2. 删除默认的 Cube/Light/Camera
3. 打开 Scripting 工作区
4. 点击 "Open" 加载此脚本
5. 修改下面的 MODELS_DIR 路径指向你的 dist/models/ 文件夹
6. 点击 "Run Script" (Alt+P)
7. 保存为 megabonk_asset_library.blend

导入后的结构:
- Collection "Platforms" — 所有平台模型
- Collection "Structures" — 支撑、栏杆、围栏
- Collection "Decorations" — 路灯、管道、招牌、空调等
- Collection "Props" — 电脑、电视、箱子等
- Collection "Nature" — 树、墓碑、南瓜
- Collection "Characters" — 玩家、敌人、Boss (仅参考)
- Collection "Gameplay" — 传送器、拾取物
- Collection "_Collision_Templates" — 碰撞体积模板

每个模型缩放为 1.0，摆放在自己的 Collection 中。
搭建关卡时，从这些 Collection 中复制 (Shift+D) 模型实例到你的关卡 Collection。
"""

import bpy
import os
import math

# ═══════════════════════════════════════════════════════════════════════════
# 配置 — 修改这个路径！
# ═══════════════════════════════════════════════════════════════════════════

MODELS_DIR = "/Users/liusheng/Documents/megabonk-game/dist/models"

# ═══════════════════════════════════════════════════════════════════════════
# 模型分类
# ═══════════════════════════════════════════════════════════════════════════

MODEL_CATEGORIES = {
    "Platforms": [
        ("platform_4x4_full", "platform_4x4_full.gltf"),
        ("platform_4x4", "platform_4x4.gltf"),
        ("platform_4x2", "platform_4x2.gltf"),
        ("platform_2x2", "platform_2x2.gltf"),
        ("platform_2x1", "platform_2x1.gltf"),
        ("platform_1x1", "platform_1x1.gltf"),
        ("platform_4x1", "platform_4x1.gltf"),
    ],
    "Structures": [
        ("support", "support.gltf"),
        ("support_short", "support_short.gltf"),
        ("support_long", "support_long.gltf"),
        ("fence_platform", "fence_platform.gltf"),
        ("fence", "fence.glb"),
        ("rail_long", "rail_long.gltf"),
        ("rail_short", "rail_short.gltf"),
        ("rail_corner", "rail_corner.gltf"),
        ("door", "door.gltf"),
    ],
    "Decorations": [
        ("light_street_1", "light_street_1.gltf"),
        ("light_street_2", "light_street_2.gltf"),
        ("light_square", "light_square.gltf"),
        ("sign_1", "sign_1.gltf"),
        ("sign_2", "sign_2.gltf"),
        ("sign_3", "sign_3.gltf"),
        ("sign_corner_1", "sign_corner_1.gltf"),
        ("ac_unit", "ac_unit.gltf"),
        ("ac_stacked", "ac_stacked.gltf"),
        ("pipe_1", "pipe_1.gltf"),
        ("pipe_2", "pipe_2.gltf"),
        ("antenna_1", "antenna_1.gltf"),
        ("tv_1", "tv_1.gltf"),
        ("computer", "computer.gltf"),
    ],
    "Props": [
        ("lootbox", "lootbox.gltf"),
        ("turret_cannon", "turret_cannon.gltf"),
        ("collectible_gear", "collectible_gear.gltf"),
        ("pickup_health", "pickup_health.gltf"),
        ("pickup_heart", "pickup_heart.gltf"),
    ],
    "Nature": [
        ("tree", "tree.glb"),
        ("tombstone", "tombstone.glb"),
        ("pumpkin", "pumpkin.glb"),
    ],
    "Characters": [
        ("player_cyberpunk", "player_cyberpunk.gltf"),
        ("player", "player.glb"),
        ("skeleton", "skeleton.glb"),
        ("zombie", "zombie.glb"),
        ("ghost", "ghost.glb"),
        ("boss", "boss.glb"),
        ("enemy_2legs", "enemy_2legs.gltf"),
        ("enemy_2legs_gun", "enemy_2legs_gun.gltf"),
        ("enemy_flying", "enemy_flying.gltf"),
        ("enemy_flying_gun", "enemy_flying_gun.gltf"),
        ("enemy_large", "enemy_large.gltf"),
        ("enemy_large_gun", "enemy_large_gun.gltf"),
    ],
    "Gameplay": [
        ("turret_teleporter", "turret_teleporter.gltf"),
    ],
}

# ═══════════════════════════════════════════════════════════════════════════
# 脚本主逻辑
# ═══════════════════════════════════════════════════════════════════════════

def clear_scene():
    """清空当前场景"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # 清空孤立数据
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)

def create_collection(name):
    """创建或获取集合"""
    if name in bpy.data.collections:
        return bpy.data.collections[name]
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col

def import_gltf(filepath, collection, display_name):
    """导入 GLTF/GLB 文件到指定集合"""
    if not os.path.exists(filepath):
        print(f"  [SKIP] 文件不存在: {filepath}")
        return None

    # 记录导入前的物体
    before = set(bpy.data.objects)

    # 导入
    try:
        bpy.ops.import_scene.gltf(filepath=filepath)
    except Exception as e:
        print(f"  [ERROR] 导入失败 {filepath}: {e}")
        return None

    # 找到新增的物体
    after = set(bpy.data.objects)
    new_objects = after - before

    if not new_objects:
        print(f"  [WARN] 无新物体: {display_name}")
        return None

    # 创建一个 Empty 作为根节点
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    root = bpy.context.active_object
    root.name = display_name
    root.empty_display_size = 0.5

    # 将所有新物体设为 root 的子物体
    for obj in new_objects:
        # 从所有集合中移除
        for col in obj.users_collection:
            col.objects.unlink(obj)
        # 链接到目标集合
        collection.objects.link(obj)
        # 设置父级
        obj.parent = root

    # root 也移到目标集合
    for col in root.users_collection:
        col.objects.unlink(root)
    collection.objects.link(root)

    print(f"  [OK] {display_name} ({len(new_objects)} objects)")
    return root

def create_collision_templates(collection):
    """创建碰撞体积模板"""
    templates = [
        ("col_ground", (30, 30, 0.1), (0, 0, 0)),         # 大地面
        ("col_platform_2m", (10, 10, 0.1), (0, 0, 2)),    # y=2 平台
        ("col_platform_4m", (10, 10, 0.1), (0, 0, 4)),    # y=4 平台
        ("col_platform_6m", (6, 6, 0.1), (0, 0, 6)),      # y=6 平台
        ("col_ramp", (3, 6, 0.1), (0, 0, 1)),             # 坡道
    ]

    for name, size, loc in templates:
        bpy.ops.object.empty_add(type='CUBE', location=loc)
        obj = bpy.context.active_object
        obj.name = name
        obj.empty_display_size = 1.0
        obj.scale = (size[0], size[1], size[2])
        # 设置显示为线框
        obj.show_in_front = True

        # 移到 collection
        for col in obj.users_collection:
            col.objects.unlink(obj)
        collection.objects.link(obj)

    print(f"  [OK] 创建了 {len(templates)} 个碰撞模板")

def create_spawn_templates(collection):
    """创建游戏逻辑点模板"""
    spawns = [
        ("spawn_player", (0, 0, 0)),
        ("spawn_boss", (0, -36, 0)),
        ("spawn_teleporter", (25, 0, 0)),
    ]

    for name, loc in spawns:
        bpy.ops.object.empty_add(type='ARROWS', location=loc)
        obj = bpy.context.active_object
        obj.name = name
        obj.empty_display_size = 2.0

        for col in obj.users_collection:
            col.objects.unlink(obj)
        collection.objects.link(obj)

    print(f"  [OK] 创建了 {len(spawns)} 个生成点模板")

def setup_scene():
    """设置场景参数"""
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0

    # 设置视口剪裁距离
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.clip_end = 500

def add_reference_grid():
    """添加参考网格 (120×120 和 200×200)"""
    # 120×120 参考（当前地图大小）
    bpy.ops.mesh.primitive_grid_add(
        x_subdivisions=12, y_subdivisions=12,
        size=120, location=(0, 0, -0.01)
    )
    grid_120 = bpy.context.active_object
    grid_120.name = "REF_Grid_120x120"
    grid_120.display_type = 'WIRE'
    grid_120.hide_render = True

    # 200×200 参考（最大范围）
    bpy.ops.mesh.primitive_grid_add(
        x_subdivisions=20, y_subdivisions=20,
        size=200, location=(0, 0, -0.02)
    )
    grid_200 = bpy.context.active_object
    grid_200.name = "REF_Grid_200x200"
    grid_200.display_type = 'WIRE'
    grid_200.hide_render = True

# ═══════════════════════════════════════════════════════════════════════════
# 运行
# ═══════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("MegaBonk Asset Library 导入工具")
    print("=" * 60)

    # 验证路径
    if not os.path.isdir(MODELS_DIR):
        print(f"\n[ERROR] 模型目录不存在: {MODELS_DIR}")
        print("请修改脚本顶部的 MODELS_DIR 变量")
        return

    # 清空场景
    print("\n[1/6] 清空场景...")
    clear_scene()

    # 设置场景
    print("[2/6] 设置场景参数...")
    setup_scene()

    # 导入模型分类
    print("[3/6] 导入模型...")
    x_offset = 0
    for category_name, models in MODEL_CATEGORIES.items():
        print(f"\n  --- {category_name} ---")
        col = create_collection(category_name)

        for i, (display_name, filename) in enumerate(models):
            filepath = os.path.join(MODELS_DIR, filename)
            root = import_gltf(filepath, col, display_name)
            if root:
                # 在 X 轴上排列展示
                root.location.x = x_offset
                root.location.y = i * 5  # 同类模型在 Y 轴排列
        x_offset += 15  # 不同类别间隔 15 单位

    # 创建碰撞模板
    print("\n[4/6] 创建碰撞体积模板...")
    collision_col = create_collection("_Collision_Templates")
    create_collision_templates(collision_col)

    # 创建生成点模板
    print("\n[5/6] 创建生成点模板...")
    spawn_col = create_collection("_Spawn_Templates")
    create_spawn_templates(spawn_col)

    # 参考网格
    print("\n[6/6] 添加参考网格...")
    add_reference_grid()

    print("\n" + "=" * 60)
    print("导入完成!")
    print(f"总共导入 {sum(len(m) for m in MODEL_CATEGORIES.values())} 个模型")
    print("\n下一步:")
    print("1. 保存为 megabonk_asset_library.blend")
    print("2. 新建关卡文件时 File > Append 从此文件导入模型")
    print("3. 或直接在此文件中新建 Collection 开始搭建关卡")
    print("=" * 60 + "\n")

main()
