#!/usr/bin/env bash
# 可靠正文写入：长中文正文经 base64 分块 + eval 全局缓冲累积 + 单次写入 vault。
# 解决 content= 路径的丢字节问题：实测 `obsidian create/append content="..."` 与
# `create_note.sh` 的 `content="$(cat ...)"` 传 30K 字符中文正文时出现 U+FFFD 损坏，
# append 大段内容甚至整段丢失（682 行只剩 239 行）。
#
# 本脚本封装 2026-08-19/08-28 会话实测验证的写入链路：
#   1. 本地正文 base64 编码，按 3000 字符分块（4000 实测出现过累积错位，
#      12000+ 会丢尾部，3000 稳定）
#   2. 逐块 eval 累积到 window.__pfB64，每块回读缓冲区长度与本地累计比对，
#      不匹配立即中止（防半执行）
#   3. 单次 eval 解码（atob + TextDecoder）后 app.vault.adapter.write 整篇写入
#   4. 回读验证：查 U+FFFD 损坏字符、比对非空行与本地稿逐行一致
#
# 属性不由本脚本管理：新文件用 create_note.sh（内部自动路由到本脚本）、
# 覆盖合并用 merge_note.sh，二者会在写入后循环 property:set。
# 单独使用本脚本时需自行补属性。
#
# 用法：
#   write_note.sh <vault 相对路径> <正文本地文件|-> [--mkdir]
# 示例：
#   write_note.sh "0-临时文件/待审查/鉴权费用融合.md" /tmp/body.md
#   write_note.sh "1-动态项目/2026-08-03 积分叠加/积分叠加.md" /tmp/doc.md --mkdir
#
# 两个位置参数含义不同：第一参数是 vault 相对路径（.md 后缀可省略），
# 第二参数是本地文件路径（正文源，或 - 从 stdin 读）。
# --mkdir：目标父目录不存在时先用 app.vault.adapter.mkdir 创建
# （obsidian move 与 vault.create 实测均不建缺失父目录）。
#
# 覆盖语义：adapter.write 直接整篇覆盖目标文件正文并清空 frontmatter，
# 等价于 `obsidian create ... overwrite`。目标文件已存在且需保留属性时，
# 写入后必须逐项 property:set 补回（或直接用 merge_note.sh）。
#
# 正文含反引号、$、| 等特殊字符天然安全：base64 编码后无 shell/JS 特殊字符。
set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
用法: write_note.sh <vault 相对路径> <正文本地文件|-> [--mkdir]

长正文可靠写入：本地正文 base64 编码后按 3000 字符分块，逐块经 obsidian eval
累积到全局缓冲（每块回读长度校验，不匹配即中止），单次解码整篇写入 vault，
最后回读验证无 U+FFFD 损坏且非空行与本地稿逐行一致。
规避 content= 路径传长中文正文的丢字节损坏（实测 30K 正文出现 U+FFFD、整段丢失）。
create_note.sh 与 merge_note.sh 检测正文超 6000 字符会自动调用本脚本。

参数:
  <vault 相对路径>   目标笔记，.md 后缀可省略
  <正文本地文件|->   正文源；vault 内正文先 obsidian read path="..." > /tmp/body.md 导出
  --mkdir            目标父目录不存在时先经 adapter.mkdir 创建
                     （obsidian move 与 create 实测均不建缺失父目录）

注意: 本脚本整篇覆盖目标文件并清空 frontmatter；需保留属性改用 merge_note.sh，
或写入后逐项 property:set 补回。--mkdir 幂等：目录已存在时直接跳过。

示例:
  write_note.sh "1-动态项目/2026-08-03 积分叠加/积分叠加.md" /tmp/doc.md --mkdir

退出码: 0 成功；1 用法错误/正文为空/正文源不可读；2 写入链路失败（eval 校验
不匹配或写入未返回成功标记，目标文件可能未被触碰、也可能被半执行清空，
重跑本脚本即可恢复）；3 回读校验失败（文件已写入但内容与本地稿不一致或
存在损坏字符，应整体重试）
EOF
  exit 0
fi

if [ "$#" -lt 2 ]; then
  echo "用法: write_note.sh <vault 相对路径> <正文本地文件|-> [--mkdir]" >&2
  echo "完整用法与退出码: write_note.sh --help" >&2
  exit 1
fi

rel_path="$1"; shift
body_src="$1"; shift
mkdir_flag=""
if [ "${1:-}" = "--mkdir" ]; then mkdir_flag="yes"; fi

# vault 路径归一化：统一补 .md 后缀
case "$rel_path" in
  *.md) doc_path="$rel_path" ;;
  *)    doc_path="$rel_path.md" ;;
esac

# 正文源必须是本地文件或 stdin，绝不是 vault 路径
if [ "$body_src" = "-" ]; then
  body_file="$(mktemp /tmp/write_note_body.XXXXXX.md)"
  cat > "$body_file"
