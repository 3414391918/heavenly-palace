---
审查状态: 已确认
来源追溯: 2026-09-18 JoyDesk Harness 规范整理；AGENTS.md、harness-workflow、Harness README、任务 schema、gitflow、Council、测试与打包清单，详见正文来源
tags:
  - 开发文档
  - JingleAI
  - Harness
  - 研发规范
aliases:
  - JingleAI Harness规范
  - 小叮当Harness工作流
创建时间: 2026-09-18T14:14
修改时间: 2026-09-18T14:41
代码版本: feature/202609@b48f7cc068b7f7debe5d591e303db89888911d4a
---
# JingleAI Harness 研发流程与规范

> [!info] 范围与依据
> 本文汇总 JoyDesk 仓库中的 Harness 研发规范，供 JingleAI 项目开发、接手任务和评审时查询。核验日期为 2026-09-18，分支为 `feature/202609`，提交为 `b48f7cc068b7f7debe5d591e303db89888911d4a`。执行任务时仍应读取当时的 `AGENTS.md`、适用规则及 Harness 数据；本文中的命令是使用示例，本次整理没有执行任务创建、状态推进、评审、打包或集成。

## 1. 仓库中的三种 Harness 含义

| 含义 | 入口 | 阅读目的 |
| --- | --- | --- |
| 研发任务管理 | `docs/ai/rules/harness-workflow.md`、`harness/README.md` | 决定是否登记任务、保留哪些决策、如何验证与交接；本文主要范围 |
| Agent 的运行支撑体系 | `docs/ai/auto-test/harness-architecture-understanding.md` | 理解文件系统、工具、上下文和编排怎样支撑模型；属于理念性参考 |
| 自动化测试名称 | 根 `package.json` 中的 `verify:harness` | 执行 JingleAI 应用的 `test:harness`，与 Harness 任务台账校验不是同一件事 |

仓库已有 [[JingleAI研发规范与协作流程]] 概览；本篇补充 Harness 的执行细节。项目入口见 [[JingleAI项目知识总览]]，本地运行与验证见 [[JingleAI环境与开发验证]]。

## 2. 先判级，按风险保留过程信息

依据：`docs/ai/rules/harness-workflow.md` 的“先判级，再读取”。

| 等级 | 适用情况 | 最小产物 |
| --- | --- | --- |
| T0 | 单会话、边界清楚，不涉及公开契约、持久化、安全或架构风险 | 不登记 Harness；代码、相称的测试与 Git 记录即可，也不需要预读 Harness 文档 |
| T1 | 跨天、跨会话、需要交接，或需要保留产品／技术决策 | 任务 JSON 与 `01-planning.md`；范围和验证计划可写在 planning 中 |
| T2 | 公开 API／协议、持久化语义、安全边界、跨模块架构重构、umbrella、多人／多 Agent 并行，或用户明确要求完整流程 | T1 产物，加 `02-contract.md`、`03-progress.md`、`04-review.md`，并触发 Council 评审 |

- 按最高风险判级，不能用修改文件数量替代风险判断。
- 执行中发现风险升级，先补齐对应等级的产物，再继续。
- **T0／T1／T2 是过程与风险等级；任务 JSON 的 P0／P1／P2／P3 是优先级，两者不能互换。**
- 本次工作是在仓库外整理知识，不构成一次仓库开发任务，不创建 Harness 条目。

## 3. 数据与规则各自只有一个权威入口

| 内容 | 权威来源 | 使用要点 |
| --- | --- | --- |
| 当前集成主干 | `harness/INDEX.json#trunk` | 2026-09-18 快照为 `feature/202609`；以后使用时重新读取，不能按月份猜测 |
| 活跃任务 | `harness/tasks/<id>.json` | 一任务一文件；不把整个台账灌入上下文 |
| 字段、约束与实际状态行为 | `harness/FEATURES.schema.json`、`scripts/harness.mjs` | schema 定义结构，CLI 执行状态变更与校验 |
| 任务分级和阶段要求 | `docs/ai/rules/harness-workflow.md` | 判断需要留下多少过程信息 |
| CLI 用法 | `harness/README.md` | 查询、创建、认领、推进、归档 |
| Git、worktree、提交与集成 | `docs/ai/rules/gitflow.md` | 不从 Harness 生命周期推导 Git 操作授权 |
| Council 执行方法 | `docs/ai/skills/council-review/SKILL.md` | `docs/ai/rules/council-review.md` 仅作兼容入口 |

