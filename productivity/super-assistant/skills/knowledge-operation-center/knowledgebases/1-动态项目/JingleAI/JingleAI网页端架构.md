---
审查状态: 已确认
来源追溯: 2026-09-17 用户范围说明；joy-desk@1edf4260a65423993e45f565b1148e160667e3d6；具体来源见本页“来源与关联”
tags:
  - 开发文档
  - JingleAI
  - 项目架构
aliases:
  - 小叮当网页端架构
创建时间: 2026-09-17T14:51
修改时间: 2026-09-17T17:43
代码版本: 1edf4260a65423993e45f565b1148e160667e3d6
---
# JingleAI网页端架构

> [!info] 已确认 · 本地源码快照
> 核对日期：2026-09-17；joy-desk 提交 `1edf4260a654`。本文已于 2026-09-17 经用户审查确认，区分代码事实、仓库规范和目标设计；未核验线上部署、当前桌面实例或真实端到端运行。

## 定位

`apps/desk-web` 是用户指定的 JingleAI 网页客户端。主应用采用 React 19、TypeScript、Vite，入口为 `src/main.tsx`，通过 React Router 装配页面。仓库还存在 Vue/A2UI 相关依赖，不能因此把主应用归类为 Vue。

用户提供的入口：预发 [JingleAI Web](https://jingle-ai-t.jd.com/app)，生产 [JingleAI Web](https://jingle-ai.jd.com/app)。本次未登录或检查页面发布版本。

## 数据接入

![[JingleAI-Web接入图.svg]]

`src/lib/api.ts` 已核实以 `createCloudWebClient({baseUrl, auth, outbox, ...})` 创建客户端，并取得 conversations、projects、comments、assets、workspace、realtime 等 API。自有 IndexedDB outbox 实现用于待发送条目；它不是长期会话权威。

唯一数据面 SDK 包名为 `@jd/joydesk-cloud-web-sdk`，源码目录实际是 `packages/cloud-web-client`。它提供传输、协议投影、会话编排和可选领域入口，不提供 UI。不要与桌面 `.jdm` 模块 SDK 混用，也不要从 desk-web 直引底层 conversation-client/kernel-protocol 代替公开 SDK。

SDK README 描述的核心入口包括：

- `/api/client/conversations`：会话。
- `/api/client/conversations/{id}/messages`：权威历史。
- `/api/client/conversations/{id}/turns:prepare`：发起一轮。
- `/api/client/runs/{id}`、`events:stream`、`:cancel`、`:retry`：运行观察和控制。

Cloud Controller 中已找到 `/api/client`、`turns:prepare` 与 SSE 注册；本次只核对接入点，没有逐接口测试。

## 当前产品边界

- Web 固定使用云端 Kernel；store 的执行目标初始化和重置为 `cloud`。
- 不展示本机运行环境切换、设备管理或电脑专属工作台入口。
- `?desktop=1` 用于桌面登录授权回跳，不表示网页可以直接访问本机执行环境。
- README 规定客户端来源会话只读，继续工作需要新建个人 Web 对话；Web 不创建新的项目会话。历史可见不等于拥有跨环境续聊能力。

这些限制是当前 Web 产品合同，不应推广为移动端或整个系统的能力限制。

## 前端研发约束

| 场景 | 现有机制 |
|---|---|
| 视觉一致性 | 使用桌面设计 token、RelayIcon 和动效 token |
| 层级与浮层 | z-index 阶梯 token、`DwPopover` 与统一定位引擎 |
| 图标按钮提示 | `DwTooltip` 与 aria-label；不承诺未实现快捷键 |
| 确认与文字输入 | `useDestructiveConfirm`、`useTextPrompt` |
| 多层弹窗 | 显式处理下层 Esc 和焦点陷阱让位 |
| 反馈 | toast、持续错误横幅、局部重试按职责选一个 |
| 动效 | 常驻状态交给 CSS；挂载卸载按既有 motion 规范并尊重 reduced motion |

完整细则按改动场景查 `apps/desk-web/README.md`。文末“M1 进行中”等旧进度描述与同文现有能力、SDK 接入代码混杂，不作为当前发布成熟度的依据。

## 环境与依赖

开发代理由 `API_TARGET` 决定，发布产物 API 地址由 `VITE_API_BASE` 决定，不能互相替代。该应用使用 pnpm workspace 依赖，不在应用目录单独执行 `npm install`。命令和本地访问域名见 [[JingleAI环境与开发验证]]。

云端运行问题继续查 [[JingleAI云端执行架构]]；身份、历史和恢复语义见 [[JingleAI跨端通信与数据权威]]。

## 来源与关联

- 网页端约束与命令：`apps/desk-web/README.md:21`。
- 网页端依赖与命令：`apps/desk-web/package.json:39`。
- React 启动：`apps/desk-web/src/main.tsx:2`。
- Cloud SDK 接入：`apps/desk-web/src/lib/api.ts:210`。
- Web 执行目标：`apps/desk-web/src/lib/conversation-store.ts:267`。
- Web 开发代理：`apps/desk-web/vite.config.ts:17`。
- 浏览器 SDK 导出：`packages/cloud-web-client/package.json:10`。
- SDK 契约说明：`packages/cloud-web-client/README.md:63`。
- Cloud BFF 路由：`apps/cloud/src/main/java/com/jdt/joydesk/clientrelay/controller/ClientRelayController.java:100`。

源码版本见文档属性，来源路径与定位信息见本页。返回 [[JingleAI项目知识总览]]。
