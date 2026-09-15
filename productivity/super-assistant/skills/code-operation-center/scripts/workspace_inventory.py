#!/usr/bin/env python3
"""发现工作区内可用于跨应用分析的仓库/应用根目录。

本脚本会从一个或多个工作区根目录出发，向下扫描目录树，
识别出「项目根」（含 .git、.codegraph 或构建标记文件的目录），
并输出每个应用的元信息（构建系统、源码根、是否已被 CodeGraph 索引等），
供后续的跨应用调用链分析使用。
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
from typing import Any


# 扫描目录树时直接跳过的目录名：版本控制/IDE 元数据、依赖与构建产物等，
# 它们体量大且不含需要分析的业务源码，跳过可显著加速扫描。
IGNORED_DIRECTORIES = {
    ".git",
    ".idea",
    ".gradle",
    ".mvn",
    "node_modules",
    "target",
    "build",
    "dist",
    "out",
    "vendor",
    "__pycache__",
}
# 构建标记文件名 -> 构建系统类型的映射。
# 目录中一旦出现这些标记文件，即可判定其使用了对应的构建系统。
BUILD_MARKERS = {
    "pom.xml": "maven",
    "build.gradle": "gradle",
    "build.gradle.kts": "gradle-kotlin",
    "settings.gradle": "gradle-settings",
    "settings.gradle.kts": "gradle-settings-kotlin",
}


def marker_info(path: Path) -> tuple[list[str], list[str]]:
    """探测给定目录使用的构建系统与源码根目录。

    返回一个二元组：(构建系统列表, 源码根绝对路径列表)。
    - 构建系统：根据 BUILD_MARKERS 中是否存在对应标记文件判定，去重并排序。
    - 源码根：按常见约定依次探测 Java/Kotlin/通用 src 目录，存在则记录其绝对路径。
    """
    build_systems = sorted({kind for marker, kind in BUILD_MARKERS.items() if (path / marker).is_file()})
    source_roots = []
    for candidate in ("src/main/java", "src/main/kotlin", "src"):
        target = path / candidate
        if target.is_dir():
            source_roots.append(str(target.resolve()))
    return build_systems, source_roots


def is_project_root(path: Path) -> bool:
    """判断某目录是否为「项目根」。

    满足以下任一条件即视为项目根：
    - 含 .git（Git 仓库）；
    - 含 .codegraph 目录（已被 CodeGraph 索引）；
    - 含任一已知构建标记文件（Maven / Gradle 等）。
    """
    return (path / ".git").exists() or (path / ".codegraph").is_dir() or any(
        (path / marker).is_file() for marker in BUILD_MARKERS
    )


def discover(root: Path, max_depth: int) -> list[dict[str, Any]]:
    """从 root 出发、限定最大深度地扫描目录树，发现所有项目根。

    采用显式栈进行迭代式深度优先遍历（避免递归导致的栈溢出），
    对每个命中的项目根收集其元信息，最终按项目路径排序返回记录列表。
    """
    root = root.expanduser().resolve()
    if not root.is_dir():
        raise ValueError(f"workspace root does not exist: {root}")
    # 以项目路径为键去重，防止同一目录被重复记录。
    discovered: dict[str, dict[str, Any]] = {}
    # 栈中每个元素为 (目录路径, 当前深度)。
    stack: list[tuple[Path, int]] = [(root, 0)]
    while stack:
        current, depth = stack.pop()
        if is_project_root(current):
            build_systems, source_roots = marker_info(current)
            key = str(current)
            discovered[key] = {
                "application": current.name,
                "project_path": key,
                "codegraph_indexed": (current / ".codegraph").is_dir(),
                "git_repository": (current / ".git").exists(),
                "build_systems": build_systems,
                "source_roots": source_roots,
            }
            # 一个仓库内可能包含多个相互独立的 Maven/Gradle 子应用，
            # 因此即使当前目录已是项目根，仍在 max_depth 限制内继续向下扫描。
        if depth >= max_depth:
            continue
        try:
            entries = list(os.scandir(current))
        except (OSError, PermissionError):
            # 无权限或无法读取的目录直接跳过，不中断整体扫描。
            continue
        for entry in entries:
            # 只递归真实子目录（不跟随符号链接，避免环路），并跳过忽略名单中的目录。
            if not entry.is_dir(follow_symlinks=False) or entry.name in IGNORED_DIRECTORIES:
                continue
            stack.append((Path(entry.path), depth + 1))
    return [discovered[key] for key in sorted(discovered)]


def build_parser() -> argparse.ArgumentParser:
    """构建命令行参数解析器。"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", action="append", required=True, help="workspace root; may be repeated")
    parser.add_argument("--max-depth", type=int, default=5)
    parser.add_argument("--output", help="optional JSON output file")
    parser.add_argument("--pretty", action="store_true")
    return parser


def main() -> None:
    """程序入口：解析参数、扫描所有工作区根、汇总并输出 JSON 结果。"""
    args = build_parser().parse_args()
    if args.max_depth < 0:
        print("--max-depth must be non-negative", file=sys.stderr)
        raise SystemExit(2)
    # 以项目路径为键汇总所有根目录下发现的应用，天然去重。
    applications: dict[str, dict[str, Any]] = {}
    roots: list[str] = []
    try:
        for root_text in args.root:
            root = Path(root_text).expanduser().resolve()
            roots.append(str(root))
            for record in discover(root, args.max_depth):
                applications[record["project_path"]] = record
    except ValueError as exc:
        # 根目录不存在等用户可纠正的错误，打印信息并以退出码 2 结束。
        print(str(exc), file=sys.stderr)
        raise SystemExit(2) from exc
    result = {
        "workspace_roots": roots,
        "application_count": len(applications),
        "applications": [applications[key] for key in sorted(applications)],
    }
    # --pretty 时缩进美化输出，否则输出紧凑单行 JSON。
    content = json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None) + "\n"
    if args.output:
        # 指定了 --output 则写入文件（自动创建父目录）。
        output = Path(args.output).expanduser().resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(content, encoding="utf-8")
    else:
        # 否则直接写到标准输出。
        sys.stdout.write(content)


if __name__ == "__main__":
    main()
