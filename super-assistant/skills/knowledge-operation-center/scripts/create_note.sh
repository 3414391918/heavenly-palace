#!/usr/bin/env bash
# 在 vault 指定路径创建笔记并逐项设置 frontmatter，知识草案应指定 0-临时文件/待审查/ 内的路径。
# 消除 create 到 property:set 循环的三个陷阱：
#   1. 正文与属性分开输入，先写正文再 property:set
#   2. 枚举值必须中文，否则 Base 过滤失效
#   3. aliases 和 tags 若不指定 type 会写成标量，与列表形态不一致
#
# 用法：
#   create_note.sh <vault 相对路径> <正文本地文件|-> [key=value ...]
# 示例：
#   create_note.sh "0-临时文件/待审查/鉴权费用融合.md" body.md \
#     "审查状态=待审查" "来源追溯=2026-07-15 鉴权费用融合方案讨论" \
#     "aliases=鉴权费用融合" "tags=开发文档,鉴权,计费" \
#     "创建时间=2026-07-15 14:00" "修改时间=2026-07-15 14:00"
#
# 两个参数含义不同，切勿混淆：
#   第一个参数是 vault 相对路径（交给 obsidian，.md 后缀可省略，脚本会补齐）。
#   第二个参数是本地文件系统路径（正文源，脚本用 cat 直接读，或 - 从 stdin）。
#   若正文已在 vault 里，先 obsidian read path="..." > /tmp/body.md 导出再传本地路径。
#
# aliases 和 tags 的值可用逗号分隔多项，如 tags=开发文档,鉴权，一次调用传入，
# 逗号分隔会被 CLI 解析为列表项，切勿循环逐项 set（同名 set 是替换非追加，会互相覆盖）。
# 脚本自动为 aliases 和 tags 加 type=list、创建时间和修改时间加 type=datetime、
# 是否完成加 type=checkbox，其余为 text。时间值可写空格或 T 分隔，脚本自动补 T。
# 属性值用中文枚举。全程用 path= 完整路径定位，避免跨目录同名文件被按文件名解析。
# 退出码：0 成功；1 用法错误；2 正文源不可读；3 目标已存在。回读超 2000 字符只回显首末摘要。
set -euo pipefail

# 定位 Obsidian CLI（支持自定义安装目录，不依赖 PATH）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=cli_env.sh
. "$SCRIPT_DIR/cli_env.sh" "${OBSIDIAN_INSTALL_DIR:-}"
OBSIDIAN=ko_cli

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
用法: create_note.sh <vault 相对路径> <正文本地文件|-> [key=value ...]

在 vault 创建笔记并逐项设置 frontmatter。属性自动选 type：
aliases/tags=list（值逗号分隔多项一次传入，勿循环逐项 set，同名 set 是替换）、
创建时间/修改时间=datetime（空格分隔自动补 T）、是否完成=checkbox、其余 text。
所有正文通过 write_note.sh 的本地临时文件可靠路径写入，包括超 6000 字符的中文正文。
目标已存在时拒绝覆盖（create 语义）；需覆盖改用 merge_note.sh。

参数:
  <vault 相对路径>    目标笔记，.md 后缀可省略，脚本自动补齐
  <正文本地文件|->    正文源；vault 内正文先 obsidian read path="..." > /tmp/body.md 导出
  key=value           frontmatter 属性，值用中文枚举（审查状态 等）

示例:
  create_note.sh "0-临时文件/待审查/鉴权费用融合.md" body.md \
    "审查状态=待审查" "来源追溯=2026-07-15 鉴权费用融合方案讨论" \
    "tags=开发文档,鉴权,计费" "创建时间=2026-07-15 14:00"

退出码: 0 成功；1 用法错误；2 正文源不可读；3 目标已存在（改用 merge_note.sh）
写入陷阱详见 references/gotchas.md。
EOF
  exit 0
fi

if [ "$#" -lt 2 ]; then
  echo "用法: create_note.sh <vault 相对路径> <正文本地文件|-> [key=value ...]" >&2
  echo "完整用法与退出码: create_note.sh --help" >&2
  exit 1
fi

ko_init
rel_path="$1"; shift
body_src="$1"; shift
for kv in "$@"; do
  [[ "$kv" == *=* && -n "${kv%%=*}" ]] || { echo '属性必须采用 key=value。' >&2; exit 1; }
done

# vault 路径归一化：property:set/read 用 path= 定位要求带 .md 后缀，统一补齐
case "$rel_path" in
  *.md) doc_path="$rel_path" ;;
  *)    doc_path="$rel_path.md" ;;
esac
ko_validate_path "$doc_path"

# 正文源必须是本地文件或 stdin，绝不是 vault 路径
if [ "$body_src" = "-" ]; then
  tmp_body="$(mktemp /tmp/create_note_body.XXXXXX)"
  trap 'rm -f "$tmp_body"' EXIT
  cat > "$tmp_body"
  body_src="$tmp_body"
  : # 由 write_note.sh 读取原始字节，避免命令替换丢失尾部空行
elif [ -f "$body_src" ]; then
  : # 由 write_note.sh 读取原始字节，避免命令替换丢失尾部空行
else
  echo "错误: 正文源 '$body_src' 不是本地文件。" >&2
  echo "若正文在 vault 里，先 $OBSIDIAN read path=\"...\" > /tmp/body.md 导出再传本地路径。" >&2
  exit 2
fi

# 0. 用独立存在性查询，避免把正文以 Error: 开头的文件误判为不存在。
exists_status=0
ko_file_exists "$doc_path" || exists_status=$?
case "$exists_status" in
  0) echo "错误: $doc_path 已存在；需覆盖请用 merge_note.sh。" >&2; exit 3 ;;
  1) ;; # 不存在，可新建
  *) exit 1 ;;
esac

# 1. 统一使用本地文件写入并验证摘要，不依赖 content= 的长度与转义行为。
# 统一使用编码写入，短正文中的字面量反斜杠和尾部空行也不会被 CLI 转义。
bash "$SCRIPT_DIR/write_note.sh" "$doc_path" "$body_src" --mkdir

# 2. 逐项设置 frontmatter，用 path= 完整路径定位，杜绝跨目录同名歧义
#    按属性名选择正确 type，保证 aliases 和 tags 为列表、时间为 datetime
for kv in "$@"; do
  key="${kv%%=*}"
  val="${kv#*=}"
  case "$key" in
    aliases|tags)
      "$OBSIDIAN" property:set path="$doc_path" name="$key" value="$val" type=list
      ;;
    创建时间|修改时间|提测时间|上线时间)
      "$OBSIDIAN" property:set path="$doc_path" name="$key" value="${val/ /T}" type=datetime
      ;;
    是否完成)
      "$OBSIDIAN" property:set path="$doc_path" name="$key" value="$val" type=checkbox
      ;;
    *)
      "$OBSIDIAN" property:set path="$doc_path" name="$key" value="$val" type=text
      ;;
  esac
done

# 3. 回读确认：长正文只回显首末行摘要（控制上下文占用，frontmatter 在文件头仍可核对）
readback="$("$OBSIDIAN" read path="$doc_path")"
if [ "${#readback}" -le 2000 ]; then
  printf '%s\n' "$readback"
else
  echo "OK: $doc_path 创建成功，回读 ${#readback} 字符（超 2000 仅回显首 15 行与末 5 行）："
  printf '%s\n' "$readback" | awk 'NR<=15'
  echo "……"
  printf '%s\n' "$readback" | tail -n 5
fi
