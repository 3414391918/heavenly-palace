#!/usr/bin/env bash
# 通过 CLI eval 读取本次本地临时正文；路径编码，中文、空格、引号不进入 JS 源码。
# 写后比较原始 UTF-8 字节的 SHA-256，保留空行、尾部换行和字面量反斜杠。
set -euo pipefail
if [[ "${1:-}" == --help || "${1:-}" == -h ]]; then
  cat <<'EOF'
用法: bash write_note.sh <vault 相对路径> <正文本地文件|-> [--mkdir]
CLI eval 读取本次本地临时正文，仅路径经 base64 编码，写后校验 SHA-256。
默认操作同一 Skill 下的 knowledgebases；可设置 OBSIDIAN_CLI、OBSIDIAN_VAULT_PATH。
--mkdir 创建缺失父目录。此命令覆盖整篇文件（包括原有属性）；有属性的更新请用
merge_note.sh 并传入全部属性。退出码：0 成功；1 输入/环境错误；2 写入失败；3 校验失败。
EOF
  exit 0
fi
[[ $# -ge 2 && $# -le 3 ]] || { echo '参数错误，参见 --help。' >&2; exit 1; }
[[ -z "${3:-}" || "$3" == --mkdir ]] || { echo '未知选项。' >&2; exit 1; }
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/cli_env.sh"
ko_init
doc_path="$1"
[[ "$doc_path" == *.md ]] || doc_path="$doc_path.md"
ko_validate_path "$doc_path"
work="$(mktemp -d "${TMPDIR:-/tmp}/knowledge-write.XXXXXX")"
trap 'rm -rf "$work"' EXIT
# 先在本机临时目录准备正文；失败时原始输入仍可用于重试。
if [[ "$2" == - ]]; then
  cat > "$work/body"
else
  [[ -r "$2" ]] || { echo '正文源不是可读的本地文件。' >&2; exit 1; }
  cp "$2" "$work/body"
fi
[[ -s "$work/body" ]] || { echo '正文为空，拒绝覆盖。' >&2; exit 1; }
if command -v shasum >/dev/null 2>&1; then
  digest="$(shasum -a 256 "$work/body")"
else
  digest="$(sha256sum "$work/body")"
fi
digest="${digest%% *}"
path64="$(printf '%s' "$doc_path" | base64 | tr -d '\r\n')"
path_js="new TextDecoder().decode(Uint8Array.from(atob('$path64'),c=>c.charCodeAt(0)))"
source_path="$work/body"
if command -v cygpath >/dev/null 2>&1; then source_path="$(cygpath -w "$source_path")"; fi
source64="$(printf '%s' "$source_path" | base64 | tr -d '\r\n')"
source_js="new TextDecoder().decode(Uint8Array.from(atob('$source64'),c=>c.charCodeAt(0)))"
mkdir_js=''
if [[ "${3:-}" == --mkdir ]]; then
  mkdir_js="let d='';for(const s of p.split('/').slice(0,-1)){d=d?d+'/'+s:s;if(!await app.vault.adapter.exists(d))await app.vault.createFolder(d);}"
fi
# 官方 CLI eval 在桌面应用读取本次临时文件；命令只携带编码后的路径，不携带长正文。
# create/modify 使用 Vault API，更新文件的同时通知索引；正文不受 CLI 转义和参数长度影响。
out="$(ko_cli eval code="(async()=>{const p=$path_js;const bytes=require('fs').readFileSync($source_js);const t=new TextDecoder('utf-8',{fatal:true}).decode(bytes);$mkdir_js const f=app.vault.getAbstractFileByPath(p);if(f)await app.vault.modify(f,t);else await app.vault.create(p,t);const r=await app.vault.adapter.read(p);return require('crypto').createHash('sha256').update(r,'utf8').digest('hex');})()")"
actual="${out#*=> }"
actual="${actual%$'\r'}"
[[ "$actual" == "$digest" ]] || { echo '文件已写入，但回读摘要不符，请用原始输入重试。' >&2; exit 3; }
printf 'OK: %s，UTF-8 SHA-256 校验通过。\n' "$doc_path"