目录补充：

- `harness/features/<id>/` 保存阶段文档。
- `harness/FEATURES.json` 只是兼容标记，不是活跃任务台账；`FEATURES.archive.json` 保存归档任务。
- `harness/PROGRESS/` 是可选个人汇总，不替代任务事实。
- 日常优先通过 `pnpm harness ...` 操作，不手工维护聚合台账，也不为通过校验而放宽 schema。
- `docs/harness-工作流-同步说明.md` 是路由说明；具体行为应追溯到上表的当前来源。

## 4. T1／T2 的日常执行顺序

### 4.1 先读现场和目标任务

先按根 `AGENTS.md` 查看用户目标、`git status --short --branch` 和本任务 diff，保护其他会话的改动。以下变量均为占位符，需要按真实任务填写；`TRUNK` 必须读取当前 INDEX，`SHA` 必须对应实际提交。

```bash
pnpm harness next --json
pnpm harness list --status todo --assignee "$ASSIGNEE" --json
pnpm harness show "$TASK_ID" --json
pnpm harness show "$TASK_ID" --docs --json
```

通常先看任务 JSON，继续该任务时再按需加 `--docs`，不用预读所有任务与历史文档。

### 4.2 建立任务并认领

```bash
pnpm harness create "$TASK_ID" --title "任务标题" --scope "$SCOPE" --priority P1
pnpm harness claim "$TASK_ID" --branch "$TASK_BRANCH" --assignee "$ASSIGNEE"
```

创建任务后确保 planning 按等级补齐；不要仅凭 `create` 成功就认为规划已完成。认领记录负责人、分支和开始时间。`--worktree` 只在确实需要隔离时使用，具体约束见第 7 节。

### 4.3 实施、阻塞、评审、关闭

```text
todo → in_progress → review → done
                  ↘ blocked
```

```bash
pnpm harness block "$TASK_ID" --reason "实际阻塞原因"
pnpm harness review "$TASK_ID" --pr-url "local-merge://$TRUNK@$SHA"
pnpm harness close "$TASK_ID" --commit "$SHA" --pr-url "local-merge://$TRUNK@$SHA"
pnpm harness validate
```

这组命令展示不同状态的操作，不应无条件从上到下执行。没有阻塞就不调用 `block`；未满足完成条件就不调用 `close`。评审地址也可以是真实远端 MR URL；`local-merge://` 只是留痕地址，本身不会执行合并。

完成前必须有验收依据、实际验证结果、真实提交，以及已处理的评审结论。`close` 会执行相应检查，并归档符合条件的完成项；不能手工伪造 `passes=true` 来绕过验证。

## 5. 阶段文档写什么

阶段文档放在 `harness/features/<id>/`，保留决策、证据和交接信息，不复制聊天记录、完整终端流水或大段源码。

| 文档 | 何时需要 | 应保留的信息 |
| --- | --- | --- |
| `01-planning.md` | T1／T2 | 背景、目标、非目标、方案、验收条件、验证计划 |
| `02-contract.md` | T2 | 允许改动、禁止改动、不变量、完成门 |
| `03-progress.md` | T2 | 已验证结果、偏差、关键决策、阻塞、接手所需信息 |
| `04-review.md` | T2 | 评审范围、证据、确认发现、处置、反驳依据、剩余风险、结论 |
| `05-postmortem.md` | 有复杂失败、事故或值得复用的教训时 | 原因、有效处置、预防措施；不是每个任务必填 |
| `06-handoff.md` | umbrella 子任务存在真实下游依赖时 | 交付接口、依赖条件、验证证据和接手要点 |

说明尽量引用代码、测试、提交与契约。涉及安装包、依赖、原生模块、资源或发布链路时，把适用的打包影响评估写入 planning／contract。

### 台账校验要点

