---
审查状态: 已确认
来源追溯: 2026-09-17 用户范围说明；joy-desk@1edf4260a65423993e45f565b1148e160667e3d6；具体来源见本页“来源与关联”
tags:
  - 开发文档
  - JingleAI
  - 项目架构
aliases:
  - 小叮当跨端通信与数据权威
创建时间: 2026-09-17T14:51
修改时间: 2026-09-17T17:43
代码版本: 1edf4260a65423993e45f565b1148e160667e3d6
---
# JingleAI跨端通信与数据权威

> [!info] 已确认 · 本地源码快照
> 核对日期：2026-09-17；joy-desk 提交 `1edf4260a654`。本文已于 2026-09-17 经用户审查确认，区分代码事实、仓库规范和目标设计；未核验线上部署、当前桌面实例或真实端到端运行。

## 先区分三种证据

本页的消息设计来自仓库已冻结的目标架构；传输入口做了静态源码核对；实施状态来自唯一实施计划。没有运行端到端测试，因此不把目标语义写成所有线上版本均已验收的事实。

## 谁拥有哪类事实

| 数据/状态 | 权威或职责范围 | 不应混淆 |
|---|---|---|
| 本机 Kernel 会话全文/记忆 | JSONL；SQLite `ai_messages` 是 UI 投影 | SQLite 不可反过来成为本机第二会话权威 |
| Cloud 接受并归一后的跨端对话、长期 Message | Cloud Conversation Authority | 桌面 JSONL、浏览器 store、Redis 都不是第二跨端权威 |
| Turn/Run、route/lease、低频控制、终态恢复 | Cloud Client Relay 与 Authority 组成逻辑 Cloud 单源 | Relay 的短期事件与长期消息分工不同 |
| 大 TraceVersion/snapshot | 目标设计使用对象存储 | 不等于每 token 都写长期 MySQL |
| Runner 执行台账和内核状态 | Runner 宿主 MySQL `kr_*` / `krn_*` | 与 Cloud 业务权威按职责区分，不共享表作隐式合同 |
| 页面显示、乐观消息、待发送 outbox | 客户端投影与发送恢复 | 局部可见不能证明 Cloud 已接受 |
| 自动化配置与到点调度 | 当前文档规定由 Cloud 控制面负责 | Desk 是执行与展示端，不能复制本地权威任务表 |

“JSONL 是权威”在本机内核记忆范围成立；Cloud 未接受的离线任务保留本地事实，reconcile 后按 Cloud 身份收敛。这与跨端 Cloud 权威互补。

## 关键对象

| 对象                    | 解释                                    |
| --------------------- | ------------------------------------- |
| Conversation          | 用户可见的长期会话容器                           |
| Turn                  | 一轮交互；重试可产生新的执行 attempt                |
| Run                   | 一次执行，具有身份、状态、控制和终态                    |
| Message               | 长期可读消息及结构化 contentBlocks              |
| RunEvent/live frame   | 执行过程事件；实时展示与持久化事件需区分                  |
| RuntimeSessionBinding | Cloud 身份与真实运行时 session/generation 的映射 |
| RunOutcome            | 执行终态结果；不能只根据 UI 最后一段文字判断              |
| TraceVersion/snapshot | 有权限与完整性要求的轨迹/恢复材料                     |

`hostSessionKey` 表示运行实例连接，不是全局会话 ID。不要把 conversationId、runId、runtimeSessionId 和 requestId 当同一个字段。

## 目标消息系统如何运作

![[JingleAI-消息权威图.svg]]

这是规范性结构图：普通 delta 主动推送，不逐帧等待数据库 ACK；高频持久化采用合并片段和 checkpoint；终态先 flush，再通过事务/outbox/projector 收敛。停止、取消、人机交互等低频控制采用持久化命令，以及 transport ACK 与 business ACK 两种确认。

恢复至少区分：流恢复、session 冷恢复、同一 Run 的连续执行。恢复文件或会话不自动证明可以继续原 Run；没有 same-Run continuation 证明时按统一失败关闭语义进入唯一重试 attempt 或人工决策，不能悄悄重新执行有副作用任务。

