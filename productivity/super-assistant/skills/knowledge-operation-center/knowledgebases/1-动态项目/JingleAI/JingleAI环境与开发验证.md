---
审查状态: 已确认
来源追溯: 2026-09-17 用户范围说明；joy-desk@1edf4260a65423993e45f565b1148e160667e3d6；具体来源见本页“来源与关联”
tags:
  - 开发文档
  - JingleAI
  - 项目架构
aliases:
  - 小叮当环境与开发验证
创建时间: 2026-09-17T14:51
修改时间: 2026-09-17T17:43
代码版本: 1edf4260a65423993e45f565b1148e160667e3d6
---
# JingleAI环境与开发验证

> [!info] 已确认 · 本地源码快照
> 核对日期：2026-09-17；joy-desk 提交 `1edf4260a654`。本文已于 2026-09-17 经用户审查确认，区分代码事实、仓库规范和目标设计；未核验线上部署、当前桌面实例或真实端到端运行。

## 用户确认的环境入口

| 用途 | 预发 | 生产 | 对应工程 |
|---|---|---|---|
| 网页客户端 | [JingleAI Web 预发](https://jingle-ai-t.jd.com/app) | [JingleAI Web 生产](https://jingle-ai.jd.com/app) | `apps/desk-web` |
| 管理后台 | [Cloud 预发后台](https://xdd-cloud-pre.jd.com/dashboard) | [Cloud 生产后台](https://xdd-cloud.jd.com/dashboard) | `apps/cloud` / `web` |

来源：用户于 2026-09-17 给出的项目范围。预发后台链接原文末尾的中文逗号按标点去除。未做在线访问、登录、健康检查或发布版本比对。

桌面端安装包渠道、移动端发行环境、Runner 当前部署入口及负责人未由用户明确；本轮不从域名相似性或旧文档推断为已确认环境。

## 工具链与包管理

- 根 `package.json`：Node `>=24`，packageManager 为 pnpm `10.33.0`（manifest 中还附完整校验值）。
- 根 pnpm workspace 收录主要 apps/packages 及 desk 的嵌套 workspace。
- `apps/mobile` 显式排除，主应用从 `apps/mobile/app` 使用 npm/Expo。
- `apps/cloud` 后端按 Maven/Java 17；`apps/cloud/web` 单独有前端 manifest，不被根 `apps/*` glob 当成嵌套 workspace。
- `apps/desk-web` 依赖 `workspace:*` SDK，不能在该应用目录单独 `npm install`。
- 仓内 worktree 按规则不执行 pnpm 安装/升级，以免改写共享依赖。

这里记录工程要求，没有检查本机安装的 Node/Java/pnpm 是否匹配，也没有安装任何依赖。

## 常用入口命令

除明确标注的子目录命令外，下表均从 joy-desk 根运行。它们来自当前 manifest/规则，本轮只核对存在和语义，**没有执行启动、测试、构建或部署**。

| 目的 | 命令 | 条件/说明 |
|---|---|---|
| 桌面开发 | `npm run dev:desk` | 根脚本设 dev profile，后端端口 7889、前端 5174；不能据此推断已打开桌面进程端口 |
| Web 对本地 Cloud | `pnpm --filter @joydesk/desk-web dev` | 默认 API_TARGET 指向 127.0.0.1:8081 |
| Web 对预发 Cloud | `pnpm --filter @joydesk/desk-web dev:pre` | 内场工作台为 `https://local.jd.com:5189/app`；需相应本机域名解析与开发 TLS |
| Web 验证/产物 | `pnpm --filter @joydesk/desk-web test`；`build:pre` 或 `build` | 对应测试/预发构建/生产构建，不代表发布 |
| Runner 开发 | `pnpm --filter @joydesk/kernel-runner dev` | 需 MySQL/Redis、执行宿主、模型与鉴权配置；见 Runner README |
| Runner 测试 | `pnpm --dir apps/kernel-runner run test:persistence` | 真实 sandbox/MySQL E2E 另按脚本前提执行 |
| 移动开发 | `npm run dev:mobile` | 转到 apps/mobile/app 的 Expo start |
| 移动验证 | 在 `apps/mobile/app` 执行 `npm run test:lib` 或 `npm run test:robustness` | 前者基础/传输/会话测试，后者弱网与历史一致性等 |
| 管理界面对本地后端 | `npm --prefix apps/cloud/web run serve:local` | API 指向 localhost:8081；管理 UI devServer 为 8082 |
| 管理界面构建 | `npm --prefix apps/cloud/web run build` | 输出到 Cloud 的 src/main/resources/static |
| Cloud Java 定向测试 | `mvn -f apps/cloud/pom.xml -Dtest=实际测试类 test` | 将占位名替换为目标测试，依赖前提看具体测试 |

Web 的发布构建入口还提供 `bash scripts/build-jingle-ai-web.sh`（在 Web README 中声明，产物 `.build/`）；本轮未审计或执行该脚本，不把它当通用部署步骤。Cloud 后端的环境启动 profile、密钥来源和部署平台待补专门操作手册。

## 配置优先级中的易错点

### Web：开发代理与发布配置不同

开发时 Vite 使用 `API_TARGET`，进程环境可覆盖 env 文件；打包时 `VITE_API_BASE` 注入浏览器产物。只修改 API_TARGET 不会改变已发布 JS 的 API 地址。预发/生产 env 语义与用户给出的 Cloud 域名一致。

### 管理前端：serve 默认可能访问生产

当前 `web/vue.config.js` 的通用 API 默认指向生产 Cloud。`serve:local` 才显式指向本地；需要预发时显式设 `API_TARGET`。README 中“前端默认代理 localhost”已过时。

### 移动：配对地址、环境变量、内置默认需分开

配对内容携带的 wsUrl 是连接来源之一；配置文件默认值由 EXPO_PUBLIC 环境变量覆盖。当前内置默认是商业化预发 joydesk-pre.jdcloud.com，旧 README 内场预发描述不适合作为当前唯一依据。

### 桌面：三条产品轴与环境轴

| 轴                                     | 控制内容                                      |
| ------------------------------------- | ----------------------------------------- |
| Edition：`JOYDESK_EDITION`             | 内场 desk、商业化 joyclaw、私有化 private 的品牌/菜单/能力 |
| Deployment：`JOYDESK_DEPLOYMENT`       | 私有化配置 overlay                             |
| LoginMode：`JOYDESK_LOGIN_MODE`        | 登录页、票据域和 cookieProfile                    |
| Build environment：`JOYDESK_BUILD_ENV` | 服务地址选预发或生产                                |

仓库规则写明 release/beta/prod 选生产，dev/test 等选预发；beta 不能被理解为自动访问预发。地址按 base → edition → deployment → env override 收敛。实际运行值未在本轮读取。

## 验证选择与结果记录

改动附近的最小测试先行；公开契约、数据模型、跨进程和安全变化再扩大到合同与真实路径。文档修改用链接/格式/来源检查即可，不强制启动全套系统。没有实际跑过的命令必须标“未执行”，不能用 manifest 中存在 test 脚本代替通过证据。

更多约束见 [[JingleAI研发规范与协作流程]]。尚未核验的环境事项已在本页相应章节注明。

## 来源与关联

- 工具链与根命令：`package.json:8`。
- 工作区边界：`pnpm-workspace.yaml:90`。
- 桌面依赖与命令：`apps/desk/package.json:314`。
- 网页端约束与命令：`apps/desk-web/README.md:21`。
- 网页端依赖与命令：`apps/desk-web/package.json:39`。
- Web 开发代理：`apps/desk-web/vite.config.ts:17`。
- Runner 依赖与命令：`apps/kernel-runner/package.json:36`。
- 移动端技术栈与命令：`apps/mobile/app/package.json:90`。
- 移动端环境配置：`apps/mobile/app/lib/joydeskCloudConfig.ts:17`。
- Cloud Java 依赖：`apps/cloud/pom.xml:21`。
- 管理端技术栈与命令：`apps/cloud/web/package.json:26`。
- 管理端代理与产物：`apps/cloud/web/vue.config.js:4`。
- Git 协作规范：`docs/ai/rules/gitflow.md:5`。
- 测试规范：`docs/ai/rules/testing-conventions.md:5`。
- 版本与登录配置轴：`docs/ai/rules/joydesk-edition-and-login-arena.md:1`。

源码版本见文档属性，来源路径与定位信息见本页。返回 [[JingleAI项目知识总览]]。
