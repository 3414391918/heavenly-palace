# 陷阱与实测纠正

本文件保留原知识库工作流的 CLI 实测记录。命令行为可能随版本变化，以当前 `obsidian help` 和回读结果为准，不把历史现象当作所有版本的固定限制。遇到搜索、文件创建、属性写入或移动问题时加载；脚本不可用需手动分步操作时也加载本文件。

## 搜索

- 全文与上下文搜索：`obsidian search` 按关键词和查询条件搜索笔记，`obsidian search:context` 返回匹配的正文上下文片段。需确认内容相关性时用后者。
- 地图优先：先用 Base 视图或 search 获取候选清单再读正文，不要为找相关性通读整库，见 [主入口](../SKILL.md) 的内容整理原则 3。

## 文件创建

- 多行内容转义：CLI 中 `\n` 表换行、`\t` 表制表。长文档建议先 create 再分段 `append`，而非一次性塞进 content。
- 长正文含特殊字符先落临时文件再中转：正文含反引号、`$`、`|`、`&` 等 shell 会解释的字符时（技术方案、含代码块的文档几乎必然如此），直接 `content="..."` 会被 shell 展开导致内容损坏或命令截断。安全做法是先写临时文件，heredoc 用带引号的定界符 `<<'EOF'` 关闭变量插值，再用命令替换传入：

  ```bash
  cat > /tmp/note_body.md <<'EOF'
  正文可自由包含 `反引号`、$VAR、| 管道符 等字符，不会被解释。
  EOF
  obsidian create path="0-临时文件/待审查/xxx.md" content="$(cat /tmp/note_body.md)" silent
  ```

  create_note.sh 已内置此模式：正文参数传文件路径或 `-`（从 stdin 读），脚本内部 `content="$(cat ...)"`。注意此模式只解决 shell 展开问题，不解决长文丢字节；超 6000 字符正文脚本会自动改走 write_note.sh 的 base64 路径，见下节。

## 手动分步命令

脚本不可用时的分步等价命令（属性逐项补全，勿漏；正常情况优先用 create_note.sh）：

```bash
obsidian search query="鉴权费用融合" limit=5        # 先查重
obsidian template:read name="开发文档模板" resolve   # 取模板正文，名带 模板 后缀
obsidian create path="0-临时文件/待审查/鉴权费用融合.md" content="<正文>" silent
obsidian property:set path="0-临时文件/待审查/鉴权费用融合.md" name="审查状态" value="待审查"
obsidian read path="0-临时文件/待审查/鉴权费用融合.md" && obsidian append file="操作日志" content="<日志行>"
```
- create 用 path，property:set / read 定位优先用 path 而非 file：`create path="目录/文件.md"` 指定完整路径；`property:set path="目录/文件.md" name="属性名" value="值"`，属性键是 name 不是 key。`file="标题"` 按文件名（basename）解析，vault 存在跨目录同名文件时会命中错误笔记、把属性写错地方，故写入定位一律用 `path=` 完整路径（注意 `path=` 必须带 `.md` 后缀，`create path=` 会自动补但 `property:set`/`read path=` 不补）。优先用 scripts/create_note.sh 与 merge_note.sh，二者已统一用 path= 归一化后缀，避免记错。

## 长正文写入丢字节（最严重陷阱）

2026-08-19 写入 30K 字符中文开发文档时实测，heredoc 中转 `content="$(cat ...)"` 并不能避免该问题：

- `content=` 传长中文正文丢字节：写入后正文出现 U+FFFD 损坏字符（UTF-8 多字节序列被破坏）。merge_note.sh 的 `$(cat ...)` 路径同样存在此问题，4 处损坏。
- `append` 大段内容丢内容：682 行文档分两段 append 后只剩 239 行，整块丢失。短内容（几行）则完全正常。
- 可靠路径是 base64 分块 + eval 全局缓冲 + 单次写入，已封装为 [scripts/write_note.sh](../scripts/write_note.sh)，create_note.sh / merge_note.sh 对超 6000 字符正文自动路由：
  1. 本地正文 base64 编码，按 3000 字符分块：4000 字符块实测出现累积错位（eval 缓冲与本地差 44 字符，atob 报 InvalidCharacterError），超过 12000 字符会丢尾部，3000 稳定。
  2. 逐块 `obsidian eval code="window.__pfB64+='<块>'"` 累积，每块回读缓冲长度与本地累计比对，不匹配立即中止；eval 半执行不报错，靠校验兜底。
  3. 单次 eval `atob` + `TextDecoder` 解码后 `app.vault.adapter.write` 整篇写入。
  4. 回读验证三元组：`LC_ALL=C rg -c $'\xef\xbf\xbd'` 查损坏字符、比对非空行与本地稿 diff、必要时延时 1 秒复查（CLI 写入有竞态窗口，eval 直写未见）。
