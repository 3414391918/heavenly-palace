#!/usr/bin/env bash
# 增量更新合并：用补丁正文整篇覆盖已有文档，并补回全部 frontmatter。
# 对称于 create_note.sh，专用于工作流 3 增量更新的合并步骤。
#
# 为什么需要：obsidian create ... overwrite 只写正文、会清空原有全部属性，
# 覆盖后必须逐项 property:set 补回，属性多时要连发多条，开销大且易漏。
# 本脚本把 overwrite 加循环 property:set 封装成一次调用。
#
# 何时用本脚本，何时用 append：
#   整篇重写（补丁正文是完整新版本）用本脚本。
#   局部增补（只在文末追加片段）用 obsidian append，不触碰属性，开销更小。
#
# 用法：
#   merge_note.sh <原文 vault 相对路径> <补丁正文本地文件|-> [key=value ...]
# 示例：
#   # 先把 vault 里的补丁草案导出到本地，再合并（正文源必须是本地文件）
#   obsidian read path="0-临时文件/待审查/PrizePauseBiz 优化.md" > /tmp/patch_v4.md
#   merge_note.sh "1-动态项目/2026-07-15 PrizePauseBiz/PrizePauseBiz 优化" /tmp/patch_v4.md \
#     "审查状态=已确认" "aliases=PrizePauseBiz 优化" \
#     "tags=开发文档,方案设计" "修改时间=2026-07-15 15:00"
#
# 两个参数含义不同，切勿混淆：
#   第一个参数是 vault 相对路径（要被覆盖的原文，交给 obsidian，.md 后缀可省略）。
#   第二个参数是本地文件系统路径（补丁正文，脚本用 cat 直接读，或 - 从 stdin）。
#   补丁草案在 vault 里时，务必先 obsidian read path="..." > /tmp/patch.md 导出，
#   把 /tmp/patch.md 作第二参数；直接把 vault 路径当第二参数会 cat 报 No such file。
#
# 正文含反引号、$、| 等特殊字符时，传文件路径即可安全中转（由 CLI eval 读取本次临时文件）。
# aliases 和 tags 的值可用逗号分隔多项；脚本自动为其加 type=list、
# 创建时间和修改时间加 type=datetime、是否完成加 type=checkbox，其余为 text。
# 属性值用中文枚举。合并后请自行 delete 补丁草案并 append 记 log（动作填 更新）。
# 全程用 path= 完整路径定位，避免跨目录同名文件被 file= 按文件名解析写错笔记。
# 退出码：0 成功；1 用法错误；2 补丁正文源不可读；3 原文不存在（转 create_note.sh 新建）。
# 回读超 2000 字符只回显首末摘要。
set -euo pipefail

# 定位 Obsidian CLI（支持自定义安装目录，不依赖 PATH）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=cli_env.sh
. "$SCRIPT_DIR/cli_env.sh" "${OBSIDIAN_INSTALL_DIR:-}"
OBSIDIAN=ko_cli

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
用法: merge_note.sh <原文 vault 相对路径> <补丁正文本地文件|-> [key=value ...]

增量更新的合并步骤：用补丁正文整篇覆盖原文，并逐项补回全部 frontmatter
（直接 create overwrite 会清空属性，本脚本封装 overwrite 加属性循环）。
属性 type 与 create_note.sh 一致：aliases/tags=list、创建时间/修改时间=datetime、
是否完成=checkbox、其余 text。所有正文通过 write_note.sh 读取本地临时文件写入并验证摘要。
整篇重写用本脚本；只在文末追加片段用 obsidian append（不触碰属性，开销更小）。

参数:
  <原文 vault 相对路径>  被覆盖的目标笔记，.md 后缀可省略
  <补丁正文本地文件|->   补丁正文源；vault 里的补丁草案先
                         obsidian read path="..." > /tmp/patch.md 导出再传本地路径
  key=value              需补回的 frontmatter 属性，须列全（含审查状态、时间、
                         aliases、tags），漏传即漏属性

