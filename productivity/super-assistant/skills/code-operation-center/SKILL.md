---
name: code-operation-center
description: 在任何需要阅读代码的场景使用这个skill，从精确入口方法出发，分析 Java 代码在单应用及多个应用之间的上游与下游调用图，并生成带逐边证据、覆盖率、跨应用闭环、状态变更账本、未决项和用户确认记录的 AI 可读文档。适用于单入口或多入口调用链、RPC/HTTP/MQ 跨服务链路、ApiImpl 上游识别、持久层下游追踪、业务状态机与执行时序判断、影响面分析；当用户要求分析调用链、调用方、被调方、跨应用链路或代码上下游时使用。
---

# 跨应用代码链路分析

## 目标与完成标准

把用户给出的入口方法分析为一个**有向图**，同时覆盖：

- 下游：入口调用的全部项目内分支、动态分派目标、跨应用调用及最终 DB/缓存/消息/第三方边界。
- 上游：入口的全部调用方、各应用入口、跨应用消费者，直到用户确认已经到达业务最上层。
- 证据：每条边都有精确方法签名、调用点和发现依据；猜测不能混入已确认链路。
- 完整性：所有节点在每个分析方向上必须是 `expanded`、`terminal` 或经用户处理的状态；存在 `pending`、`in_progress`、`unresolved`、`deferred` 时不得声称“完整”。

“全部调用链”限定为：用户指定工作区内的项目自有代码，以及能由配置或代码证据解析到的跨应用边。JDK、第三方库、数据库、缓存及无法取得源码的外部系统记录为边界，不继续展开。

## 必须遵守的原则

1. 把调用关系当作有环有共享子图的图，不当作可一次生成的树。
2. 使用完整方法身份：`应用::全限定类名#方法名(参数类型):返回类型`。禁止只用类简称或方法名合并节点。
3. 每次只发现并验证一个节点的**直接一跳**邻居，再写入持久化会话；禁止一次让工具递归生成整棵图。
4. CodeGraph 是有索引项目的首选事实来源。对每个进入调用图的应用检查并构建当前代码版本的 `.codegraph/` 索引，再使用 CodeGraph 分析。
5. 搜不到不等于不存在。目标应用、RPC 提供者、上游消费者或顶层入口不确定时，必须把候选与证据展示给用户确认。
6. 不因分支多而采样、只保留“主链路”或静默裁剪。超出预算时保存会话与剩余前沿，向用户申请扩大预算或工作区。
7. 区分“代码定位”和“链路分析”：只回答代码位置时可不建完整会话；一旦用户要求调用链、跨应用逻辑、影响面、状态或时序，就必须进入链路模式。链路模式没有持久化会话，就视为尚未执行 code-operation-center，禁止用若干次 CodeGraph explore 或源码阅读冒充完整执行。
8. 在分析任何入口前强制盘点工作区。只要 Provider、Listener 或目标实现存在于用户工作区，就不能因“中台”“外部”“其他系统”等模糊业务用语把它截断；只有用户明确排除某个应用或源码确实不可得，才能记为边界。
9. 每个 RPC、HTTP、MQ、SPI、字符串路由或异步事件都必须产生一项“跨应用待办”。待办未形成契约、实现、注册三类证据的闭环，也未被 block 为 unresolved 时，当前节点不得标记 `expanded`。
10. 在所有会修改业务状态的应用完成“状态变更账本”前，禁止推导“先发生什么、后发生什么”“是否支持退款”“是否幂等”等业务结论。不同应用的同名状态必须带应用前缀和实际 code，不能按中文名称直接等同。
11. 用户限制最终交付文件数量，不等于允许跳过会话、清单或校验。内部分析产物可放临时工作目录，最终按用户要求嵌入或压缩到指定文档中。
12. 先闭合调用图，再撰写业务指南。不得边搜索边提前形成结论，再用后续证据补叙述。

## 开始前加载指南

按以下顺序完整阅读：

1. [CodeGraph 安装、MCP 配置与索引构建](templates/codegraph-setup.md)
2. [工具协同与单跳取证](templates/tool-strategy.md)
3. [图遍历、状态机与完整性](templates/graph-traversal-and-completeness.md)
4. [跨应用边解析](templates/cross-application-resolution.md)
5. 输出前阅读 [AI 可读文档模板](templates/output-template.md)

## 工作流

### 0. 检查 CodeGraph 安装、连接与索引

严格按照 CodeGraph 安装与构建指南执行：

