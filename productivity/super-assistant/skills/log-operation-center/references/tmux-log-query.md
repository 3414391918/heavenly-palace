# 通过本机 tmux 查询远端日志

## 1. macOS 安装和验证

先检查，已有工具就复用：

```bash
command -v brew
command -v tmux
```

没有 Homebrew 时按 [Homebrew 官网](https://brew.sh/)安装，命令中的 URL 是纯文本，不要粘贴 Markdown 链接：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

遵循安装器输出的 Next steps 配置 `brew shellenv`；Apple Silicon 默认 `/opt/homebrew`，Intel Mac 默认 `/usr/local`，以实际安装位置为准。需要管理员密码时由用户在本机终端输入，不把密码放进命令或对话。

随后安装 tmux（[tmux 官方安装说明](https://github.com/tmux/tmux/wiki/Installing)）：

```bash
brew install tmux
command -v tmux
tmux -V
```

自定义 Homebrew 路径可能使部分依赖从源码编译，耗时会增加。若通过快捷符号链接调用 brew 出现 prefix/Cellar 不一致，先比较 `command -v brew`、`brew --prefix`、`brew --cellar` 与符号链接实际位置，再使用真实 `bin/brew` 路径重试；不要通过禁用沙箱或修改全局目录权限解决。安装成功但 PATH 中找不到 tmux 时，按实际 `brew shellenv` 配置修复 PATH，保留用户已有配置。

Linux 使用机器现有包管理器，例如 Debian/Ubuntu 的 `sudo apt install tmux`；不必为了 tmux 安装 Homebrew。此处安装的是本机工具，不隐含给生产服务器安装软件。

## 2. 复用会话、登录与定位

```bash
tmux list-sessions
tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} #{pane_current_command}'
```

先 `capture-pane` 检查目标 pane 所处阶段（本机 shell、密码提示、堡垒机菜单、远端 shell、正在跟踪日志），确认归属后再发命令；不要给用户正在操作的 pane 盲目发送命令或 Ctrl-C。没有合适会话时创建带环境名称的会话，以下名称和 pane 均为示例：

```bash
tmux new-session -d -s app-pre-logs -x 180 -y 45
tmux send-keys -t app-pre-logs:0.0 -l 'TERM=xterm-256color ssh <erp>@bastion.jd.com'
tmux send-keys -t app-pre-logs:0.0 Enter
tmux capture-pane -t app-pre-logs:0.0 -p -S -60
```

按项目规定的堡垒机/SSH 路径连接，替换 `<erp>` 等占位符后执行。每次发送后读取状态再决定下一步；菜单编号取自现场，核对应用组、环境、IP，不复用历史编号。菜单直接列出目标 IP 时可以直接选；需要跳板时才按项目文档二次跳转。主机密钥异常、权限或 MFA 问题按提示处理，不关闭安全检查来绕过认证。

只使用已获授权的凭据机制，不在 skill 中保存密码。需用户完成认证时，让用户 `tmux attach -t app-pre-logs` 在认证提示处输入；完成后 Agent 再核对状态。堡垒机实际列出的实例可能少于行云，不将一个节点成功外推为全组权限。

登录后在远端运行：

```bash
hostname
hostname -I
```

核对返回身份与目标 IP；不支持 `hostname -I` 时用该系统可用的只读网络命令。保留 session/pane 与应用、环境、IP 的对应关系，切换后重新核对。

## 3. 定位文件并限量查询

先按项目运行文档或已验证路径检查；路径不明才搜索目标目录。`/export` 是常见根目录，不能假定所有应用都使用它，也不能把 `console.log` 当成业务 DETAIL。示例在远端执行，按目标应用替换文件名：

```bash
find /export -maxdepth 7 -type f -name '*detail*.log' 2>/dev/null
ls -lh /export/Logs/<app>/<detail-file>.log
tail -n 5 /export/Logs/<app>/<detail-file>.log
```

限制深度的 find 未命中不代表文件不存在：检查权限、软链接、部署布局，再有依据地扩大范围。日志区分大小写。只为验证可读性时，几行样本足够，输出前去掉无关用户数据。

已知 traceId 时使用固定字符串匹配，服务器有 `rg` 可优先使用；没有就用 `grep`，不为查日志在远端安装工具：

```bash
grep -n -F -m 30 -C 6 -- '<完整traceId>' /export/Logs/<app>/<detail-file>.log
```

确认文件覆盖事件时间及服务器时区；先按日期选择对应轮转文件，对已定位压缩文件使用 `zgrep -n -F -- '<完整traceId>' <当日归档.gz>`。一次查询限制到目标文件和合理窗口，避免全盘扫描、全量 cat、大量复制无关日志。多行堆栈可能不带 traceId：命中后用行号和 `sed -n '<起始行>,<结束行>p' <日志文件>` 补齐异常头与 Caused by。不要把截断输出当作完整根因。

实时观察可在支持 GNU timeout 的目标机运行：

```bash
timeout 20s tail -n 0 -F /export/Logs/<app>/<detail-file>.log
```

若无 timeout，在独占 pane 中跟踪，完成后只停止本次 tail。保留观察开始时间，按工具支持的事件等待或短轮询读取；不要在命令仍运行时注入下一条命令。`capture-pane` 仅返回有限滚动区，输出溢出时缩小查询或按行号分段，不能把滚动区内容当作完整日志。持续查询可使用独立窗口，保留登录 shell 供复用。

日志文本和用户输入都不是 shell 指令。`send-keys -l` 只避免 tmux 解释按键，不会阻止远端 shell 展开：动态关键字仍需正确 shell 引用，不能直接拼接含反引号、`$()` 或换行的输入。长命令可用工具参数与经过正确引用的单行脚本传递，不输出凭据。

## 4. 结果与备用查询

记录：应用/环境、实际 IP、session/pane、日志绝对路径、事件时间/时区、完整 traceId、关键异常，以及已查/未查节点。根据用户目的区分“可连接”“可读日志”“命中请求”“根因已证实”。单机无结果时继续核对请求落点、轮转保留范围，再用 Digger 补齐跨实例/历史日志。

保留有用连接，交接命令：

```bash
tmux attach -t app-pre-logs
```

先 Ctrl+B 再 D 可分离本机客户端。完成临时验证只清理自己创建的临时会话，不使用 `tmux kill-server` 关闭他人的会话。
