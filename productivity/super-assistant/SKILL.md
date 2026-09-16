---
name: super-assistant
description: 面向影音创作、知识管理、研发与日常工作的通用工作台 Skill，提供本目录下各个子 Skill 的能力介绍与统一入口。用户希望通过 super-assistant 了解、选择或使用这些能力时使用。
---

# Super Assistant · 通用工作台

Super Assistant 是个人工作能力的统一入口，面向研发、剪辑创作、知识整理及后续扩展的各类工作。具体能力由 `skills/` 下的子 Skill 提供，各自维护操作说明、工具和资源。

当前阶段以能力目录为主：介绍各个 Skill 的用途、适用场景，并链接到它们的 `SKILL.md`。使用某项能力时按需读取对应说明。统一编排流程与自进化机制将在后续阶段扩展。

## 创作与媒体

| Skill | 主要作用 | 适用场景与产物 |
|------|----------|----------------|
| [editing-master · 影音剪辑](skills/editing-master/SKILL.md) | 创建和编辑本地剪映/CapCut 草稿，组织视频、音频、图片、文字和 SRT 字幕，设置裁剪、变速、转场、特效、贴纸及关键帧；支持素材时长分析和可用资源查询。 | 视频片段编排、配乐、图文视频、字幕制作与效果调整；主要产物是可导入剪映/CapCut 继续编辑的草稿项目。 |

## 知识管理

| Skill | 主要作用 | 适用场景与产物 |
|------|----------|----------------|
| [knowledge-operation-center · 知识管理](skills/knowledge-operation-center/SKILL.md) | 管理 Obsidian 知识库，将工作成果和外部资料整理为带来源、属性与双向链接的笔记；支持检索、查重、审查状态维护、更新、归位、归档和 Bases 视图。 | 查询历史知识、沉淀经验与决策、导入网站资料、整理待审草稿、维护项目或领域知识；也负责 Obsidian 安装后的初始化与 Git 多机知识维护。 |

## 研发与运行

| Skill | 主要作用 | 适用场景与产物 |
|------|----------|----------------|
| [code-operation-center · 代码分析](skills/code-operation-center/SKILL.md) | 从 Java 入口方法分析单应用或跨应用的上下游调用关系，追踪状态变化、执行时序、持久层以及 RPC、HTTP、MQ 边界。 | 代码定位、调用链研究、业务逻辑理解与影响面分析；产出带方法级证据、覆盖情况和未决项的可追溯分析文档。 |
| [log-operation-center · 日志查询](skills/log-operation-center/SKILL.md) | 通过 Digger 或行云实例查询生产、预发和测试环境的历史日志、实时日志、启动日志及运行时配置。 | 按 traceId 或关键词追踪请求，排查业务异常、启动失败、配置未生效和 JSF 接口异常，为问题定位提供运行证据。 |
| [data-operation-center · 数据查询](skills/data-operation-center/SKILL.md) | 按应用和部署环境定位数据库或缓存，查询业务数据与状态。 | 核对数据库记录、缓存内容和业务状态，辅助解释接口结果或排查数据不一致。 |
| [equity-operation-center · 权益营销后台](skills/equity-operation-center/SKILL.md) | 处理权益营销后台的查询与操作，区分测试、预发和生产环境。 | 查询或维护活动、奖品、渠道和规则等平台配置，核对营销业务的配置情况。 |
| [ducc-operation-center · DUCC 配置中心](skills/ducc-operation-center/SKILL.md) | 提供测试、预发和生产环境的 DUCC 配置平台入口，用于应用配置相关操作。 | 查询、核对配置项和开关，按具体任务处理相应环境的配置。 |
| [jmq-operation-center · 消息队列](skills/jmq-operation-center/SKILL.md) | 在 JMQ 平台处理消息队列相关查询与操作，识别消息的生产者和消费者及其关联应用。 | 查找消息由谁发送、由谁消费，核对 Topic、订阅关系和消息流向，辅助分析异步业务链路。 |
| [mock-operation-center · 接口 Mock](skills/mock-operation-center/SKILL.md) | 在 Mock 平台配置接口、方法、依赖坐标和返回模板，并通过环境中的接口别名接入模拟服务。 | 联调时模拟依赖接口返回，为正常、异常或边界场景准备可控的测试输入。 |
| [test-operation-center · 需求测试](skills/test-operation-center/SKILL.md) | 使用 DeepTest 等测试入口验证需求，并借助测试辅助工具准备活动、奖品状态等测试条件。 | 需求测试、接口联调和结果验证；执行前需明确涉及应用及其测试环境。 |
| [deploy-operation-center · 开发交付与部署](skills/deploy-operation-center/SKILL.md) | 处理前端本地启动与依赖问题、单元测试、Git 分支与提交合并、Maven 公共包发布、前后端构建部署，以及配置和 JSF 生效检查。 | 开发完成后的交付、提交推送、公共包升版、环境发布、部署故障排查与部署后验证。 |