示例:
  "$OBSIDIAN" read path="0-临时文件/待审查/PrizePauseBiz 优化.md" > /tmp/patch.md
  merge_note.sh "1-动态项目/2026-07-15 PrizePauseBiz/PrizePauseBiz 优化.md" /tmp/patch.md \
    "审查状态=已确认" "tags=开发文档,方案设计" "修改时间=2026-07-15 15:00"

退出码: 0 成功；1 用法错误；2 补丁正文源不可读；3 原文不存在（新建改用 create_note.sh）
合并后自行 delete 补丁草案并 append 记 log（动作填 更新）。写入陷阱见 references/gotchas.md。
EOF
  exit 0
fi

if [ "$#" -lt 2 ]; then
  echo "用法: merge_note.sh <原文 vault 相对路径> <补丁正文本地文件|-> [key=value ...]" >&2
  echo "完整用法与退出码: merge_note.sh --help" >&2
  exit 1
fi

ko_init
rel_path="$1"; shift
body_src="$1"; shift
for kv in "$@"; do
  [[ "$kv" == *=* && -n "${kv%%=*}" ]] || { echo '属性必须采用 key=value。' >&2; exit 1; }
done

# vault 路径归一化：obsidian path= 定位 property:set/read 时要求带 .md 后缀，
# create path= 虽自动补但补属性阶段不补会 file not found，故统一补齐。
case "$rel_path" in
  *.md) doc_path="$rel_path" ;;
  *)    doc_path="$rel_path.md" ;;
esac
ko_validate_path "$doc_path"

# 补丁正文源必须是本地文件或 stdin，绝不是 vault 路径
if [ "$body_src" = "-" ]; then
  tmp_body="$(mktemp /tmp/merge_note_body.XXXXXX)"
  trap 'rm -f "$tmp_body"' EXIT
  cat > "$tmp_body"
  body_src="$tmp_body"
  : # 由 write_note.sh 读取原始字节，避免命令替换丢失尾部空行
elif [ -f "$body_src" ]; then
  : # 由 write_note.sh 读取原始字节，避免命令替换丢失尾部空行
else
  echo "错误: 补丁正文 '$body_src' 不是本地文件。" >&2
  echo "若补丁草案在 vault 里，先 obsidian read path=\"...\" > /tmp/patch.md 导出再传本地路径。" >&2
  exit 2
fi

# 0. 只有确认原文存在才允许覆盖；CLI 失败不能被当作存在。
exists_status=0
ko_file_exists "$doc_path" || exists_status=$?
case "$exists_status" in
  0) ;; # 已存在，可更新
  1) echo "错误: $doc_path 不存在；新建请用 create_note.sh。" >&2; exit 3 ;;
  *) exit 1 ;;
esac

# 1. 用补丁正文整篇覆盖原文，content 只含正文，overwrite 会清空原属性
#    长正文走 write_note.sh 的本地文件 eval 路径（实测 content= 传长中文正文丢字节）
# 与新建保持同一条可靠正文写入链路，保留尾部空行及字面转义字符。
bash "$SCRIPT_DIR/write_note.sh" "$doc_path" "$body_src"

# 2. 逐项补回 frontmatter，按属性名选正确 type，与 create_note.sh 一致
#    用 path= 完整路径而非 file= 文件名，杜绝跨目录同名歧义
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

# 3. 回读确认合并结果：长正文只回显首末行摘要（控制上下文占用）
readback="$("$OBSIDIAN" read path="$doc_path")"
if [ "${#readback}" -le 2000 ]; then
  printf '%s\n' "$readback"
else
  echo "OK: $doc_path 合并成功，回读 ${#readback} 字符（超 2000 仅回显首 15 行与末 5 行）："
  printf '%s\n' "$readback" | awk 'NR<=15'
  echo "……"
  printf '%s\n' "$readback" | tail -n 5
fi
