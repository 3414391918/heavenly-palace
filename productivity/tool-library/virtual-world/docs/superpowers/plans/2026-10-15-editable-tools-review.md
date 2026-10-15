# Review

## 范围与证据

- BASE：`1655726`；HEAD：本次未提交工作区。
- 按 Council Review 技能执行相互隔离的作者审查轮次，未派发独立 reviewer。
- 正确性轮次：手动编辑入口、关联导航、模型调用保留、默认工具初始化及编辑保存。
- 合同/持久化轮次：Preload 双向 schema、工具目录路径、原文件格式复用、外部项目发现、独立运行副本。
- `pnpm verify` 通过：586 个测试文件、3154 条测试；格式、类型、ESLint、Renderer 边界、构建、独立工具冒烟通过。
- `pnpm smoke` 通过：真实 IPC 的工具编辑/保存/关联跳转/脚本文件创建/删除确认，模板图片，以及正文插画、角色资产相关回归。

## 已确认发现

- [Important] `useToolLibrary.ts` — 保存期间重复触发可能使用旧哈希，也可能丢失后续草稿。现已串行保存，保留较新编辑，并由重复保存/外部冲突测试验证。
- [Important] `tool-created-projects.ts` — 单个工具新建项目无法打开时可能阻断目录读取。现保留失败标记供下次重试，并继续其它项目；测试覆盖成功、失败、无标记旧目录及符号链接。
- [Important] `toolkit/src/workspace-engine.ts` — 完整读取同时指定非零 offset 时会产生截断内容的哈希。现完整读取始终从 0 开始，分页仅在 full:false 下使用。
- [Important] `packages/contracts/src/toolkit.ts` — create 的 schema 缺少独立 CLI 要求的 parentDirectory。现 schema 包含该字段。
- [Important] `shell/lifecycle.ts` — 未打开书籍时窗口聚焦只刷新资料库，无法发现外部新建小说。现聚焦统一刷新书籍目录与资料库。

## Push-back

- 保留独立模型 Runtime 和现有领域引擎；声音设计使用无创作空间上下文的 session.prompt，Main 根据设置的默认模型解析请求。移除这些共享实现会破坏仍保留的声音功能。
- CLI Markdown 哈希是额外的写前检查；本次沿用小说文件既有写入语义，没有宣称跨进程文件锁或数据库式隔离。结构操作仍使用原事务及 expectedImpact。

## 剩余风险或用户决策

- 本轮验证为本机开发构建和独立工具副本，没有生成跨平台安装包。
- 默认工具只首次复制。后续用户修改会被保留，产品升级不能自动覆盖其脚本。
- 作品和工具属于用户工作目录，继续不纳入代码仓库；迁移电脑需同时迁移工作目录。

## 结论

ready。验证命令：`pnpm verify`、`pnpm smoke`。无阻断发现。
