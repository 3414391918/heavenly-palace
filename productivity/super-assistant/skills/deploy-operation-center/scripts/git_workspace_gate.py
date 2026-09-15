#!/usr/bin/env python3
"""Read-only Git gate for requirement branches in a multi-repository workspace."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path


TEST_PATH = re.compile(
    r"(^|/)(src/test|test|tests|__tests__)/|"
    r"(?:^|/)[^/]+Test\.(?:java|kt)$|"
    r"\.(?:test|spec)\.(?:js|jsx|ts|tsx)$"
)


@dataclass
class RepoAudit:
    name: str
    path: Path
    branch: str = "-"
    dirty: int = 0
    local_master: str = "-"
    origin_master: str = "-"
    remote_branch: bool = False
    behind: int | None = None
    ahead: int | None = None
    master_ancestor: bool | None = None
    deletions: list[str] = field(default_factory=list)
    missing_tests: list[str] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def git(repo: Path, *args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(f"git {' '.join(args)}: {detail}")
    return result.stdout.strip()


def is_repo(path: Path) -> bool:
    result = subprocess.run(
        ["git", "-C", str(path), "rev-parse", "--is-inside-work-tree"],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode == 0 and result.stdout.strip() == "true"


def refs(repo: Path) -> list[str]:
    output = git(
        repo,
        "for-each-ref",
        "--format=%(refname:short)",
        "refs/heads",
        "refs/remotes/origin",
    )
    return output.splitlines() if output else []


def tree_files(repo: Path, tree: str) -> set[str]:
    output = git(repo, "ls-tree", "-r", "--name-only", tree)
    return set(output.splitlines()) if output else set()


def short_sha(value: str) -> str:
    return value[:12] if value != "-" else value


def audit_repo(
    repo: Path,
    key: str,
    phase: str,
    allow_dirty: bool,
    allow_unpublished: bool,
) -> RepoAudit:
    item = RepoAudit(name=repo.name, path=repo)
    item.branch = git(repo, "branch", "--show-current") or "DETACHED"
    item.dirty = len(git(repo, "status", "--porcelain").splitlines())

    local_master = git(repo, "rev-parse", "--verify", "master", check=False)
    origin_master = git(repo, "rev-parse", "--verify", "origin/master", check=False)
    item.local_master = local_master or "-"
    item.origin_master = origin_master or "-"

    if key not in item.branch:
        item.issues.append(
            f"当前分支 {item.branch} 不包含需求关键字 {key}，但仓库存在匹配分支"
        )
    if item.branch in {"master", "DETACHED"}:
        item.issues.append(f"当前分支不能执行需求合并流程：{item.branch}")
    if item.dirty and not allow_dirty:
        item.issues.append(f"工作树有 {item.dirty} 条未提交变更")
    elif item.dirty:
        item.notes.append(f"已允许 {item.dirty} 条未提交变更，仍需逐文件确认归属")

    if item.origin_master == "-":
        item.issues.append("缺少 origin/master；先执行 git fetch origin master")
        return item

    remote_ref = f"origin/{item.branch}"
    remote_sha = git(repo, "rev-parse", "--verify", remote_ref, check=False)
    item.remote_branch = bool(remote_sha)
    if item.remote_branch:
        counts = git(repo, "rev-list", "--left-right", "--count", f"{remote_ref}...HEAD")
        left, right = counts.split()
        item.behind, item.ahead = int(left), int(right)
        if phase == "post" and (item.behind or item.ahead):
            item.issues.append(
                f"开发分支未与远端同步：behind={item.behind}, ahead={item.ahead}"
            )
    elif not allow_unpublished:
        item.issues.append(f"远端分支 {remote_ref} 不存在")
    else:
        item.notes.append(f"已允许尚未发布的远端分支 {remote_ref}")

    ancestor = subprocess.run(
        ["git", "-C", str(repo), "merge-base", "--is-ancestor", "origin/master", "HEAD"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    item.master_ancestor = ancestor.returncode == 0
    if phase == "post" and not item.master_ancestor:
        item.issues.append("origin/master 不是当前开发分支的祖先")

    deleted = git(
        repo,
        "diff",
        "--diff-filter=D",
        "--name-only",
        "origin/master...HEAD",
    )
    item.deletions = deleted.splitlines() if deleted else []
    if phase == "post" and item.deletions:
        item.issues.append(f"相对 origin/master 删除了 {len(item.deletions)} 个文件")

    master_tests = {path for path in tree_files(repo, "origin/master") if TEST_PATH.search(path)}
    head_files = tree_files(repo, "HEAD")
    item.missing_tests = sorted(master_tests - head_files)
    if phase == "post" and item.missing_tests:
        item.issues.append(
            f"当前分支缺少 origin/master 中的 {len(item.missing_tests)} 个测试文件"
        )
    return item


def discover(root: Path, key: str) -> tuple[list[Path], list[str]]:
    matched: list[Path] = []
    dirty_outside: list[str] = []
    candidates = [root] if is_repo(root) else [path for path in root.iterdir() if path.is_dir()]
    for path in sorted(candidates):
        if not is_repo(path):
            continue
        branch_refs = refs(path)
        if any(key in ref for ref in branch_refs):
            matched.append(path)
        elif git(path, "status", "--porcelain"):
            dirty_outside.append(path.name)
    return matched, dirty_outside


def value_or_dash(value: int | bool | None) -> str:
    if value is None:
        return "-"
    if isinstance(value, bool):
        return "是" if value else "否"
    return str(value)


def print_report(items: list[RepoAudit], outside: list[str], phase: str) -> None:
    print(f"# Git 工作区门禁（{phase}）")
    print()
    print("| 仓库 | 当前分支 | dirty | 远端分支 | behind/ahead | master 已合入 | 删除 | 缺失测试 |")
    print("|---|---|---:|---|---|---|---:|---:|")
    for item in items:
        sync = (
            f"{item.behind}/{item.ahead}"
            if item.behind is not None and item.ahead is not None
            else "-"
        )
        print(
            f"| {item.name} | {item.branch} | {item.dirty} | "
            f"{value_or_dash(item.remote_branch)} | {sync} | "
            f"{value_or_dash(item.master_ancestor)} | {len(item.deletions)} | "
            f"{len(item.missing_tests)} |"
        )
    print()
    print("## 本地 master 基线")
    print()
    for item in items:
        print(
            f"- {item.name}: local={short_sha(item.local_master)}, "
            f"origin={short_sha(item.origin_master)}"
        )
    if outside:
        print()
        print("## 范围外脏仓库")
        print()
        print("以下仓库不含需求关键字但工作树不干净，不会自动纳入本需求：")
        for name in outside:
            print(f"- {name}")
    notes = [(item.name, note) for item in items for note in item.notes]
    if notes:
        print()
        print("## 提示")
        print()
        for name, note in notes:
            print(f"- {name}: {note}")
    issues = [(item.name, issue) for item in items for issue in item.issues]
    print()
    print("## 门禁结果")
    print()
    if not issues:
        print("PASS：未发现阻断项。")
    else:
        print("FAIL：")
        for name, issue in issues:
            print(f"- {name}: {issue}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True, help="工作区或单仓库根目录")
    parser.add_argument("--requirement-key", required=True, help="需求分支中的稳定关键字")
    parser.add_argument("--phase", choices=("pre", "post"), required=True)
    parser.add_argument(
        "--allow-dirty",
        action="store_true",
        help="仅用于提交前已人工确认未提交文件都属于本需求的场景",
    )
    parser.add_argument(
        "--allow-unpublished",
        action="store_true",
        help="仅用于首次创建、尚未推送远端分支的场景",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR：目录不存在：{root}", file=sys.stderr)
        return 2
    try:
        repos, dirty_outside = discover(root, args.requirement_key)
        if not repos:
            print(f"ERROR：没有找到包含关键字 {args.requirement_key} 的分支", file=sys.stderr)
            return 2
        items = [
            audit_repo(
                repo,
                args.requirement_key,
                args.phase,
                args.allow_dirty,
                args.allow_unpublished,
            )
            for repo in repos
        ]
    except (RuntimeError, OSError, ValueError) as exc:
        print(f"ERROR：{exc}", file=sys.stderr)
        return 2
    print_report(items, dirty_outside, args.phase)
    return 1 if any(item.issues for item in items) else 0


if __name__ == "__main__":
    raise SystemExit(main())
