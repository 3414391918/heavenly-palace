---
审查状态: 已确认
来源追溯: 2026-09-17 用户范围说明；joy-desk@1edf4260a65423993e45f565b1148e160667e3d6；具体来源见本页“来源与关联”
tags:
  - 开发文档
  - JingleAI
  - 项目架构
aliases:
  - 小叮当云端执行架构
创建时间: 2026-09-17T14:51
修改时间: 2026-09-17T17:43
代码版本: 1edf4260a65423993e45f565b1148e160667e3d6
---
# JingleAI云端执行架构

> [!info] 已确认 · 本地源码快照
> 核对日期：2026-09-17；joy-desk 提交 `1edf4260a654`。本文已于 2026-09-17 经用户审查确认，区分代码事实、仓库规范和目标设计；未核验线上部署、当前桌面实例或真实端到端运行。

## 定位

`apps/kernel-runner` 是独立于桌面端的云端 AI 执行宿主。Cloud 负责调度与业务控制，Runner 负责租户/用户/项目 scope、路由、队列、沙箱、工作区、执行状态和持久化适配。网页端的内核能力通过 Cloud 到达这里。

技术栈为 TypeScript、NestJS 11、Socket.IO、TypeORM/MySQL、Redis，manifest 还声明 BullMQ 等队列依赖。单应用 engines 写 Node `>=22`，但根仓库要求 `>=24`；在 monorepo 中开发应采用根要求，不按较低子应用条件安装整仓。

## 接入与执行结构

![[JingleAI-云端执行图.svg]]

`KernelGateway` 注册 Socket.IO namespace `/kernel`。这不是原生 WebSocket `/ws/mobile`；客户端协议不能混用。图中 LB/forward 的要求来自双方规范性合同，未核验预发或生产集群实际配置。

## 隔离域是理解 Runner 的关键

隔离粒度为 `(tenantId, users|projects, primaryId)`：用户域取 userId，项目域取 projectId。`scopePrimaryRef()` 与 `routeKeyOf()` 已在当前代码核对。

- 一个隔离域共享一个 bwrap、一个常驻引擎和一份工作区。
- assistantId 不进入 owner 路由键或 sandbox binding 粒度；多个助手作为同引擎中的 agent。
- 助手人格/记忆可通过助手私有目录或隔离键继续区分；Socket.IO 投递房间与隔离域不是同一把键。
- `bare` 是无管家临时会话的保留 assistantId，不可分配为普通助手 ID。
- 用户域与项目域必须保留类型维度，避免相同字符串 ID 被误归为同一域。

## 存储职责

| 存储 | README 定义的职责 | 边界 |
|---|---|---|
| 宿主 MySQL `kr_*` | Runner 用户/助手/会话、运行台账、job/event/outbox/idempotency、工作区元数据等 | 执行宿主自己的控制与恢复数据 |
| 宿主 MySQL `krn_*` | Goal、observation、async task 等内核状态 | 不能误判为都在沙箱 SQLite |
| 节点本地工作区/JSONL | 文件、内核会话全文、助手目录 | 本轮未验证跨节点迁移/备份实况 |
| Redis | owner 路由、锁、fan-out、队列协调 | 不充当长期业务事实源 |

README 特别说明 `kr_chat_*` 虽有 schema，但普通 chat transport hook 未接，不能按表名推断它是聊天真源。`KERNEL_RUNNER_RUNTIME_MODE=sqlite-provider` 当前只是历史命名的 transport 标签；说明文档规定沙箱不打开 `kernel.db`，宿主 MySQL 仍必需。上述表用途来自现行说明，未连接数据库逐表验收。

## 隔离基座与宿主条件

`selectSandboxRuntime()` 的实际分支为：只有 `KERNEL_RUNNER_ISOLATION=docker` 才选 Docker，其余选 Bwrap。文档说明 bwrap 需要 Linux、systemd-run、cgroup v2 等宿主条件；macOS 本地开发需按现有 Docker 方案准备。

生产 rootfs 应为专用 minimal rootfs；只读挂载宿主根目录仍会暴露读取面。网络出站、CPU/内存/磁盘配额与路径校验均属于执行安全边界。这里只记录设计要求，不声明任何环境已经符合。

## Cloud 与 Runner 的重试合同

无状态 LB 下，入口节点未必是 scope owner。现行合同要求 `routeMismatchMode=forward`，并配合 `ownerSelection=load-aware`。不能把单机 reject 模式当集群通用配置。

| 失败类别 | 合同要求 |
|---|---|
| 连接、路由、临时不可达 | 有界重连/重试；复用同一 requestId |
| 队列或容量背压 | 按 retryAfterMs 退避并加抖动，不能立即重发 |
| 参数、模型或沙箱业务终态错误 | 不自动重放；向上游保留结构化错误 |

固定幂等身份是防止副作用重复执行的必要条件。`requestId`、Cloud Run ID、连接标识用途不同，不按名字相似互换。完整字段和例外以 `CLOUD-KR-INTERACTION-CONTRACT.md` 及 wire protocol 为准；本轮不宣称所有跨应用分支闭合。

## 排查入口

`src/main.ts`/`app.module.ts` 看装配；`socket/` 看入口协议；`scope/` 看身份；`routing/` 看 owner；`orchestrator/` 看隔离与生命周期；`persistence/` 看台账和状态。先确定 tenant、scope、run/request 的对应关系，再追执行节点，避免只检查最初建连节点。

参见 [[JingleAICloud与管理后台架构]]、[[JingleAI跨端通信与数据权威]]、[[JingleAI环境与开发验证]]。

## 来源与关联

- 工具链与根命令：`package.json:8`。
- Runner 规则：`apps/kernel-runner/AGENTS.md:7`。
- Runner 存储与隔离说明：`apps/kernel-runner/README.md:9`。
- Runner 依赖与命令：`apps/kernel-runner/package.json:36`。
- Socket.IO 注册：`apps/kernel-runner/src/socket/kernel.gateway.ts:109`。
- 隔离与路由键：`apps/kernel-runner/src/scope/kernel-runner-scope.ts:165`。
- 隔离基座选择：`apps/kernel-runner/src/orchestrator/orchestrator.module.ts:31`。
- Cloud 与 Runner 合同：`apps/kernel-runner/docs/CLOUD-KR-INTERACTION-CONTRACT.md:40`。
- Cloud 到 Runner 连接层：`apps/cloud/src/main/java/com/jdt/joydesk/chatchannel/a2a/kernelrunner/KernelRunnerSocketClient.java:59`。

源码版本见文档属性，来源路径与定位信息见本页。返回 [[JingleAI项目知识总览]]。
