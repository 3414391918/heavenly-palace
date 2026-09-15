# CodeGraph 安装、MCP 配置与索引构建

## 执行顺序

每次分析开始时，以及每发现一个新的目标应用时，按以下顺序检查：

1. Agent 是否已经能调用 CodeGraph MCP 工具。
2. 本机是否能执行 `codegraph` CLI。
3. 当前应用根目录下的 `.codegraph/` 是否存在且对应当前代码版本。
4. 索引不可用时先安装或重建，再开始该应用的调用链分析。

## 安装 CodeGraph CLI

检查 CLI：

```bash
command -v codegraph
codegraph --version
```

### NVM 与非交互 shell

`codegraph` 的全局安装目录和 `node` 可能都在 NVM 版本目录中。全局命令即使能用绝对路径找到，其首行常为 `#!/usr/bin/env node`；若 Agent 的非交互 shell 没有加载 NVM，直接执行会报：

```text
env: node: No such file or directory
```

因此发现 CLI 后，必须在同一个执行环境检查：

```bash
command -v codegraph
command -v node
node --version
codegraph --version
```

如果 `codegraph` 位于 `/absolute/.nvm/versions/node/<version>/bin` 且 `node` 缺失，只对**当前条** CodeGraph 命令补充该目录：

```bash
PATH=/absolute/.nvm/versions/node/<version>/bin:$PATH codegraph --version
PATH=/absolute/.nvm/versions/node/<version>/bin:$PATH codegraph explore "<query>"
```

先确认这两条命令成功，再运行 `init -i` 或 `explore`。不要修改 `~/.zshrc`、NVM 默认版本、系统软链接或用户的交互终端配置；它们不是 Agent `PATH` 缺失的修复手段。报告中记录 Node 绝对目录、`node --version` 和 `codegraph --version` 的结果，便于复现。

如果 Agent 既不能调用 CodeGraph MCP，也不能执行 `codegraph` 命令，必须提醒用户安装 CodeGraph：

```bash
npm i -g @colbymchenry/codegraph
```

不要把“工具不存在”当作“项目没有调用关系”，也不要静默跳过 CodeGraph。用户完成安装后，重新检查命令是否可用。

## 安装 CodeGraph MCP

### Claude Code、Codex、OpenCode、Cursor

用户使用的 Agent 是 Claude Code、Codex、OpenCode 或 Cursor 时，使用下面的命令安装/配置 MCP 工具：

```bash
npx @colbymchenry/codegraph
```

执行完成后重新加载或重启对应 Agent，使 MCP 配置生效，再确认 CodeGraph 工具已经出现在可用工具列表中。

### 其他 Agent

其他支持 MCP 的 Agent 直接加入以下 JSON 配置：

```json
{
  "mcpServers": {
    "codegraph": {
      "type": "stdio",
      "command": "codegraph",
      "args": ["serve", "--mcp"]
    }
  }
}
```

JSON 的具体保存位置由 Agent/MCP 客户端决定。配置后重新加载客户端，并确认它能启动 `codegraph serve --mcp`。

MCP 暂时不可用但 CLI 可用时，不需要阻塞：在应用根目录通过 `codegraph explore` 执行同样的源码图查询。MCP 和 CLI 都不可用时，提醒用户完成安装，不要声称已经完成代码图分析。

## 构建或重建代码知识图谱

在**每个待分析应用的根目录**检查 `.codegraph/`。满足任一条件时必须重新构建：

- 应用根目录不存在 `.codegraph/`。
- 应用切换过 Git 分支。
- 当前分支代码执行过 Git 更新，例如 pull、merge、rebase 或其他使源码版本变化的操作。

进入应用根目录执行：

```bash
codegraph init -i
```

跨应用调用链涉及多个应用时，每个应用都有独立的源码和索引状态；不能因为入口应用已有 `.codegraph/`，就跳过目标应用的检查。

无法确认现有索引是否对应当前分支/当前代码时，按过期处理并重新执行 `codegraph init -i`。构建完成后确认应用根目录已生成 `.codegraph/`，再开始查询。

## 使用 CodeGraph

优先使用 Agent 已连接的 CodeGraph MCP 工具，并为查询指定目标项目的绝对路径。MCP 工具不可用但 CLI 可用时，进入目标应用根目录运行：

```bash
codegraph explore "<精确方法签名以及只查询直接 callers/callees 的问题>"
```

每个查询只处理一个规范方法的一跳上游或下游关系。详细查询提示、源码核验和兜底搜索规则见主流程加载的“工具协同与单跳取证”指南。

## 失败处理

以下情况必须暂停该应用的 CodeGraph 分析并向用户说明：

- npm 或全局命令安装失败。
- Agent 无法加载 MCP，且 CLI 也不可用。
- `codegraph init -i` 构建失败。
- 应用根目录、分支或 Git 更新状态无法确认。

说明失败命令、应用绝对路径和错误摘要，并请用户安装工具、修复构建或确认代码状态。可以用源码搜索收集候选线索，但必须在会话中保留 unresolved/block；索引恢复并完成验证前，最终文档保持 `INCOMPLETE`。
