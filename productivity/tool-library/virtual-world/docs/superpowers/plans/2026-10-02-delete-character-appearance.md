# 删除角色形象实施计划

**目标：** 用户确认后永久删除当前形象及其图片文件，并清理空的资产目录。

**架构：** 专用 Core 删除事务；Renderer 确认框捕获档案版本与所选图片 ID，现有档案写入操作作为共用函数；跨进程沿用 Envelope 和 Zod。

**技术栈：** TypeScript、Zod、Vue、Electron、Vitest、现有项目文件事务。

## 执行步骤

- [x] 在 `long-project-store.appearance-delete.test.ts` 创建两套形象与图片，断言专用删除 API 删除选中形象的二进制、描述与清单记录，另套仍存在；运行 Vitest 确认缺少功能失败。
- [x] 在 `long-character-appearance.ts` 定义 `LongDeleteCharacterAppearanceInputSchema`：bookId、characterId、appearanceId、expectedRevision、expectedAssetIds；接入命令、Preload、Main、Core、Store 和 Service。
- [x] 抽取 `character-profile-write.ts`，复用核心档案、索引和 manifest 写入操作；在 `character-appearance-delete.ts` 中校验确认快照、删除登记文件，更新清单，清理空目录。拒绝外部更新和不安全路径，事务失败前不改变业务文件。
- [x] 在档案 composable 添加删除方法，失败保留当前选择与输入；`DeleteCharacterAppearanceDialog.vue` 展示确认信息；`CharacterCoreProfile.vue` 添加相邻按钮和成功后选择逻辑。
- [x] 扩展真实 Electron 临时作品验证：点击取消不写盘，确认删除新形象，重新打开看不到旧形象与图片，最后一套删除后资产目录不存在。
- [x] 运行目标回归、typecheck、范围 ESLint/Prettier、边界检查、构建和 Electron 验证，独立审查删除事务与路径隔离，恢复服务。

- [ ] 解锁后完成用户指定冰魄形象的真实删除和数据保留核验。

## 验证记录

- 初次目标回归明确失败于 Store/composable 尚无专用删除方法：8 失败、7 通过。
- 实现后独立审查修复锁定状态、事务后目录清理错误、旧全文迁移备份三处问题；分别补充真实组件验证和先失败后通过的回归。
- 真 Electron 捕获响应式数组跨 contextBridge 无法克隆，添加结构化克隆回归并改为普通数组后通过。
- 最终回归 7 个文件、37 条测试通过；类型、范围 ESLint/Prettier、Renderer 边界和 diff 检查通过；构建 app-ready JavaScript 为 999,822 字节。完整 `pnpm smoke` 通过，覆盖新增与删除、取消、锁定、文件落盘与目录清理。
- 旧开发进程退出后仍留有已 disposed 的窗口，退出旧 Electron 和服务进程后重新启动，localhost:5173 返回 200，真实作品列表正常显示。
- 用户指定真实删除测试对象「冰魄系列第一套服装」：确认当前无图片，其他两套共 134 张。已通过 UI 进入慕星离并选择冰魄，打开带名称和数量的永久删除确认框；最终点击被 Mac 锁屏阻止，尚未删除，等待解锁后继续。