| 项目 | 核心约束 |
| --- | --- |
| `id` | kebab-case，与任务分支机械对应 |
| `in_progress` | 负责人、分支、开始时间齐备 |
| `review` | 提供评审地址 `pr_url` |
| 普通任务 `done` | `passes=true`、完成时间、至少一个真实提交记录 |
| umbrella `done` | 协调型父任务按 schema 豁免提交记录要求，仍需通过验证并记录完成时间 |
| `blocked` | 记录负责人；使用 CLI 写明阻塞原因 |
| `depends_on` | 引用存在的任务，上游未完成时不能启动下游 |
| `docs_status` | 按实际进度与适用性填写 `pending`／`in_progress`／`ready`／`not_needed`；具体字段受 schema 约束 |

`passes=true` 只允许出现在 `review`／`done`。台账结构合法不等于业务验收通过，阶段状态也不能替代真实文档与验证证据。

## 6. T2 的 Council 评审

Council 用于获得独立、可核验的技术判断，适用于公开契约、持久化、安全边界、跨模块架构、umbrella／并行集成，以及用户明确要求的 Council。普通 T0／T1 文案、格式、常规依赖维护或测试调整，若没有相应风险，用自查和目标测试即可；文档若定义了实际运行契约，仍按风险判断。

默认选择两个互补视角：

1. **正确性与简洁性**：数据流、边界、失败路径、是否引入无必要抽象。
2. **契约与验证**：兼容性、不变量、迁移、测试缺口。

安全、持久化或跨运行时风险可增加第三个视角；只有多个独立高风险域确有需要时才增加第四个，不以人数凑流程。

执行要求：

- 明确工作目录、BASE／HEAD、关注路径与契约；reviewer 独立读取真实 diff、测试和局部规则，不预先喂给作者或其他 reviewer 的结论。
- 发现必须说明严重性、触发场景、文件行号或契约证据，以及修复方向；没有阻断发现就如实记录，不制造问题数量。
- 负责人复现、核验、去重，并记录采纳、拒绝的技术依据或需要用户决策的事项。
- 关键／重要发现必须修复并验证，或由负责人明确接受且记录技术依据；修复后按原审查视角复核。
- 只有可用且已获授权时才并行派发 reviewer；否则采用隔离的独立审查轮次或人工 reviewer，不声称进行了不存在的并行评审。
- `04-review.md` 给出 ready／not ready 及验证证据。结论依赖证据，不按票数、分数或角色权威决定；一个未处理的关键问题就可以阻断完成。

## 7. Git 与 worktree 的配套约束

依据 `docs/ai/rules/gitflow.md`，Harness 登记不自动授权提交、推送或合并。

- 新任务从当前 `INDEX.json#trunk` 建任务分支，格式为 `<type>/<YYYYMMDD>-<slug>`；类型包括 `feature`、`fix`、`hotfix`、`refactor`、`docs`。有缺陷单时可采用 `fix/JBUG-12345-YYYYMMDD-<slug>`。
- Harness id 把分支名中的第一个 `/` 替换为 `-`。不直接在集成主干开发，也不对主干 force push。
- 不通过 stash、restore、clean 等动作覆盖其他会话的工作；已经在本任务独立 worktree，就留在该目录工作。
- worktree 仅用于真实并行、长期挂起或用户明确要求。仓库规则要求创建前获得用户确认；已有明确授权应结合当前会话判断，不机械重复询问。
- `claim --worktree` 不会切换后续 shell 的工作目录，必须进入输出的目录再修改文件。
- 仓内 worktree 禁止运行 `pnpm install`、`pnpm add`、`pnpm up` 等共享依赖写操作，依赖变更回主工作区处理；清理前核对未提交与未推送内容。
- 每个提交是一个语义单元，写清变更与验证，不添加工具署名，不用 `--no-verify` 绕门禁，不提交密钥、生产数据和个人绝对路径。
- Push 前核验目标远端。用户要求提交／推送不等于同意合入主干；MR 仅在团队需要异步评审或 CI 时使用。

得到对应集成授权后，仓库提供以下入口：

