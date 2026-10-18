#!/usr/bin/env bash
# 公共环境函数：只定义函数，source 时不更改调用方参数、目录或 shell 选项。
ko_cli_raw() (
  # 明确 cwd；关闭 stdin，避免 CLI 吃掉笔记脚本的标准输入正文。
  cd "$_KO_VAULT" || return 1
  # 避免连续进程挤在同一应用事件循环中，留出索引/IPC 完成窗口。
  sleep 0.2
  MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "$OBSIDIAN_CLI" "$@" < /dev/null &
  local cli_pid=$! guard_pid status=0
  # 官方 CLI 偶有挂起；只终止本次子进程，不重试可能已经执行的写入。
  (sleep 25; kill -KILL "$cli_pid" 2>/dev/null || true) >/dev/null 2>&1 &
  guard_pid=$!
  wait "$cli_pid" || status=$?
  kill "$guard_pid" 2>/dev/null || true
  wait "$guard_pid" 2>/dev/null || true
  if [[ "$status" == 137 ]]; then
    echo 'Error: CLI 调用超过 25 秒；先核对实际结果再重试。' >&2
    return 124
  fi
  return "$status"
)

ko_cli() (
  # 用临时文件保留 stdout 尾部空行；子 shell 的清理不覆盖调用方 trap。
  local result first status=0
  result="$(mktemp "${TMPDIR:-/tmp}/knowledge-cli.XXXXXX")" || return 1
  trap 'rm -f "$result"' EXIT
  ko_cli_raw "$@" > "$result" || status=$?
  IFS= read -r first < "$result" || true
  cat "$result"
  [[ "$status" == 0 ]] || return "$status"
  # Obsidian 部分错误仍返回 0；将明确错误消息转换为非零退出码。
  case "$first" in Error:*|"Error "*) return 1 ;; esac
)

ko_validate_path() {
  # 不允许越出 vault 或把知识写进应用/Git 配置；引用中的中文和空格可以正常使用。
  case "$1" in
    ''|/*|[A-Za-z]:*|*\\*|./*|*/./*|*/.|.|../*|*/../*|*/..|..|.obsidian/*|.git/*|*$'\n'*|*$'\r'*)
      echo '错误：目标必须是知识库内的安全相对路径。' >&2; return 1 ;;
  esac
}

ko_file_exists() {
  local encoded result
  encoded="$(printf '%s' "$1" | base64 | tr -d '\r\n')"
  result="$(ko_cli eval code="(async()=>{const p=new TextDecoder().decode(Uint8Array.from(atob('$encoded'),c=>c.charCodeAt(0)));return await app.vault.adapter.exists(p);})()")" || return 2
  case "${result%$'\r'}" in
    '=> true') return 0 ;;
    '=> false') return 1 ;;
    *) echo 'Error: 无法确认目标是否存在。' >&2; return 2 ;;
  esac
}

ko_resolve_cli() {
  # 只找可执行入口，不要求所有机器安装到同一位置；显式指定错误时立即失败。
  local install_dir candidate base program_files_x86
  if [[ -n "${OBSIDIAN_CLI:-}" ]]; then
    candidate="$OBSIDIAN_CLI"
    if command -v cygpath >/dev/null 2>&1; then candidate="$(cygpath -u "$candidate")"; fi
    [[ -x "$candidate" ]] || { echo "错误：CLI 不可执行：$candidate" >&2; return 1; }
    printf '%s\n' "$candidate"; return
  fi
  if [[ -n "${OBSIDIAN_INSTALL_DIR:-}" ]]; then
    install_dir="$OBSIDIAN_INSTALL_DIR"
    if command -v cygpath >/dev/null 2>&1; then install_dir="$(cygpath -u "$install_dir")"; fi
    for candidate in "$install_dir/Contents/MacOS/obsidian-cli" \
                     "$install_dir/Obsidian.app/Contents/MacOS/obsidian-cli" \
                     "$install_dir/Obsidian.com"; do
      [[ -x "$candidate" ]] && { printf '%s\n' "$candidate"; return; }
    done
    echo "错误：指定安装目录中找不到 CLI：$install_dir" >&2; return 1
  fi
  # 跳过失效的 PATH 链接，继续检查系统常用安装目录。
  for base in obsidian Obsidian.com; do
    candidate="$(command -v "$base" 2>/dev/null || true)"
    [[ -n "$candidate" && -x "$candidate" ]] && { printf '%s\n' "$candidate"; return; }
  done
  for candidate in /Applications/Obsidian.app/Contents/MacOS/obsidian-cli \
                   "$HOME/Applications/Obsidian.app/Contents/MacOS/obsidian-cli"; do
    [[ -x "$candidate" ]] && { printf '%s\n' "$candidate"; return; }
  done
  # Git Bash 读取 Windows 的环境目录；不硬编码盘符或用户名。
  for base in "${LOCALAPPDATA:-${LocalAppData:-}}"; do
    [[ -n "$base" ]] || continue
    if command -v cygpath >/dev/null 2>&1; then base="$(cygpath -u "$base")"; fi
    for candidate in "$base/Programs/Obsidian/Obsidian.com" "$base/Obsidian/Obsidian.com"; do
      [[ -x "$candidate" ]] && { printf '%s\n' "$candidate"; return; }
    done
  done
  program_files_x86="$(printenv 'ProgramFiles(x86)' 2>/dev/null || true)"
  for base in "${PROGRAMFILES:-${ProgramFiles:-}}" "$program_files_x86"; do
    [[ -n "$base" ]] || continue
    if command -v cygpath >/dev/null 2>&1; then base="$(cygpath -u "$base")"; fi
    candidate="$base/Obsidian/Obsidian.com"
    [[ -x "$candidate" ]] && { printf '%s\n' "$candidate"; return; }
  done
  echo '错误：未找到 CLI。请先启用 Obsidian 命令行界面；自定义位置用 OBSIDIAN_CLI 指定入口，或用 OBSIDIAN_INSTALL_DIR 指定应用目录。' >&2
  return 1
}

ko_init() {
  local helper_dir candidate actual normalized
  helper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  candidate="$(ko_resolve_cli)" || return 1
  OBSIDIAN_CLI="$(cd "$(dirname "$candidate")" && pwd -P)/$(basename "$candidate")"
  export OBSIDIAN_CLI
  _KO_VAULT="${OBSIDIAN_VAULT_PATH:-$helper_dir/../knowledgebases}"
  if command -v cygpath >/dev/null 2>&1; then _KO_VAULT="$(cygpath -u "$_KO_VAULT")"; fi
  _KO_VAULT="$(cd "$_KO_VAULT" && pwd -P)" || return 1
  actual="$(ko_cli vault info=path)" || { echo '请先打开目标库并启用 CLI。' >&2; return 1; }
  actual="${actual%$'\r'}"
  if command -v cygpath >/dev/null 2>&1; then actual="$(cygpath -u "$actual")"; fi
  normalized="$(cd "$actual" 2>/dev/null && pwd -P)" || normalized=''
  [[ "$normalized" == "$_KO_VAULT" ]] || {
    echo "错误：CLI 当前库与指定库不一致，拒绝写入。期望 $_KO_VAULT，实际 $actual" >&2
    return 1
  }
  # 长正文子进程继承明确的库路径，避免最近聚焦窗口改变目标。
  OBSIDIAN_VAULT_PATH="$_KO_VAULT"
  export OBSIDIAN_VAULT_PATH
}
