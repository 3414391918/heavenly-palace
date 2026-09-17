---
审查状态: 已确认
来源追溯: 2026-09-17 用户范围说明；joy-desk@1edf4260a65423993e45f565b1148e160667e3d6；具体来源见本页“来源与关联”
tags:
  - 开发文档
  - JingleAI
  - 项目架构
aliases:
  - JingleAI云后台
  - 小叮当管理后台
创建时间: 2026-09-17T14:51
修改时间: 2026-09-17T17:43
代码版本: 1edf4260a65423993e45f565b1148e160667e3d6
---
# JingleAICloud与管理后台架构

> [!info] 已确认 · 本地源码快照
> 核对日期：2026-09-17；joy-desk 提交 `1edf4260a654`。本文已于 2026-09-17 经用户审查确认，区分代码事实、仓库规范和目标设计；未核验线上部署、当前桌面实例或真实端到端运行。

## 一个应用，两种主要入口

`apps/cloud` 包含 Java 业务后端和 `web/` 管理界面。用户提供的管理入口为：预发 [Cloud 管理后台](https://xdd-cloud-pre.jd.com/dashboard)，生产 [Cloud 管理后台](https://xdd-cloud.jd.com/dashboard)。这两个 URL 是管理页面入口，不能据此把 Cloud 理解为只服务管理员的后端。

| 部分 | 当前技术事实 | 主要定位 |
|---|---|---|
| Java 服务 | Java 17、Spring Boot `3.5.16`、MyBatis-Plus、Flyway、MySQL/Redis 相关依赖 | 业务规则、权限、对话权威、运行控制 |
| 管理前端 `web/` | Vue 3、Vue Router、Pinia、Element Plus、Vue CLI | 管理和运营 UI |
| `build-agent/`、`ops-agent/` | 局部规则标明 Node ESM 子项目 | 配套运维构建单元；本轮未展开 |

`web/README.md` 仍写 Vue 2/Element UI；本次按 `web/package.json` 的 Vue 3/Element Plus 纠正入门口径。

## 业务域地图

以下是本轮关心的领域边界，不是全部功能清单。Java 根包为 `com.jdt.joydesk`。

| 域/目录                           | 负责什么                                               | 可核对入口                                                                        |
| ------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `clientrelay`                  | 客户端 BFF、Turn/Run 准备、运行观察与控制                        | `controller/ClientRelayController.java` 的 `/api/client`                      |
| `conversationauthority`        | 长期对话/消息/协作相关权威                                     | `CloudConversationAuthorityService`、`DesktopConversationAuthorityController` |
| `project`                      | 项目成员、权限、协作、待办等项目域                                  | `ProjectAclService` 与各领域 Controller；本轮仅定位                                    |
| `websocket`                    | 桌面/Web 通知与实时接入                                     | `WebSocketConfig`                                                            |
| `mobile`                       | 移动独立 WebSocket 通道及适配                               | `/ws/mobile` 注册与移动协议                                                         |
| `chatchannel/a2a/kernelrunner` | 云端内核连接与通信适配                                        | `KernelRunnerSocketClient`                                                   |
| `controlplane`                 | 自动化任务配置、时钟、occurrence、dispatch、delivery、projection | 现行自动化文档《111》；本轮未展开完整业务状态机                                                    |
| auth/tenant 等身份域               | 认证、租户与授权边界                                         | 当前应用规则；本轮未遍历所有实现                                                             |

Cloud 的 `ConversationAuthorityClient` 已注入本应用的 `CloudConversationAuthorityService`。类中仍有市场平台配置，不能因为看见 mkt 字段就推断会话权威仍在市场应用。当前根规则和迁移说明均要求对话/项目权威落在 Cloud。

## 客户端入口与执行端边界

- `/api/client/**`：Web SDK 使用的会话、资产和运行 API，Controller 包括 `turns:prepare`、Run cancel、SSE `events:stream`。
- `/api/conversation/**`：已核对的桌面对话权威入口。
- `/ws/client` 与 `/ws/notification`：当前共享 handler 的 Web/Desktop 实时入口；notification 保留兼容。
- `/ws/mobile`：独立移动入口；不能直接替换成 client/notification 帧。
- Cloud 到 Runner：使用 Socket.IO 适配与双方交互合同；Cloud 负责业务调度、身份与权限，Runner 负责执行宿主和隔离。

Cloud 上述对象与表的完整字段、租户鉴权覆盖和所有入口的对应关系未在本轮穷举，不能据此生成接口调用脚本。

## 管理前端与打包

`web/vue.config.js` 明确：

- 开发端口为 `8082`。
- 通用 API 代理默认是生产 Cloud；本地后端调试使用 `serve:local` 或显式 `API_TARGET`。
- 构建输出是 `../src/main/resources/static`，由 Java 服务静态资源目录承载，不是旧 README 声称的独立 `dist`。

`pom.xml` 默认 `skip.npm=true`，Maven 默认不保证重建管理 UI；需要按现有构建流程显式处理前端。本次未运行构建，避免把“后端包成功”误记为“管理界面一定最新”。

## 研发规范要点

按业务域组织 controller/service/model/dal；稳定输入输出用类型化 DTO，不以动态 Map/JSONObject 贯穿业务合同。Flyway 变更新增迁移，不修改已发布脚本、不在启动时隐式改表。WebSocket、任务和 HTTP 入口应复用同一业务状态机，事务、幂等和租户边界显式化。

继续阅读 [[JingleAI研发规范与协作流程]]；跨端消息与恢复见 [[JingleAI跨端通信与数据权威]]；云端执行与重试见 [[JingleAI云端执行架构]]。

## 来源与关联

- 工程入口：`AGENTS.md:6`。
- Cloud 规则：`apps/cloud/AGENTS.md:4`。
- Cloud Java 依赖：`apps/cloud/pom.xml:21`。
- 管理端技术栈与命令：`apps/cloud/web/package.json:26`。
- 管理端代理与产物：`apps/cloud/web/vue.config.js:4`。
- Cloud WebSocket 注册：`apps/cloud/src/main/java/com/jdt/joydesk/websocket/config/WebSocketConfig.java:51`。
- Cloud BFF 路由：`apps/cloud/src/main/java/com/jdt/joydesk/clientrelay/controller/ClientRelayController.java:100`。
- 桌面对话权威路由：`apps/cloud/src/main/java/com/jdt/joydesk/conversationauthority/controller/DesktopConversationAuthorityController.java:32`。
- Cloud 权威服务注入：`apps/cloud/src/main/java/com/jdt/joydesk/clientrelay/integration/ConversationAuthorityClient.java:88`。
- Cloud 到 Runner 连接层：`apps/cloud/src/main/java/com/jdt/joydesk/chatchannel/a2a/kernelrunner/KernelRunnerSocketClient.java:59`。
- 迁移历史与范围：`docs/design/conversation-authority-migration-from-skill-manager.md:3`。
- 自动化当前职责：`apps/desk/docs/核心技术文档/111.自动化控制面 desk-cloud 现状.md:11`。

源码版本见文档属性，来源路径与定位信息见本页。返回 [[JingleAI项目知识总览]]。
