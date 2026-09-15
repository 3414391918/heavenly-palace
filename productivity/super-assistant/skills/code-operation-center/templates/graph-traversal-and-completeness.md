# 图遍历、状态机与完整性

## 为什么采用单跳队列

调用链表面像树，实际是有向图：多个分支会汇合，同一工具方法会被反复调用，递归和回调会形成环。按树递归会指数重复；按“规范节点 + 唯一边 + 双向前沿”遍历，可以在不丢分支的前提下让每个节点每个方向最多展开一次。

会话中有两个独立状态：

- `downstream`：从入口沿真实调用方向展开。
- `upstream`：从入口沿真实调用方向的反方向发现 caller。

节点在每个方向的状态为：

- `unseen`：该节点不属于这个方向从入口可达的分析子图，无需处理。
- `pending`：等待单跳分析。
- `in_progress`：已提交部分邻居，仍有 continuation。
- `expanded`：这一方向的直接项目内邻居已穷举。
- `terminal`：已用证据证明为合法边界。
- `unresolved`：需要用户确认，整体不能完成。
- `deferred`：受预算限制尚未分析，整体不能完成。

## 规范身份和去重

节点 ID：

```text
<application>::<fully.qualified.Class>#<method>(<fully.qualified.Param,...>):<returnType>
```

构造器使用 `#<init>(...)`。无法取得返回类型时先用 `:?`，但在完成前必须补齐；重载至少必须有参数类型。代理、接口声明和实现方法是不同节点，必要时用 `dynamic_dispatch` 或 `rpc` 边连接。

边按 `caller + callee + edge_type` 去重；重复发现时合并调用点和证据。共享子图只展开一次，文档其他位置引用其节点编号。递归边保留，但不会把已处理节点再次入队。

## Expansion 输入

每次单跳发现写入 JSON 文件：

```json
{
  "direction": "downstream",
  "node_id": "order-app::com.acme.OrderService#submit(com.acme.Request):com.acme.Result",
  "complete": true,
  "continuation": null,
  "neighbors": [
    {
      "app": "order-app",
      "project_path": "/workspace/order-app",
      "method": "com.acme.PriceService#calculate(com.acme.Request):java.math.BigDecimal",
      "kind": "method",
      "edge_type": "call",
      "confidence": "confirmed",
      "branch": "if (request.hasCoupon())",
      "callsite": {
        "file": "/workspace/order-app/src/main/java/com/acme/OrderService.java",
        "line": 83
      },
      "evidence": [
        {"kind": "codegraph", "detail": "resolved direct callee"},
        {"kind": "source", "detail": "OrderService.java:83"}
      ],
      "enqueue": true
    }
  ]
}
```

执行：

```bash
python3 <super-development-assistant>/skills/code-operation-center/scripts/call_graph_session.py expand \
  /absolute/output/call-graph-session.json \
  --input /absolute/output/one-hop-expansion.json
```

上游 expansion 的 `neighbors` 仍填写“新发现的 caller”。脚本会将边规范为 `neighbor -> node_id`。

若一个节点的邻居多于单批上限：

1. 第一批设置 `complete: false`，填写非空 `continuation`。
2. 继续为同一节点提交后续批次。
3. 只有工具结果和兜底检索都已核对完，最后一批才能设置 `complete: true`。

`complete: true` 是分析者对“直接邻居已穷举”的声明，不是“工具返回结束”就自动成立。如果直接邻居为零，不能提交空 expansion：下游必须记录叶子/外部资源边界，上游必须 `block` 并取得用户的顶层确认，然后标为 terminal。

## 分支爆炸控制

按以下顺序控制规模，不能牺牲完整性：

1. **限定分析宇宙**：只展开工作区项目自有代码；库、DB、缓存、第三方系统记录为边界。
2. **全局节点去重**：一个规范方法在一个方向只展开一次。
3. **唯一边合并**：多个调用点保留为证据，不重复创建相同边。
4. **环检测**：递归和相互调用保留回边，不重复入队。
5. **单跳分批**：高 fan-out 节点分页提交，避免一次把大量源码塞进上下文。
6. **持久化前沿**：每批原子写 JSON，随时续跑。
7. **硬预算只暂停**：超过节点、边、应用、深度或单批 fan-out 预算时拒绝更新；向用户申请扩容，不静默丢弃。

不要使用“只看核心包”“忽略看起来不重要的分支”“最多递归 5 层”之类隐式裁剪。用户主动缩小范围时，必须在报告 Scope 中写明，因此输出是“范围内完整”，不是全系统完整。

## 上游完整性校验

反向链路最容易漏调用方。每个节点标为 `expanded` 前：

1. CodeGraph 获取所有直接 callers，包含接口分派。
2. 逐个回读调用点所在方法，排除同名方法和注释/字符串命中。
3. 对完整接口名、注入字段和方法调用做工作区搜索兜底。
4. 检查框架入口：Controller、RPC provider、listener、task、AOP、模板/回调、反射和配置路由。
5. 若工具给出 caller 数量，实际入图数量必须能解释差异。

上游分析采用反向 fan-in 穷举和逐跳验证，事实查询统一使用 CodeGraph。

## 下游完整性校验

每个节点标为 `expanded` 前：

1. 遍历方法体所有可执行分支，包括异常与 finally。
2. 获取全部直接项目内 callees 和动态实现。
3. 检查责任链、策略表、lambda、方法引用、事件发布、RPC/HTTP/MQ 和持久层入口。
4. 每个边界必须是已展开的跨应用目标、合法 terminal 或 unresolved，不能消失。
5. 同一 callee 在不同条件被调用时，合并节点但保留所有分支/调用点。

## 会话完整性

不确定项先阻塞当前节点，不要把多个猜测目标写成 confirmed 边：

```bash
python3 <super-development-assistant>/skills/code-operation-center/scripts/call_graph_session.py block \
  /absolute/output/call-graph-session.json \
  --node '<application>::<full-method-signature>' \
  --direction upstream \
  --reason 'no unique RPC consumer/provider found' \
  --question '请确认目标应用或该入口是否已是业务最上层' \
  --candidates /absolute/output/candidates.json

python3 <super-development-assistant>/skills/code-operation-center/scripts/call_graph_session.py confirm \
  /absolute/output/call-graph-session.json \
  --block-id B0001 --resolution resume --answer '<用户确认内容>'
```

若用户确认已经到达最上层，使用 `--resolution terminal`；若用户提供了应用线索，使用 `resume`，补齐代码证据后再提交跨应用 expansion。用户确认不能替代契约与实现方法本身的证据。

`status` 返回方向覆盖率、状态计数、待处理前沿和阻塞问题。只有同时满足以下条件，`validate --require-complete` 才成功：

- 两个 frontier 都为空。
- 没有 `pending`、`in_progress`、`unresolved`、`deferred`。
- 所有边端点存在且证据非空。
- 所有跨应用边满足证据门槛或带用户确认。
- 每个应用有绝对项目路径。
- 顶层候选都已有用户确认记录并被标为 terminal。

`expanded` 只证明“当前方向的一跳已穷举”；完整图是所有可达节点都满足终态后的整体性质。
