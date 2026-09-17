---
审查状态: 已确认
来源追溯: 2026-09-17 用户范围说明；joy-desk@1edf4260a65423993e45f565b1148e160667e3d6；具体来源见本页“来源与关联”
tags:
  - 开发文档
  - JingleAI
  - 项目架构
aliases:
  - 小叮当移动端架构
创建时间: 2026-09-17T14:51
修改时间: 2026-09-17T17:43
代码版本: 1edf4260a65423993e45f565b1148e160667e3d6
---
# JingleAI移动端架构

> [!info] 已确认 · 本地源码快照
> 核对日期：2026-09-17；joy-desk 提交 `1edf4260a654`。本文已于 2026-09-17 经用户审查确认，区分代码事实、仓库规范和目标设计；未核验线上部署、当前桌面实例或真实端到端运行。

## 工程与技术栈

用户指定的目录为 `apps/mobile`，实际移动应用位于 `apps/mobile/app`。当前依赖声明为 React Native `0.81.5`、Expo `~54.0.25`、React `19.1.0`，使用 Expo Router。根 pnpm workspace 显式排除 `apps/mobile`，移动应用按自己的 npm 工程维护。

| 当前文件事实 | 值 |
|---|---|
| `app.json` 中显示名 | `JoyDesk` |
| slug / scheme | `joymobile` |
| Android package / iOS bundleIdentifier | `com.jdt.joymobile` |
| app/package 声明版本 | `1.0.7` |

这是源码配置，不代表已发布到手机上的品牌与版本。旧 README 标题、路径和产品名仍写 `mobile-lunel`/JoyMobile；协议里残留 `joyphone` 字样也不能据此判断应用目录。

## 本轮关注的结构

- `app/`：Expo 主应用及 lib、UI、原生模块集成。
- `app/lib/transport/cloud.ts`：Cloud WebSocket 连接、请求与重连。
- `app/lib/transport/cloudProtocol.ts`：帧合同、配对解析、协议类型。
- `app/lib/joydeskCloudConfig.ts`：Cloud 地址默认值、环境覆盖和本地配置键。
- `app/modules/joyphone-jd-login`、`joyphone-mobile-skill`：本轮仅定位到的原生模块，未展开其 Android 实现。
- `cli/`、`pty/`：README 所列可选 LAN IDE 工具与 Rust PTY；未作为本次移动主应用链路展开。

## 与 Cloud、桌面和云端执行的关系

移动端用 WebSocket 连接 Cloud `/ws/mobile`。`BackendType = 'desk' | 'cloud'` 表明协议区分桌面和云端执行目标；手机 UI 并不因此成为 Kernel Runner 的直接客户端。

配对对象包含 `pairingId`、`pairingCode`、`wsUrl` 等字段，支持 JSON 或带 `pair` 参数的链接。桌面生成的配对地址应优先使用；不能把某个默认 Cloud 域名硬当全部配对环境。

| 消息 | 基本结构 |
|---|---|
| 请求 | `id`、`type`、`payload` |
| 响应 | `type=mobile.res`、`id`、`ok`、`payload/error` |
| 事件 | `type=mobile.event`、`event`、`payload` |
| 当前 V2 协议标识 | `conversation-event-v2` |

Cloud 代码注册独立 `/ws/mobile` handler。注册注释明确它不复用 notification 的 outbox/广播语义；“统一对话权威”不等于所有终端传输帧完全相同。业务权限、设备在线和能力协商仍决定具体操作能否执行。

## 环境差异需要单独确认

当前源码内置兜底是 `wss://joydesk-pre.jdcloud.com/ws/mobile`，不是旧 README 中的 `wss://xdd-cloud-pre.jd.com/ws/mobile`。

- `EXPO_PUBLIC_JOYDESK_CLOUD_WS` 覆盖内置 WS 默认值。
- `EXPO_PUBLIC_JOYDESK_CLOUD_API` 可单独覆盖 API；未设置时从默认 WS 推导 HTTP(S) origin。
- 实际连接还与配对地址和持久化选择有关。本次没有读取用户手机配置或执行登录。

因此不能直接把用户给出的内场 Web/Cloud 环境套到移动默认环境。当前主要移动发行渠道、登录体系和环境映射仍需结合实际安装包、构建配置与配对地址核对。

## 开发与排查入口

从 `apps/mobile/app` 启动 Expo，或使用根脚本 `npm run dev:mobile`。弱网、会话历史和传输合同已有 `test:lib`、`test:robustness` 等脚本入口；本次未执行移动端测试或安装构建。

定位顺序：先核对环境/身份/执行目标，再检查 Cloud 连接与会话映射，最后进入目标运行时。不要把重新连接成功等同于历史、待发消息和执行终态都已恢复。

## 来源与关联

- 工作区边界：`pnpm-workspace.yaml:90`。
- 移动端历史说明：`apps/mobile/README.md:1`。
- 移动端技术栈与命令：`apps/mobile/app/package.json:90`。
- 移动端标识：`apps/mobile/app/app.json:3`。
- 移动端环境配置：`apps/mobile/app/lib/joydeskCloudConfig.ts:17`。
- 移动端帧与执行目标：`apps/mobile/app/lib/transport/cloudProtocol.ts:101`。
- 移动端 WebSocket：`apps/mobile/app/lib/transport/cloud.ts:246`。
- Cloud WebSocket 注册：`apps/cloud/src/main/java/com/jdt/joydesk/websocket/config/WebSocketConfig.java:51`。

源码版本见文档属性，来源路径与定位信息见本页。返回 [[JingleAI项目知识总览]]。
