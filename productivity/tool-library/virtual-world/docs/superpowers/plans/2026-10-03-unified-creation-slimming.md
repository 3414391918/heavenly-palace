# 虚拟世界统一创作与瘦身实施计划

> 执行方式：在当前会话完成，先确认边界，再实施和集成；对独立的界面与团队配置工作采用 dispatching-parallel-agents，最后执行 council-review。所有步骤均以用户已批准的设计为准。

**Goal:** 将小说创作收敛到现有长篇工作流，删除短篇、剧本与退出使用的额外功能，保护现有小说文件格式和引用。

**Architecture:** Electron、Preload、Core 和 Agent 的现有职责不变。Renderer 只保留一套小说工作区和修改分析，Main 不再初始化被删除的功能，Agent 不再提供退出使用的工具和运行分支。文件清单、long 目录和已有命令前缀继续兼容当前小说。

**Tech Stack:** Vue、Pinia、TypeScript、Electron、Zod、Pi Agent Runtime、pnpm、Vitest。

## Task 1: 隔离环境与基线

- [x] 从外层仓库 master 创建 `codex/virtual-world-slimming` 工作区，原工作目录的其它改动不复制、不清理。
- [x] 使用 `pnpm install --frozen-lockfile --offline --ignore-scripts` 安装依赖。
- [x] 运行 `pnpm test`，确认原测试基线。

## Task 2: 唯一书籍入口与工作区界面

**Files:** `CreateBookDialog.vue`、`SettingsPage.vue`、`WorkspaceShell.vue`、`WorkspaceFeatureModules.vue`、侧栏、功能宿主、工作区生命周期和相关 composables；删除 Renderer 中退出使用的短篇、剧本及 extras 页面。

- [x] 先将新建书籍测试的预期改为直接创建当前长篇结构，运行该测试观察失败。
- [x] 新建提交类型收敛为 `CreateLongBookInput`，调用 `createLong`。书名长度和题材使用现有长篇校验。
- [x] 设置直接渲染 `LongAgentSettingsPanel`，保留保存、恢复默认、快捷按钮和读取范围。
- [x] 工作区只显示真实小说和资料库；删除短篇、剧本会话及文稿页面的运行编排。
- [x] “更多功能”目录使用 `[{ id: "revision-analysis", label: "修改分析", description: "从文稿修改中学习可复用技能", icon: "file" }]`，删除其它页面及控制器。
- [x] 侧栏团队标题改为“子智能体团队”；去掉保留界面的创作类型名称和标签。
- [x] 对超过限制的被修改文件按工作区编排、组件展示、资源操作的职责拆分。
- [x] 运行相关 Renderer 测试和 `vue-tsc --noEmit -p apps/desktop/tsconfig.web.json`。

## Task 3: 子智能体团队与默认提示词

**Files:** `agent-team-catalog.ts`、`agent-team-profile-factory.ts`、`agent-team-config-store.ts`、`agent-team-run-mode.ts`、`AgentTeamCatalogFeature.vue`、团队编辑器、`long-workspace/agents.ts`、主智能体与资料库默认提示词及配置升级代码。

- [x] 补充旧 long 团队读取、单一启用状态以及旧默认提示词升级的测试，运行并确认失败原因。
- [x] 新团队创建只接收名称；内部当前 long 数据格式沿用。只有一个主智能体和一套可启用团队。
- [x] 删除短篇、剧本团队的创建、编辑和运行支持；导入它们时返回明确错误。保持已有 long 团队 ID 和成员配置。
- [x] 所有运行中的默认提示词品牌替换为“虚拟世界”，称呼统一为主智能体、小说、创作空间。
- [x] 已存提示词只有与旧内置默认相同才升级，用户自定义文本保留。
- [x] 运行团队配置、包导入导出、运行模式、默认提示词与升级相关测试。

## Task 4: 删除后台能力和创作运行分支

**Files:** `desktop-services.ts`、Main IPC、Preload 白名单、`packages/contracts/src` 的命令/事件/会话入口、`packages/pi-runtime-adapter/src` 的工具和 prompt 分支、Core 入口与专用存储、`apps/desktop/src/extras`。

- [x] 对退出使用的功能命令和会话上下文编写拒绝测试，运行并确认原实现仍会接受。
- [x] 删除学习仿写、拆书分析、文风比对、市场、云备份、双端同步和朱雀检测的独立实现、契约导出、路由及服务初始化。
- [x] 会话仅接受当前小说工作区、资料库、子智能体编写和修改分析的上下文；删除短篇/剧本运行工具和配置解析。
- [x] Core 的旧书籍创建、模板、短篇正文和剧情结构写入入口退出使用；文件夹存储仍用于素材库、技能库与必要的已有文件读取。
- [x] 清理只被删除功能引用的导入解码、传输、网络、QR 等依赖，保留仍有消费者的共用代码。
- [x] 路由和配置删减同步更新 Zod、Preload、Main、Core、Agent，不另开未校验入口。
- [x] 运行 `pnpm typecheck` 和相关 IPC、Core、Agent 工具及审批测试。

## Task 5: 集成、审查和界面验收

- [x] 搜索保留源码中的 `短篇|长篇|剧本` 和默认提示词的 `DeepWrite`，逐项区分兼容标识与产品残留。
- [x] 更新 `AGENTS.md`、依赖锁和构建冒烟检查，删除旧功能的专用测试并调整混合测试。
- [x] 运行 `pnpm verify`，检查退出码及测试数量；仅针对具体失败修复并重跑。
- [x] 按 council-review 分别审查正确性/简洁性与合同/验证，核实并修复阻断发现。
- [x] 将验证通过的本任务改动应用回原应用目录；确认未覆盖外层仓库其它改动。
- [x] 重启原目录中的桌面服务，核验新建书籍、主智能体配置、子智能体团队、修改分析和《万象诸界》的文本/图片/账本。
- [x] 记录结果并交付；本次用户没有要求提交推送代码，完成后保留可查看的改动。
