---
审查状态: 已确认
来源追溯: 2026-09-17 用户范围说明；joy-desk@1edf4260a65423993e45f565b1148e160667e3d6；具体来源见本页“来源与关联”
tags:
  - 开发文档
  - JingleAI
  - 项目架构
aliases:
  - 小叮当研发规范与协作流程
创建时间: 2026-09-17T14:51
修改时间: 2026-09-17T17:43
代码版本: 1edf4260a65423993e45f565b1148e160667e3d6
---
# JingleAI研发规范与协作流程

> [!info] 已确认 · 本地源码快照
> 核对日期：2026-09-17；joy-desk 提交 `1edf4260a654`。本文已于 2026-09-17 经用户审查确认，区分代码事实、仓库规范和目标设计；未核验线上部署、当前桌面实例或真实端到端运行。

## 这份笔记如何使用

这是规范的中文速查与阅读路由，不是新的一套工程规则。执行任务时应读取仓库当前 `AGENTS.md`、父级/最近局部规则和命中的专项规则；知识库快照不能替代它们。

## 三条必须先记住的边界

1. **Kernel 边界**：Desk 访问运行时有状态能力只走 IKernelEngine、Plugin SDK、Gateway RPC。精确公开类型/纯函数导出也需通过边界检查；禁止 deep import、shim 或共享内部单例。
2. **Memory 单源**：本地 JSONL 为记忆权威，SQLite ai_messages 为 UI 投影；跨端业务权威另按 Cloud 消息架构，不能混为第二套事实源。
3. **AI 配置单源**：AGENTS.md 与 docs/ai 承载正文，Cursor/Claude 只允许约定的薄适配；不要另建 .codex/.agents 等开发规则目录。运行时插件元数据的精确例外以治理文档为准。

## 工程组织与类型

| 范围          | 要点                                                              | 当前原文                                    |
| ----------- | --------------------------------------------------------------- | --------------------------------------- |
| 应用间         | app 只依赖共享包公开 API；跨应用走 HTTP/RPC/消息，不能共享内部表或单例作隐式合同               | `apps/AGENTS.md`                        |
| 共享包         | 不依赖 apps 实现或 Electron 全局；新增 export 就是新合同，检查消费者和兼容性              | `packages/AGENTS.md`                    |
| 通用设计        | 单一职责、权威状态唯一；没有真实第二实现不预建工厂/注册表/接口层                               | `coding-standards.md`                   |
| Node/NestJS | 边界校验、明确 DTO/schema、DI 管生命周期、Promise 与资源有归属                      | `backend.md`                            |
| Java/Cloud  | 强类型 DTO/command/result/entity；动态 JSON 留在适配边界；应用服务维护事务和授权        | `java-spring.md`、`apps/cloud/AGENTS.md` |
| 数据建模        | 权限、状态、查询、排序、唯一约束用类型化列/关系；文档型 JSON 要说明 schema/版本/迁移/回滚           | `data-modeling.md`                      |
| 前端          | 权威服务端数据、用户草稿、派生 UI 状态分开；竞态用请求身份/取消/版本解决                         | `frontend.md`                           |
| Vue         | Composition API、类型化 props/emits；按用户行为和生命周期拆组件，不维护重复派生状态         | `vue-component-standards.md`            |
| Electron    | Renderer 不直用 Node/Electron；preload 最小白名单；IPC 验证 sender、载荷、路径和权限 | `electron.md`                           |

固定结构不能以 any/Map/JSONObject 贯穿各层。真正动态的外部协议可以在窄 adapter 边界保留，不能机械地把所有 JSON 都拆成业务类。

新业务文件通常控制在 400 行内，超过 600 行需解释单一职责；新 Vue SFC 目标 300 行，超过 500 行需解释或按职责拆分。数字是评审信号，不是机械拆文件指标。遗留巨型入口不继续堆新用例。

## 任务分级与协作记录

| 等级 | 判据 | 最小要求 |
|---|---|---|
| T0 | 单会话、边界清楚、无公开合同/持久化/安全/架构风险的小改动 | 不登记 Harness；正常代码与验证证据 |
| T1 | 跨天/跨会话、需交接或保留决策 | task 条目 + planning |
| T2 | 公开协议、持久化、安全、跨模块架构重构或多人并行等 | T1 + contract、progress、review，并触发 Council 工作流 |