```bash
bash scripts/integrate-to-trunk.sh "$TASK_BRANCH"
# 仅在已明确需要不推送的集成方式时使用：
bash scripts/integrate-to-trunk.sh "$TASK_BRANCH" --no-push
```

这两行是互斥使用示例。脚本从 INDEX 读取目标主干并使用 `--no-ff`；工作区须干净，主干不能被其他 worktree 占用。失败时先处理真实原因，不用手工强推绕过流程。

## 8. 验证与打包影响

### 8.1 验证按风险选择

依据 `docs/ai/rules/testing-conventions.md`：缺陷修复需要能复现原问题的回归证据；新增行为验证验收条件；纯重构保护原行为；文档修改检查静态内容、链接或 schema。公开契约、持久化、安全、并发和跨进程风险不能只靠手工烟测。

从目标目录和最小相关测试开始，使用仓库测试入口；不裸跑根目录 Vitest 导致误扫其他 worktree。记录实际命令、结果与环境，未执行的检查必须注明原因，不能写成通过。

| 命令 | 验证对象 | 不能据此宣称 |
| --- | --- | --- |
| `pnpm harness validate` | Harness 台账结构与约束 | 产品功能或回归测试已通过 |
| `pnpm test:harness-cli` | Harness CLI 自身测试 | 所有 JingleAI 业务行为已通过 |
| `pnpm verify:harness` | 转发 JingleAI 应用的 `test:harness` | Harness 台账或全部产品测试已通过 |
| `pnpm harness run -- <测试命令>` | 在可用 runner／宿主环境中执行指定命令 | 所有情况下都使用 Docker |

`harness run` 的环境以实际输出为准：当前分支存在 Docker runner 时可进入 `/workspace`，否则使用宿主回退。需要预览时用 `--dry-run`。

### 8.2 打包相关变更的附加要求

`harness/PACKAGING-IMPACT-CHECKLIST.md` 强调：开发模式可运行，不足以证明安装包可运行。

命中依赖／锁文件／workspace、原生或平台二进制、安装更新配置、资源拷贝、运行路径／环境变量、后端或 Gateway 启动、依赖系统 PATH 或开发期工具等触发器时，应补充打包影响评估：

| 维度 | 必须回答的问题 |
| --- | --- |
| 产物与平台 | 影响 desk／joyclaw／private 哪条产物线，以及 Windows／macOS／Linux 哪些平台？ |
| 依赖和资源 | 变更落在 asar、unpacked、node-packages、portable 还是 extraResources？安装后从哪里读取？ |
| 安装与更新 | 安装器、压缩包、首次启动、更新 manifest、版本或 edition 是否受影响？ |
| 校验链路 | 构建、资源验证、原生模块、运行时烟测、发布脚本是否需要同步调整？ |
| 验证证据 | 实际执行了哪些命令？哪些平台未验证，需要在哪台机器补齐？ |
| 风险与回滚 | 失败如何发现，怎样恢复可用产物？ |

相关入口包括 `pnpm run verify:packaging-matrix`、`scripts/verify-runtime-packaging-matrix.cjs`、`apps/desk/scripts/verify-packaged-app.sh`、清单所列的 `verify-packaged-runtime.cjs` 和 `scripts/verify-packaged-runtime-evidence.cjs`；按实际产物链选择，不默认全部运行。改动资源形态或校验语义时，必须同步依赖同一假设的各个 verifier。开发依赖图与生产依赖图不一致、验证脚本预期与产物格式脱节、路径或原生架构错误，都是清单明确提示的漏项。

涉及发布编排、远程打包或三产物线时，继续读取 `docs/ai/skills/jingle-packaging/SKILL.md`；涉及 Office／PDF／运行时依赖或私有化断网部署时，继续对照 `harness/OFFLINE-INTRANET-DEPLOYMENT-CHECKLIST.md`。这些是打包清单给出的后续入口，本次未展开整理其具体规范。

## 9. Umbrella、归档与恢复