## 已定位到的真实接入面

| 关系                        | 入口证据                                                     | 本轮证据深度           |
| ------------------------- | -------------------------------------------------------- | ---------------- |
| Web → Cloud               | `createCloudWebClient`；`/api/client`、`turns:prepare`、SSE | 调用构造与路由注册已核对     |
| Desktop → Cloud           | `/api/conversation`；`/ws/client`、`/ws/notification`      | 服务端入口及职责已核对      |
| Mobile → Cloud            | `CloudTransport` + `/ws/mobile` + mobile 帧               | 客户端传输与服务端注册已核对   |
| Cloud → Runner            | `KernelRunnerSocketClient`；Socket.IO `/kernel`           | 连接层、接收入口和双方合同已核对 |
| Desk host → Jingle Kernel | Gateway kernel + engine adapter + KernelBridge           | 宿主接线已核对          |

独立通道有各自 adapter；不能因统一消息架构就要求移动帧和 Web SDK 帧逐字相同。这里没有完成方法级双向调用图、全部动态分派或所有失败分支证明。

## 实施状态的使用方式

`cloud-message-ssot-implementation-plan.md` 是唯一进度来源。快照中编号 0–5 阶段标为 completed，第 6 阶段灰度兼容与收敛仍为 in_progress，缺连续自然窗口、真实旧发布包抽样、单一退出入口和 owner 签字等。此处仅记录读取时的未决边界，后续进度必须回原文查看，不在知识库维护第二份百分比。

Authority 迁移文档顶部写 2026-08-30 已完成，但仍保留较早的“生产 Expand”等历史段落；迁移完成与消息全链路验收完成是两件事。根规范、当前 Cloud 实现和维护中的 SSOT 计划应结合阅读。

## 常见问题的定位顺序

- 页面显示完成但历史不完整：检查 Run 终态/Outcome、Message projector 与权威历史，不能只看流结束。
- 桌面有历史而 Web 没有：先区分本地未登记、Cloud 已接受、同步/权限/投影阶段，再查具体异常。
- 手机重连后重复或缺消息：区分传输恢复、durable cursor、outbox 幂等和权威历史合并。
- 云端执行异常：区分 Cloud 调度/授权与 Runner scope/owner/沙箱执行。

这些是定位建议，不是已经验证的某次故障根因。

## 来源与关联

- 本地记忆不变量：`docs/ai/rules/memory-invariants.md:5`。
- Cloud SDK 接入：`apps/desk-web/src/lib/api.ts:210`。
- SDK 契约说明：`packages/cloud-web-client/README.md:63`。
- Runner 存储与隔离说明：`apps/kernel-runner/README.md:9`。
- 移动端帧与执行目标：`apps/mobile/app/lib/transport/cloudProtocol.ts:101`。
- 移动端 WebSocket：`apps/mobile/app/lib/transport/cloud.ts:246`。
- Cloud WebSocket 注册：`apps/cloud/src/main/java/com/jdt/joydesk/websocket/config/WebSocketConfig.java:51`。
- Cloud BFF 路由：`apps/cloud/src/main/java/com/jdt/joydesk/clientrelay/controller/ClientRelayController.java:100`。
- 桌面对话权威路由：`apps/cloud/src/main/java/com/jdt/joydesk/conversationauthority/controller/DesktopConversationAuthorityController.java:32`。
- Cloud 到 Runner 连接层：`apps/cloud/src/main/java/com/jdt/joydesk/chatchannel/a2a/kernelrunner/KernelRunnerSocketClient.java:59`。
- 冻结的消息目标架构：`docs/design/unified-conversation-event-protocol-v2.md:17`。
- 唯一实施状态记录：`docs/design/cloud-message-ssot-implementation-plan.md:335`。
- 迁移历史与范围：`docs/design/conversation-authority-migration-from-skill-manager.md:3`。
- 自动化当前职责：`apps/desk/docs/核心技术文档/111.自动化控制面 desk-cloud 现状.md:11`。

源码版本见文档属性，来源路径与定位信息见本页。返回 [[JingleAI项目知识总览]]。