按最高风险判级，文件数量不决定等级。具体生命周期和 CLI 见 `harness-workflow.md`/`harness/README.md`，台账通过工具维护，不手改聚合数据。本次是仓外知识整理，没有修改业务仓库或创建工程任务记录。

## Git 与交付

- 开工先看 `git status --short --branch` 和本任务 diff，不 stash/restore/clean 他人改动。
- 集成主干以 `harness/INDEX.json#trunk` 为唯一来源，不能凭当前分支名或旧文档猜测。
- 仓库规范的任务分支形态为 `<type>/<YYYYMMDD>-<slug>`，具体工具执行还应遵循当前会话的上位指令。
- worktree 仅用于真实并发、长期挂起或用户要求；禁止在仓内 worktree 安装/升级 pnpm 依赖。
- commit/push/merge 按实际授权范围执行，不顺带发布；只包含本任务文件。
- 不跳过 hook，不向未知 remote 推送；不提交凭据、生产数据和个人绝对路径。
- 合入主干使用维护中的集成脚本与最新 trunk 验证，不能把本地单分支测试替代合并后的证据。

## 按风险选验证

| 变更 | 所需证据 |
|---|---|
| 文档/注释 | 来源、链接、格式/schema 检查 |
| Bug | 能复现目标故障的测试，修复后转绿 |
| 新行为 | 验收行为、边界与错误路径 |
| 纯重构 | 原行为护栏与受影响合同 |
| 公共协议/IPC/RPC | 生产者消费者类型、schema/golden、兼容与合同测试 |
| 数据库 migration | 新迁移、真实数据库兼容、升级/回滚验证 |
| 窗口、启动、native、资源与打包 | 对应 OS/edition 的打包或 smoke 证据 |
| AI 规则/Skill/AGENTS | `pnpm run verify:ai-config` |

根测试通过 manifest runner，按目标和路径缩小；不要根目录裸跑无配置 Vitest 而扫到 worktree 副本。不要把未运行写成通过，失败必须区分回归、环境缺失与有证据的历史基线。

## 重要专题的原文路由

- 内核边界：`docs/ai/rules/kernel-boundary.md`。
- Memory：`docs/ai/rules/memory-invariants.md`。
- 多端消息：`docs/design/unified-conversation-event-protocol-v2.md`；实施状态只看 `cloud-message-ssot-implementation-plan.md`。
- Cloud/Runner：`apps/kernel-runner/docs/CLOUD-KR-INTERACTION-CONTRACT.md`。
- 桌面模块：`apps/desk/docs/project-handbook/README.md` 与对应模块页，核对其版本锚定。
- Web 样式/交互与数据面：`apps/desk-web/README.md`，注意历史进度段落。
- 自动化控制面：当前《111》，不要按旧《75》《97》恢复历史架构。
- Edition/登录：`joydesk-edition-and-login-arena.md`；其历史路径引用需核对是否仍存在。

本轮仅整理上述规范与知识，没有修改公共包或执行发布流程。

## 来源与关联

- 工程入口：`AGENTS.md:6`。
- 应用规范：`apps/AGENTS.md:19`。
- 共享包规范：`packages/AGENTS.md:6`。
- 规则索引：`docs/ai/rules/index.md:1`。
- 内核边界：`docs/ai/rules/kernel-boundary.md:33`。
- 本地记忆不变量：`docs/ai/rules/memory-invariants.md:5`。
- Cloud 规则：`apps/cloud/AGENTS.md:4`。
- Git 协作规范：`docs/ai/rules/gitflow.md:5`。
- 任务分级规范：`docs/ai/rules/harness-workflow.md:17`。
- 测试规范：`docs/ai/rules/testing-conventions.md:5`。
- 前端规范：`docs/ai/rules/frontend.md:5`。
- Vue 规范：`docs/ai/rules/vue-component-standards.md:3`。
- Node 规范：`docs/ai/rules/backend.md:5`。
- Electron 安全规范：`docs/ai/rules/electron.md:5`。
- Java 规范：`docs/ai/rules/java-spring.md:5`。
- 数据模型规范：`docs/ai/rules/data-modeling.md:5`。
- AI 配置治理：`docs/ai/rules/ai-config-governance.md:5`。
- 分层与消息规则：`docs/ai/rules/architecture.md:3`。
- 编码设计原则：`docs/ai/rules/coding-standards.md:5`。
- 公共协议规则：`packages/kernel-protocol/AGENTS.md:4`。

源码版本见文档属性，来源路径与定位信息见本页。返回 [[JingleAI项目知识总览]]。