- `obsidian eval` 参数名是 `code=`：写 `expression=` 报 Missing required parameter。eval 输出形如 `=> 3000`，脚本里剥前缀取值。
- 写入后疑似乱码先客观判断：终端显示乱码不等于文件损坏（会话中终端 mojibake 但 diff 仅改动行有差异，文件本身完好）。用字节级 rg U+FFFD 与 diff 判断，勿凭显示重写。
- 中间文本处理用 perl 必须加 `-CSD`（UTF-8 层），否则原地改写会把中文写坏成 mojibake，只能从原始副本重来。

## 文件创建（补充）

- `move` 与 eval 内 `app.vault.adapter.create`（vault.create）均不自动创建缺失父目录（2026-08-28 实测）：目录缺失时先 `app.vault.adapter.mkdir()` 再写入，write_note.sh 的 `--mkdir` 已封装。
- datetime 值必须带 T：`type=datetime` 值写 `2026-07-14T19:20`；用空格写 `2026-07-14 19:20` 会报 Invalid datetime format 且字段不写入。脚本自动把空格转 T。
- list 多值一次写入：`property:set name="tags" value="a,b" type=list` 一次调用生成两项；同名属性重复 set 是替换而非追加，循环逐项写只会留下最后一个。CLI 无 property:append。
- 模板占位与枚举串必须覆盖：用 `template=` 创建后，`审查状态` 会是字面串 `待审查|已确认|需重构|已归档`、`aliases` 是 `{{title}}` 占位，必须用 property:set 覆盖成真实单值，否则击穿 Base 过滤。
- `create ... overwrite` 会清空 frontmatter：用 overwrite 覆盖已有文件时 content 只含正文，原有全部属性被抹掉。这不阻止用 overwrite，覆盖后用 `property:set` 补回所有属性即可，包括审查状态、时间、类型枚举、aliases、tags，并更新 修改时间。属性多时需连发多条 `property:set`，开销大，优先用 [scripts/merge_note.sh](../scripts/merge_note.sh) 封装 overwrite 加循环 property:set，与 create_note.sh 对称。小改动也可用逐段 `append` 避免整体覆盖，省掉补属性这一步；合并补丁时按改动量选择：整篇重写用 merge_note.sh，局部增补用 append。
- delete 是移入 trash：`obsidian delete` 移到回收站可恢复，仅用于清理 AI 自建的临时草案；知识文档一律走归档流程，见 [主入口](../SKILL.md) 的操作边界 4。
- `obsidian read` 对不存在的文件也返回退出码 0（2026-08-31 实测）：错误信息只出现在输出流（stdout/stderr 均有），退出码不可作为存在性依据。判断笔记是否存在须看输出是否以 `Error:` 开头；create_note.sh 曾按退出码探测，导致对任何路径（含从未创建过的）恒报「已存在」拒绝创建，已修复为按输出前缀判断。脚本不可用手动探测时同样注意。
- `property:set` 连发可能中途挂起（2026-08-31 实测）：逐项链式设置 13 个属性，第 8 条起卡死 2 分钟超时且无任何报错输出。批量设置后必须回读 frontmatter 核对缺了哪几项再补设，不能假设链上命令全部执行完。
- `append` 的参数名是 `content=` 不是 `text=`：写 `text=` 报 `Unexpected token` 失败，脚本与文档示例均用 `content=`，手动分步操作时勿改参数名。
- `提测时间`/`上线时间` 是 datetime 类型（值带 T，如 `2026-09-02T00:00`）：frontmatter-spec 的类型速查已列明，手动补设属性时易误写成 `type=text`，写错类型不报错但属性形态错乱，回读核对时一并检查。

## 文件移动

- move 不会创建缺失的父目录：`obsidian move to="4-历史归档/2026-06-08 新项目/x.md"` 若 `2026-06-08 新项目/` 不存在会失败。变通做法是先 `obsidian create path="目标目录/x.md"`，create 会自动建目录，写好正文与属性，核验完整副本并确认引用关系后，再在已授权移动范围内清理源文件。复制加删除不会自动等同于保留全部链接的重命名；优先补建目录后使用 `move`，任何方案都须验证链接。
- CLI 无删除文件夹命令：`obsidian help` 里没有 rmdir 或 folder:delete。归档移动后源目录会残留空文件夹。清理用 `obsidian eval` 调 vault adapter，且必须先确认目录为空再删：

  ```bash
  obsidian eval code="(async()=>{const p='1-动态项目/旧目录';const f=app.vault.getAbstractFileByPath(p);if(!f)return 'NOT_FOUND';if(f.children&&f.children.length!==0)return 'NOT_EMPTY:'+f.children.length;await app.vault.adapter.rmdir(p,false);return 'REMOVED';})()"
  ```

  非空目录返回 NOT_EMPTY 并保护性中止，绝不递归强删。
- 移动后必查断链：`obsidian move` 或 create 加 delete 变通后，务必 `obsidian unresolved`，否则 wikilink 断裂难以察觉。
- 用户手动移动后，旧路径可能失效：重新搜索定位目标，再继续操作；AI 执行的移动按 [主入口](../SKILL.md) 的归位流程记录日志。
