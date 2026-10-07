# 正文新增插画实施计划

**目标：** 在正文原生右键菜单中添加插画，保存图片与相对引用，并立即在预览中显示。

**架构：** 沿用图片 IPC 与 Core 项目事务。插画 UI、原生菜单扩展和保存结果桥接各自独立，复用已有图片粘贴弹窗。

**技术：** Electron、Vue、TypeScript、Zod、sharp、项目事务、Vitest。

## 1. Core 与契约

- [x] 新建 long-project-store.chapter-illustrations.test.ts，使用 createFixture 与真实 PNG 验证 001/002、022 后续号、缺失引用占位、草稿保留、位置插入、旧正文拒绝、坏图及符号链接拒绝。
- [x] 运行定向 Vitest，确认新增方法缺失造成失败。
- [x] 在 long-chapter-image.ts 定义 long.addChapterImage：bookId、chapterCardId、pngDataUrl、content、expectedContent、offset。结果含 filename、content、selectionOffset 与 LongWriteDocumentResult。
- [x] 新增 chapter-illustrations.ts，规范路径加载章节、按数字名分配、PNG 解码、单个事务写图片/正文/索引/清单；复用 runExclusive 和事务冲突校验。
- [x] 接入 LongProjectStore、LongChapterImageService、Core handler、Main handler 和 Preload。配置命令与原图片命令保持兼容。
- [x] 运行 Core、契约与现有图片回归，确认新行为通过。

## 2. 原生菜单

- [x] 添加 nativeTextContextMenu 和 text-context-menu-items 的失败用例：无文字选择也有新增入口、其它文本框无入口、文档变化后拒绝、保留引用与撤销操作。
- [x] TextContextMenuAction 增加 addIllustration；上下文增加可选 canAddIllustration。独立注册插画扩展，与原引用扩展并存，所有处理仍经 Renderer 校验。
- [x] Main 在可编辑非密码且已注册的正文中显示新增插画，调用 Renderer 回调。
- [x] 运行菜单定向回归。

## 3. 编辑器与粘贴

- [x] 新建 useChapterIllustrationInsertion.test.ts，覆盖确认时保存正文、取消、粘贴失效、失败保留弹窗、切章保护。
- [x] 从 ChapterImageActions 抽取 ChapterImagePasteDialog.vue，复用单张粘贴、预览和按钮，仅通过模式改变文案。
- [x] 新建 useChapterIllustrationInsertion.ts，管理正文快照、位置、粘贴、确认和写入忙状态；LongManuscriptEditor 只接线，不写盘。
- [x] 新建 useLongEditorIllustrationCommit.ts，把保存结果接入正文历史、savedContent、恢复记录和既有 saved 事件；LongWorkspaceEditor 用该桥接替代内联图片上下文。
- [x] 运行编辑器与替换图片回归。

## 4. 验收

- [x] 在隔离真实 Electron 中验证原生菜单动作、粘贴确认、引用位置、预览与重开，并检查文件编号与旧图片保留。
- [x] 对任务文件格式化，运行 pnpm verify 与 pnpm smoke。
- [x] 用 council-review 对新增保存合同、路径隔离和 UI 状态进行独立检查，处理可复现问题。
- [x] 重启实际应用，确认服务可用，核对原小说文件未被测试改写，清理隔离临时目录。
