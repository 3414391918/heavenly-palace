#!/usr/bin/env bash
# 同时确认可执行文件与目标库，不能只凭 help 成功就声称库可用。
set -euo pipefail
if [[ "${1:-}" == --help || "${1:-}" == -h ]]; then
  echo '用法: bash detect_obsidian.sh [安装目录] [知识库完整路径]'
  echo '也可通过 OBSIDIAN_CLI / OBSIDIAN_INSTALL_DIR / OBSIDIAN_VAULT_PATH 指定。'
  exit 0
fi
[[ -z "${1:-}" ]] || export OBSIDIAN_INSTALL_DIR="$1"
[[ -z "${2:-}" ]] || export OBSIDIAN_VAULT_PATH="$2"
. "$(dirname "$0")/cli_env.sh"
ko_init
printf 'OBSIDIAN_CLI=%s\nVAULT_PATH=%s\nVAULT_READY=yes\n' "$OBSIDIAN_CLI" "$OBSIDIAN_VAULT_PATH"