- 只有能独立交付、验证并存在真实依赖的子任务才拆 umbrella。父任务维护依赖、检查点和集成关系，不承载业务代码；高度重叠修改同一批文件时，不为形式上的并行硬拆。
- 子任务通过 `umbrella_id`／`depends_on` 关联；父任务记录 children、integration branch、merge target 等适用字段。下游需要实际交接时补 handoff。
- 归档和清理优先用 CLI，先检查 `archive --dry-run`、`gc-stale --dry-run`、`cleanup-worktrees --dry-run` 的影响，再决定执行。
- 常规写操作默认带安全 GC，可用 `--no-gc` 跳过；归档任务时保留阶段文档。
- `cleanup-worktrees` 默认仅处理可证明已完成的任务；`--remove-orphan` 会扩大范围，不能未经核对就清理未提交或未推送的工作。
- `migrate-storage` 用于旧 worktree 的单文件台账迁移，当前仓库已是一任务一文件，无需例行执行。
- 需要恢复任务时，按 README 从 archive 恢复完整任务对象到 `tasks/<id>.json`，再运行 `validate`／`show` 核验；不能只补 id 或凭印象重建状态。

## 10. Agent Harness 理念的适用边界

仓库另有 2026-05-29 创建的《Harness 架构理解：Agent = Model + Harness》。它把模型之外的支撑能力概括为六类：

| 组件 | 参考文档表达的作用 |
| --- | --- |
| 文件系统 | 保存工作成果与可恢复状态，配合版本管理 |
| Bash 与沙箱 | 执行动作、运行验证并限制执行边界 |
| AGENTS.md／记忆 | 按任务加载项目规则和领域知识 |
| Web Search／MCP | 接入外部信息与工具 |
| 上下文工程 | 渐进加载、压缩与卸载，把大输出保留为可引用资料 |
| 编排／Hooks | 分配工作，在明确节点执行确定性检查 |

System Prompt 在该文中承担角色、领域知识、安全约束和组件行为规范的连接作用。这部分帮助理解设计思路，**不能据此认定六类能力都已在当前版本完整落地，也不能替代现行研发规则**。原文末尾的“JoyDesk 现状对照”是创建时的评估，未经本次代码逐项核验；文中的外部效果比例与概括性判断不作为本知识条目的已证事实。

## 11. 来源与追溯

以下路径均相对于 `/Users/wangshaofan.7/work/joy-desk`，内容基于本篇开头记录的提交；行号仅为此次快照定位。

| 来源 | 定位 | 支撑内容 |
| --- | --- | --- |
| `AGENTS.md` | 开始工作、三条红线 | 按需读取、现场保护、T0 边界、AI 配置单源 |
| `docs/ai/rules/harness-workflow.md:5` | 单源、分级、阶段文档、完成标准 | 本篇第 2～6 节的任务规范 |
| `harness/README.md:7` | 数据单源、日常命令、Umbrella、归档与维护 | 命令示例、状态推进、维护要求 |
| `harness/FEATURES.schema.json` | feature 定义及状态条件 | 字段、优先级、状态约束与 umbrella 豁免 |
| `harness/INDEX.json` | trunk | 当前集成主干快照 |
| `docs/ai/rules/gitflow.md:5` | 分支、worktree、Commit、Push 与集成 | 分支对应、工作区保护、Git 操作边界 |
| `docs/ai/skills/council-review/SKILL.md:13` | 触发、Reviewer、执行、输出合同 | 独立评审、发现处置及证据要求 |
| `docs/ai/rules/testing-conventions.md` | 风险与验证、测试入口 | 与风险相称的验证、真实结果记录 |
| `harness/PACKAGING-IMPACT-CHECKLIST.md:10` | 触发器、脚本、评估维度 | 安装包与运行时验证要求 |
| `package.json:131` | harness、test:harness-cli、verify:harness 等 scripts | 区分任务 CLI 与不同测试命令 |
| `docs/ai/auto-test/harness-architecture-understanding.md:34` | 六大组件、System Prompt、现状对照 | 理念性参考；不作为当前实现与强制流程的证据 |

本篇对命令和字段的说明来自规则、README、schema 与 scripts 声明，本次没有逐行审计 `scripts/harness.mjs` 的实现。实际 CLI 行为若与文档冲突，应回到当前源码和最小复现核实，再修订知识。
