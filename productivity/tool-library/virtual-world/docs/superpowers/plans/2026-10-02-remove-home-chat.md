# 移除首页聊天执行清单

**目标：** 从应用中移除首页独立聊天入口和浮窗。

**实现：** 删除 Renderer 专用功能，复用现有导航、工作台和创作智能体运行时。

**技术：** Vue、TypeScript、Vitest、electron-vite。

- [x] 校验、提交并推送现有代码：`678f00e`；667 个测试文件、3799 项测试及完整 `verify` 通过。
- [x] 清理 `LeftSidebar.vue`、`WorkspaceShell.vue`、`layoutFeatureNavigation.ts` 和两个延迟加载注册文件中的独立聊天接入。
- [x] 删除 `features/chat-assistant` 与专用功能测试，移除共享界面测试对已删组件的依赖。
- [x] 执行受影响测试、类型、格式、ESLint、Renderer 边界与构建检查。
- [x] 核验应用侧栏与其他主要入口。

## 验证结果

- 7 个受影响测试文件、54 项测试通过；完整类型检查、范围 ESLint、格式与 Renderer 边界检查通过。
- 构建通过，app-ready JavaScript 为 998,502 字节，独立聊天窗口产物为零。
- 删除组件触发热更新后，旧窗口留下空页面；完整退出应用及开发进程，再通过 `pnpm dev` 启动。
- 真实 macOS 页面为 `localhost:5173`，侧栏显示工作目录、自定义模型配置、智能体团队和更多功能，没有聊天入口。实际点击工作目录、智能体团队均正常显示对应页面。
- 前置代码已推送；本次聊天移除改动保留在工作树。
