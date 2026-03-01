import os
import sys
import json
from pathlib import Path

def prompt_with_defaults(prompt_text, default_list):
    if not default_list:
        return input(f"请输入 {prompt_text}: ").strip()

    print(f"\n{prompt_text} (可选列表):")
    for i, default in enumerate(default_list):
        print(f"  [{i+1}] {default}")

    while True:
        user_input = input(f"请选择序号 [1-{len(default_list)}]，直接回车默认选择 [1]，或输入新值: ").strip()
        if not user_input:
            return default_list[0]

        if user_input.isdigit():
            idx = int(user_input)
            if 1 <= idx <= len(default_list):
                return default_list[idx-1]

        return user_input

def main():
    if len(sys.argv) < 2:
        print("用法: python utils/manifest.py <dirname>")
        sys.exit(1)

    dirname = sys.argv[1]
    dir_path = Path(dirname)

    if not dir_path.is_dir():
        print(f"错误: 路径 '{dirname}' 不存在或不是文件夹。")
        sys.exit(1)

    manifest_path = dir_path / "manifest.json"
    if manifest_path.exists():
        choice = input(f"文件 '{manifest_path}' 已存在。是否覆盖？(y/n) [n]: ").strip().lower()
        if choice != 'y':
            print("已取消操作。")
            sys.exit(0)

    # 读取所有文件
    all_files = []
    for root, _, files in os.walk(dir_path):
        for f in files:
            file_path = Path(root) / f
            # 保存相对路径，使用正斜杠
            rel_path = file_path.relative_to(dir_path).as_posix()
            all_files.append(rel_path)

    images = []
    urdfs = []
    mjcfs = []
    meshes = []

    image_exts = {'.png', '.jpg', '.jpeg', '.gif', '.svg'}
    mesh_exts = {'.stl', '.obj', '.dae'}

    for f in all_files:
        ext = Path(f).suffix.lower()
        if ext in image_exts:
            images.append(f)
        elif ext == '.urdf':
            urdfs.append(f)
        elif ext in {'.mjcf', '.xml'}:
            mjcfs.append(f)
        elif ext in mesh_exts:
            meshes.append(f)

    base_name = dir_path.name

    name_defaults = [base_name]
    desc_defaults = [f"{base_name} robot"]

    print("\n--- 开始生成 manifest.json ---")
    robot_name = prompt_with_defaults("机器人名称", name_defaults)
    robot_desc = prompt_with_defaults("机器人描述", desc_defaults)
    robot_preview = prompt_with_defaults("机器人预览图", images)
    robot_urdf = prompt_with_defaults("机器人 URDF 文件", urdfs)
    robot_mjcf = prompt_with_defaults("机器人 MJCF 文件", mjcfs)

    manifest_data = {
        "name": robot_name,
        "description": robot_desc,
        "preview": robot_preview,
        "urdf": robot_urdf,
        "mjcf": robot_mjcf,
        "meshes": meshes
    }

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest_data, f, indent=4, ensure_ascii=False)

    print(f"\n成功生成 {manifest_path}")
    print(json.dumps(manifest_data, indent=4, ensure_ascii=False))

if __name__ == "__main__":
    main()