1. 优先检查 Agent 是否已经具有可调用的 CodeGraph MCP 工具。
2. MCP 不可用时检查本机 `codegraph` CLI，并可通过 shell 使用它。
3. CLI 已找到时，必须在**同一个非交互 shell**继续检查 `node --version` 和 `codegraph --version`。`codegraph` 的启动脚本通常是 `#!/usr/bin/env node`；因此“找到 codegraph”不代表该 shell 能启动它。
4. 如果 `codegraph` 位于 NVM 的某个 `.../versions/node/<version>/bin`，但 `node` 不在当前 `PATH`，只能为本次命令显式补齐该目录，例如 `PATH=/absolute/nvm/node/bin:$PATH codegraph explore "..."`。先验证 `PATH=/absolute/nvm/node/bin:$PATH node --version` 与 `codegraph --version`，再执行索引和查询。
5. 不得为了修复 Agent 的非交互环境而修改用户的 `~/.zshrc`、NVM 默认版本、系统 `node` 软链接或全局 npm 安装；用户交互终端和 Agent shell 的 `PATH` 可能不同。将发现的 Node 绝对目录和验证结果记录到分析会话元数据。
6. MCP 与 CLI 都不可用时，提醒用户安装 CodeGraph；不要悄悄跳过。
7. 对入口应用及后续发现的每个跨应用目标检查 `.codegraph/`。
8. 索引不存在、过期且工作区规则允许 Agent 建索引时，在该应用根目录运行 `codegraph init -i`。如果工作区规则声明索引由用户决定，则不得自行初始化；继续用源码定位可验证事实，同时把该应用标记 `index_unavailable`，不得因为无索引而跳过应用。
9. 索引构建失败或被策略禁止时记录原因；源码搜索只能推进事实分析，不能让结果通过 CodeGraph 完整性校验。

### 1. 明确入口和工作区

先运行工作区盘点脚本，并把结果保存到会话目录或报告元数据；“可先盘点”改为强制动作：

```bash
python3 <super-development-assistant>/skills/code-operation-center/scripts/workspace_inventory.py \
  --root /absolute/workspace/root --pretty
```

再收集或推断：

- 入口应用名、项目绝对路径。
- 入口方法的全限定类名、方法名、参数类型；返回类型能取得时一并记录。
- 需要搜索跨应用目标的一个或多个工作区根目录。
- 盘点得到的所有候选应用、是否有 `.codegraph/`、是否在用户明确排除范围内。

如果用户只给了简称，先检查/构建索引，再用 CodeGraph 精确定位。只有索引构建失败时才在明确的工作区内用 `rg` 临时搜索声明，并把索引问题保留为未决项。若出现重载、同名类或多个项目候选，列出候选并让用户确认，不要自行选择。

用户一次要求多条链路时，先创建入口清单；每行至少包含入口、方向、业务问题、会话文件和状态。每个入口建立独立会话，或明确记录共享子图的复用关系。任何入口未进入会话都必须在最终报告中显示为 `pending`，不能静默省略。

只有用户按应用名或绝对路径明确排除时才缩小工作区。“只看中台”“只看后端”这类描述不能自动排除工作区内的奖品中心、券中心、持久层或消息消费者。

### 2. 初始化可恢复会话

```bash
python3 <super-development-assistant>/skills/code-operation-center/scripts/call_graph_session.py init \
  /absolute/output/call-graph-session.json \
  --app target-app \
  --project /absolute/path/to/target-app \
  --method 'com.example.OrderService#submit(com.example.Request):com.example.Result'
```

会话同时创建 `upstream` 和 `downstream` 两个前沿。用户未指定预算时采用脚本默认值；不要为赶进度调低预算。

链路模式必须在形成任何业务结论前成功执行 `init`。如果用户只要求固定数量的最终文档，在临时目录保存会话并在最终文档中嵌入覆盖率；不能省略会话。

### 3. 双向执行单跳分析

循环获取下一个任务：

```bash
python3 <super-development-assistant>/skills/code-operation-center/scripts/call_graph_session.py next \
  /absolute/output/call-graph-session.json --direction downstream
```

对返回节点执行以下动作：

1. 用 CodeGraph 取得当前方法源码及直接调用方或被调方。
2. 逐个核对完整签名、调用点、分支条件和动态分派目标。
3. 必要时用源码搜索核对注解、XML/YAML、远程路由和动态分派候选。
4. 把每个直接调用分类为 `local_call`、`cross_app_candidate` 或 `resource_terminal`。所有 `cross_app_candidate` 同时写入跨应用待办清单。
5. 把本批邻居写成 expansion JSON，通过 `expand` 原子写入会话。
6. 邻居超过单批上限时使用 `complete: false` 和 `continuation` 分批提交；最后一批使用 `complete: true`。

下游边的方向是 `当前节点 -> 邻居`；上游边即使从当前节点向上发现，也必须记录真实调用方向 `邻居 -> 当前节点`。Expansion 格式和证据要求见图遍历指南。

一个方向没有项目自有邻居时，只有在确认它是合法边界后才能使用 `terminal`：

```bash
python3 <super-development-assistant>/skills/code-operation-center/scripts/call_graph_session.py terminal \
  /absolute/output/call-graph-session.json \
  --node 'app::com.example.Dao#find(long):Entity' \
  --direction downstream --reason 'database: order_db.t_order' \
  --evidence-kind source --evidence-detail 'OrderMapper.xml:42 SELECT ... FROM t_order'
```

上下游可以交替推进，但两个方向都必须清空前沿。

### 4. 处理下游跨应用边

遇到 RPC、HTTP、消息发布或其他远程客户端时，不把客户端代理当终点：