elif [ -f "$body_src" ]; then
  body_file="$body_src"
else
  echo "错误: 正文源 '$body_src' 不是本地文件。" >&2
  echo "若正文在 vault 里，先 obsidian read path=\"...\" > /tmp/body.md 导出再传本地路径。" >&2
  exit 1
fi

# base64 全量编码（tr 兜底去掉 Linux base64 的换行折行）
b64_file="$(mktemp /tmp/write_note_b64.XXXXXX)"
base64 < "$body_file" | tr -d '\n' > "$b64_file"
total_b64=$(wc -c < "$b64_file" | tr -d ' ')
if [ "$total_b64" -eq 0 ]; then
  echo "错误: 正文为空，拒绝写入。" >&2
  rm -f "$b64_file"
  exit 1
fi

# 可选：建缺失父目录（move 与 vault.create 均不建，实测须显式 mkdir）
if [ -n "$mkdir_flag" ]; then
  parent_dir=$(dirname "$doc_path")
  if [ "$parent_dir" != "." ]; then
    obsidian eval code="(async()=>{const d='$parent_dir';const t=app.vault.getAbstractFileByPath(d);if(t)return 'exists';await app.vault.adapter.mkdir(d);return 'mkdir:'+d;})()" >/dev/null
  fi
fi

# 初始化全局缓冲区（eval 每次调用是独立进程级会话，window 变量跨调用存活）
obsidian eval code="window.__pfB64='';'init'" >/dev/null

# 逐块累积并校验长度：eval 传超长字符串会丢尾部或错位，3000 字符/块实测稳定
parts_dir="$(mktemp -d /tmp/write_note_parts.XXXXXX)"
split -b 3000 "$b64_file" "$parts_dir/part-"

expected=0
for part in "$parts_dir"/part-*; do
  chunk="$(cat "$part")"
  expected=$(( expected + ${#chunk} ))
  out="$(obsidian eval code="window.__pfB64+='$chunk';window.__pfB64.length")"
  # eval 输出形如 "=> 3000"，剥离前缀取数值
  after="${out#*=> }"
  after="${after%%[[:space:]]*}"
  if [ "$after" != "$expected" ]; then
    echo "错误: 第 ${expected} 字符块累积校验失败（eval 缓冲 ${after}，本地 ${expected}），中止写入。" >&2
    rm -rf "$parts_dir" "$b64_file"
    exit 2
  fi
done

# 单次解码写入：atob 得到二进制字符串，TextDecoder 还原 UTF-8，adapter.write 整篇覆盖
out="$(obsidian eval code="(async()=>{const b=atob(window.__pfB64);const t=new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0)));await app.vault.adapter.write('$doc_path',t);window.__pfB64='';return 'written chars='+t.length;})()")"
echo "$out"
if ! echo "$out" | rg -q 'written chars='; then
  echo "错误: 写入调用未返回成功标记。" >&2
  rm -rf "$parts_dir" "$b64_file"
  exit 2
fi

# 回读验证一：全文无 U+FFFD 损坏字符
readback="$(mktemp /tmp/write_note_rb.XXXXXX.md)"
obsidian read path="$doc_path" > "$readback" 2>/dev/null
if LC_ALL=C rg -c $'\xef\xbf\xbd' "$readback" >/dev/null 2>&1; then
  echo "错误: 回读发现 U+FFFD 损坏字符，写入不可靠，请重试。" >&2
  rm -rf "$parts_dir" "$b64_file" "$readback"
  exit 3
fi

# 回读验证二：非空行与本地稿逐行一致（剥离 frontmatter 后比对）
# 注意：本脚本写入会清空 frontmatter，回读首行的 --- 可能是正文自己的水平线
# （无闭合 ---）。必须先确认 frontmatter 真实存在（首行 --- 且至少还有一条 ---），
# 否则按「剥到闭合 ---」会把全文吞掉，校验必然误报「写入不完整」
stripped="$(mktemp /tmp/write_note_stripped.XXXXXX.md)"
if [ "$(sed -n '1p' "$readback")" = "---" ] && [ "$(rg -c '^---$' "$readback" || echo 0)" -ge 2 ]; then
  awk 'NR==1{fm=1;next} fm&&/^---$/{fm=0;next} !fm' "$readback" > "$stripped"
else
  cp "$readback" "$stripped"
fi
if ! diff <(rg -v '^[[:space:]]*$' "$body_file") <(rg -v '^[[:space:]]*$' "$stripped") >/dev/null; then
  echo "错误: 回读正文与本地稿不一致，写入不完整。" >&2
  rm -rf "$parts_dir" "$b64_file" "$readback" "$stripped"
  exit 3
fi

echo "OK: $doc_path 写入并校验通过（base64 ${total_b64} 字符，正文与本地稿逐行一致，无损坏字符）。"
rm -rf "$parts_dir" "$b64_file" "$readback" "$stripped"
