---
name: super-assistant
description: 面向影音创作、知识管理、研发与日常工作的通用工作台 Skill，提供本目录下各个子 Skill 与研发平台知识文档的能力介绍与统一入口。用户希望通过 super-assistant 了解、选择或使用这些能力时使用。
---

# Super Assistant · 通用工作台

Super Assistant 是个人工作能力的统一入口，面向研发、剪辑创作、知识整理及后续扩展的各类工作。通用工作流程由 `skills/` 下的子 Skill 提供，各自维护操作说明、工具和资源；平台入口、环境资料及具体操作手册保存在知识库中。

当前阶段以能力目录为主：介绍各个 Skill 的用途、适用场景，并提供平台知识的查阅入口。使用某项能力时按需读取对应 Skill 或下方知识文档。统一编排流程与自进化机制将在后续阶段扩展。

## 创作与媒体

| Skill | 主要作用 | 适用场景与产物 |
|------|----------|----------------|
| [editing-operation-center · 影音剪辑](skills/editing-operation-center/SKILL.md) | 创建和编辑本地剪映/CapCut 草稿，组织视频、音频、图片、文字和 SRT 字幕，设置裁剪、变速、转场、特效、贴纸及关键帧；支持素材时长分析和可用资源查询。 | 视频片段编排、配乐、图文视频、字幕制作与效果调整；主要产物是可导入剪映/CapCut 继续编辑的草稿项目。 |

## 知识管理

| Skill | 主要作用 | 适用场景与产物 |
|------|----------|----------------|
| [knowledge-operation-center · 知识管理](skills/knowledge-operation-center/SKILL.md) | 管理 Obsidian 知识库，将工作成果和外部资料整理为带来源、属性与双向链接的笔记；支持检索、查重、审查状态维护、更新、归位、归档和 Bases 视图。 | 查询历史知识、沉淀经验与决策、导入网站资料、整理待审草稿、维护项目或领域知识；也负责 Obsidian 安装后的初始化与 Git 多机知识维护。 |

## 研发与运行

| Skill | 主要作用 | 适用场景与产物 |
|------|----------|----------------|
| [code-operation-center · 代码分析](skills/code-operation-center/SKILL.md) | 从 Java 入口方法分析单应用或跨应用的上下游调用关系，追踪状态变化、执行时序、持久层以及 RPC、HTTP、MQ 边界。 | 代码定位、调用链研究、业务逻辑理解与影响面分析；产出带方法级证据、覆盖情况和未决项的可追溯分析文档。 |
| [log-operation-center · 日志查询](skills/log-operation-center/SKILL.md) | 通过 Digger 或行云实例查询生产、预发和测试环境的历史日志、实时日志、启动日志及运行时配置。 | 按 traceId 或关键词追踪请求，排查业务异常、启动失败、配置未生效和 JSF 接口异常，为问题定位提供运行证据。 |
| [deploy-operation-center · 开发交付与部署](skills/deploy-operation-center/SKILL.md) | 处理前端本地启动与依赖问题、单元测试、Git 分支与提交合并、Maven 公共包发布、前后端构建部署，以及配置和 JSF 生效检查。 | 开发完成后的交付、提交推送、公共包升版、环境发布、部署故障排查与部署后验证。 |

## 研发平台知识

以下知识文档提供研发平台入口、环境说明和操作方法。遇到对应任务时，先读取表中指定章节，再结合当前应用、环境和实际页面执行；只加载本次相关内容。使用时核对文档的适用环境和证据边界。

| 任务 | 先读取的知识 | 内容 |
|------|--------------|------|
| 数据库或缓存查询 | [研发平台入口与环境 · 数据查询](skills/knowledge-operation-center/knowledgebases/2-长期领域/研发平台/研发平台入口与环境.md#数据查询) | 数据库平台入口、环境定位要求及缓存资料缺口。 |
| 权益营销后台操作 | [研发平台入口与环境 · 权益营销后台](skills/knowledge-operation-center/knowledgebases/2-长期领域/研发平台/研发平台入口与环境.md#权益营销后台) | 测试与生产入口、预发入口缺口及登录信息适用范围。 |
| DUCC 配置查询或操作 | [研发平台入口与环境 · DUCC配置](skills/knowledge-operation-center/knowledgebases/2-长期领域/研发平台/研发平台入口与环境.md#DUCC配置) | 测试与预发、生产的配置平台入口。 |
| JMQ 消息查询、生产方或消费方定位 | [研发平台入口与环境 · JMQ消息队列](skills/knowledge-operation-center/knowledgebases/2-长期领域/研发平台/研发平台入口与环境.md#JMQ消息队列) | 平台入口及环境区分要求。 |
| DeepTest 联调及测试数据准备 | [研发平台入口与环境 · DeepTest与测试辅助](skills/knowledge-operation-center/knowledgebases/2-长期领域/研发平台/研发平台入口与环境.md#DeepTest与测试辅助) | 测试站、主站及测试环境奖品、活动状态辅助入口。 |
| 接口 Mock | [接口Mock操作手册](skills/knowledge-operation-center/knowledgebases/2-长期领域/研发平台/接口Mock操作手册.md) | 接口、方法、POM、返回模板和环境别名接入步骤。 |

通过 knowledge-operation-center 的查询流程也可按平台名或原 Skill 名检索；修改、审查和归档这些资料时使用知识管理 Skill。文档归位后同步维护此处入口。跨多种平台的任务分别查阅相关章节，既有代码分析、日志查询和部署流程继续使用上面的 Skill。