1. 固化远程契约的接口全名和完整方法签名。
2. 在全部候选项目中寻找精确实现。
3. 验证提供者注册/路由配置及应用归属。
4. 满足跨应用证据门槛后记录真实的 `rpc`、`http` 或 `mq` 边，并从目标方法继续下游分析。

一个远程契约可以有多个提供者或消息消费者，必须全部建分支。不能唯一定位时使用 `block` 记录问题并询问用户；用户确认后用 `confirm --resolution resume` 恢复。

跨应用待办只有以下两种关闭方式：

1. `resolved`：契约、消费者配置、Provider 实现、Provider 注册全部有证据，并已从 Provider 继续入队。
2. `blocked`：记录已搜索工作区、缺失证据、候选应用和用户问题，图保持 INCOMPLETE。

禁止把“看到了客户端接口”“名称像外部服务”“Provider 应该不需要改”作为关闭方式。即使判断某下游不需要修改，也必须先阅读其执行逻辑，才能形成影响面结论。

### 5. 处理上游 ApiImpl 与跨应用消费者

`ApiImpl` 只是一个候选服务边界，不能仅凭命名判定为系统顶层：

1. 识别它实现的远程契约和注册方式。
2. 在所有候选应用中查找对该**完整契约方法**的调用、客户端注入和绑定配置。
3. 每找到一个消费者，就建立 `消费者调用点 -> ApiImpl 方法` 的跨应用边，并在消费者应用继续上游遍历。
4. 找不到消费者时先检查工作区覆盖范围及搜索完整性，再把它标为“顶层候选”。
5. 必须让用户确认是否已经到达所需业务最上层；确认前保持 `unresolved`，不得标记整体完成。

控制器、任务、消息消费者、命令入口等也按同一规则处理。不要维护静态“对外接口白名单”；本次结论来自实际代码、配置、工作区覆盖范围和用户确认。

### 6. 处理不确定性和预算

遇到以下情况使用 `block`：

- RPC 目标应用不存在、候选不唯一或注册证据不足。
- 反向搜索找不到消费者，但不能证明已覆盖全部相关应用。
- 反射、字符串路由、SPI、脚本或配置分派无法解析唯一目标。
- 顶层候选等待用户确认。

预算超限时脚本拒绝本次原子更新并保留会话。向用户报告已完成节点数、剩余前沿和需要提高的具体预算；得到同意后使用 `set-budget` 扩容并继续。

### 6.1 业务状态与执行时序门禁

当任务涉及锁定、核销、退款、撤销、补偿、成功回调等状态语义时，在写结论前建立跨应用状态变更账本：

| 事件 | 应用 | 状态字段与 code | 前置状态 | 后置状态 | 条件 | 事务/幂等 | 下游同步 |
|---|---|---|---|---|---|---|---|

逐个展开所有修改同一业务对象或影子对象的应用。若应用 A 的校验拒绝某状态，而应用 B 支持该状态回退，应报告为“跨应用状态契约待核对”，不能仅根据 A 推导真实业务时序。只有调用方时序、各应用状态迁移和远程同步全部闭合后，才能回答“退款发生在核销前还是后”。

### 7. 校验并生成文档

先逐个检查入口清单，确认每个入口都有会话且跨应用待办为 `resolved` 或 `blocked`，再校验：

```bash
python3 <super-development-assistant>/skills/code-operation-center/scripts/call_graph_session.py validate \
  /absolute/output/call-graph-session.json --require-complete
```

只有该命令成功后才能使用“完整调用链”表述。随后生成事实底稿：

```bash
python3 <super-development-assistant>/skills/code-operation-center/scripts/call_graph_session.py render \
  /absolute/output/call-graph-session.json \
  --output /absolute/output/code-call-graph.md
```

按照输出模板补充业务语义，但不得删除事实底稿中的节点、边、未决项、证据、状态变更账本或覆盖率。最终交付 Markdown 文档和 JSON 会话；JSON 用于复核与续跑。用户限制交付物数量时，可不单独交付 JSON，但必须保留内部会话并在文档中写明校验结果。

## 质量门槛

交付前逐项确认：

- 入口身份无歧义，所有重载均按完整签名区分。
- 工作区盘点已完成；多入口任务的每个入口都有会话或显式 `pending` 记录。
- 每个下游节点的直接项目内调用已穷举，每个上游节点的直接调用方已穷举。
- 每个远程边都有跨应用待办，且以 `resolved` 或 `blocked` 关闭；工作区内存在 Provider 时没有被错误标成外部终点。
- CodeGraph 动态分派结果已与实际实现/配置核对。
- 循环、递归和共享子图没有被重复展开，也没有被遗漏。
- 不存在静默深度、数量或分支截断。
- 顶层边界已经用户确认。
- 涉及状态或时序的结论有跨应用状态变更账本支持；不同应用的状态名称与 code 没有被混用。
- 事实底稿和完整性校验完成前没有提前输出业务指南或改造结论。
- `validate --require-complete` 成功，文档覆盖率与 JSON 状态一致。
