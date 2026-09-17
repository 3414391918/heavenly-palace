---
审查状态: 已确认
来源追溯: 2026-09-17 用户范围说明；joy-desk@1edf4260a65423993e45f565b1148e160667e3d6；具体来源见本页“来源与关联”
tags:
  - 开发文档
  - JingleAI
  - 项目架构
aliases:
  - 小叮当桌面端架构
创建时间: 2026-09-17T14:51
修改时间: 2026-09-17T17:43
代码版本: 1edf4260a65423993e45f565b1148e160667e3d6
---
# JingleAI桌面端架构

> [!info] 已确认 · 本地源码快照
> 核对日期：2026-09-17；joy-desk 提交 `1edf4260a654`。本文已于 2026-09-17 经用户审查确认，区分代码事实、仓库规范和目标设计；未核验线上部署、当前桌面实例或真实端到端运行。

## 定位与技术栈

`apps/desk` 是 Electron 桌面宿主，支持本机系统能力及本机 AI 运行。当前 manifest 声明 Electron `^42.2.0`，主 Renderer 使用 Vue 3、Vite、Pinia、Element Plus，后端宿主为 Node/NestJS。版本为源码声明，未核对用户已打开的安装包。

## 四个职责边界

| 边界      | 主要入口/目录                                                                   | 负责什么                                          |
| ------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| 用户界面    | `frontend/src/main.ts`、`frontend/src/App.vue`、stores/composables/services | 页面、对话展示、用户交互、客户端状态                            |
| 桌面宿主    | `electron/main.ts`、`electron/preload.ts`、`electron/` 各域模块                 | 窗口、生命周期、IPC、安全校验、操作系统能力                       |
| 应用服务    | `backend/server.ts`、`backend/nest/modules`、`backend/services`             | HTTP/RPC 接入、业务编排、本地持久化与宿主适配                   |
| AI 内核接入 | `backend/kernels/common/desk-kernel-adapter.ts`、`backend/kernels/jingle`  | 适配与路由；AI 内核实现主要在共享包 `packages/jingle-ai-claw` |

仓库 handbook 也按上述四种职责组织。历史“agents → components → services → database”分层用于理解依赖方向；部分旧模块已经迁入内核包，不应按旧架构文档假设它们仍在 backend。

## 逻辑分层与进程部署要分开看

`electron/main.ts` 的启动代码明确存在两条路径：

- 未设置 `ENABLE_SIDECAR=1` 时，实例化 `BackendServer`，走 in-process 宿主后端。
- 设置 `ENABLE_SIDECAR=1` 时，实例化 `BackendServerProxy`，走 sidecar 后端。

局部规则描述默认 in-process，当前代码同时存在显式 sidecar 分支。这两点应同时保留；本次未判定运行中的桌面选择了哪一种。

Jingle 适配器中已核实的接线是：连接 Gateway → 创建 `JingleGatewayKernel` → 创建 `JingleGatewayEngineAdapter` → 建立 KernelBridge。**宿主后端是否 sidecar** 与 **AI Kernel 是否经 Gateway** 是不同问题。仓内还存在 OpenClaw 适配，不据此推断用户当前使用的内核。

## 内核与宿主如何协作

- 有状态运行能力通过 `IKernelEngine`/Domain Ops、Plugin SDK 或 Gateway RPC 访问。
- 类型、schema、纯函数及明确 SDK 只能使用精确的公开 export，并通过边界检查。
- 禁止 deep import 内核 `src/**`、一行 re-export 包装或共享内核内部单例。
- Electron 窗口、浏览器、通知、文件打开等能力属于宿主，通过 capability 注入或事件合同接入内核。
- 业务 Agent 当前统一为 `GeneralTaskAgent`；`general-task-agent` 与 `work-butler-agent` 是同类不同注册。新增能力优先看 Component/Skill，不能把旧专业 Agent 文档当当前结构。

## 数据与配置

本地记忆遵守 JSONL 权威、SQLite `ai_messages` 为 UI 投影；数据目录通过 `JOYDESK_HOME` 和已有路径解析统一，不能任意拼 Electron `userData` 路径。写入、迁移和读取各有 wiring 要求，不能只检查磁盘存在文件就判定历史恢复正常。

跨端会话、项目协作和自动化控制依赖 Cloud。仓库当前自动化文档规定：Cloud 拥有时钟与配置，Desk 承担执行和 Hub 展示；不应恢复本地任务表为第二权威。这里引用的是现行文档职责，未进行调度业务状态机审计。

Edition、Deployment、LoginMode 是三条独立配置轴；它们与预发/生产选择也不能混为一谈。参见 [[JingleAI环境与开发验证]]。

## 接到需求从哪里看

| 现象/改动                | 首先定位                                             |
| -------------------- | ------------------------------------------------ |
| 主窗口页面或对话交互           | 实际 Renderer surface、对应 Vue 组件与 store             |
| 窗口、preload、系统能力或 IPC | `electron/` 与白名单 API；同步检查调用方类型                   |
| HTTP/RPC 业务行为        | `backend/nest/modules` 及负责业务的 service            |
| 内核连接或初始化             | `DeskKernelAdapter`、Gateway adapter 与 manager    |
| 重启后历史异常              | JSONL 写路径、canonical 路径、迁移、history-query/观测记录链    |
| 多端历史、协作或任务调度         | [[JingleAICloud与管理后台架构]] 和 [[JingleAI跨端通信与数据权威]] |

这张表是代码定位入口，不宣称穷举全部调用分支。

## 来源与关联

- 桌面规则：`apps/desk/AGENTS.md:6`。
- 桌面依赖与命令：`apps/desk/package.json:314`。
- 桌面前端规则：`apps/desk/frontend/AGENTS.md:6`。
- 宿主后端规则：`apps/desk/backend/AGENTS.md:6`。
- Electron 规则：`apps/desk/electron/AGENTS.md:6`。
- 后端启动分支：`apps/desk/electron/main.ts:6755`。
- Jingle Gateway 接线：`apps/desk/backend/kernels/common/desk-kernel-adapter.ts:802`。
- 内核边界：`docs/ai/rules/kernel-boundary.md:33`。
- 本地记忆不变量：`docs/ai/rules/memory-invariants.md:5`。
- 分层与消息规则：`docs/ai/rules/architecture.md:3`。
- 桌面手册导航：`apps/desk/docs/project-handbook/README.md:10`。
- 共享内核规则：`packages/jingle-ai-claw/AGENTS.md:12`。
- 自动化当前职责：`apps/desk/docs/核心技术文档/111.自动化控制面 desk-cloud 现状.md:11`。

源码版本见文档属性，来源路径与定位信息见本页。返回 [[JingleAI项目知识总览]]。
