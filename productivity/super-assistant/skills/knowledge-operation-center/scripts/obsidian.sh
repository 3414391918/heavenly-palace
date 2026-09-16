#!/usr/bin/env bash
# 为所有 CLI 命令提供一致的路径定位与库校验；脚本路径与当前工作目录无关。
set -euo pipefail
if [[ "${1:-}" == --help || "${1:-}" == -h ]]; then
  echo '用法: bash obsidian.sh <Obsidian CLI 命令> [参数...]'
  echo '默认操作同一 Skill 下的 knowledgebases；可设 OBSIDIAN_CLI 和 OBSIDIAN_VAULT_PATH。'
  exit 0
fi
. "$(dirname "$0")/cli_env.sh"
ko_init
ko_cli "$@"
