# Review

## 范围与证据

- 工作目录：`productivity/tool-library/virtual-world`。BASE / HEAD：`9aae093`；审查对象为正文新增插画的未提交改动。已有提示词模板改动保留。
- 按正确性、合同兼容性、持久化与路径隔离三个关注点分轮自审；未派发独立 Agent，不作为并行审查报告。
- Core：规范章节路径、图片解码、编号分配、正文草稿、事务冲突及原子保存。
- 跨进程合同：Zod 输入与结果、Preload 白名单、Main 转发、Core 命令路由、原生菜单动作的文档身份校验。
- 编辑器：菜单位置、引用与撤销并存、图片粘贴、保存状态、恢复记录、预览和重开。
- `pnpm verify`：格式、类型、ESLint、Renderer 边界、587 个测试文件 / 3183 项测试以及构建均通过。
- `pnpm smoke`：真实 Renderer → Preload → Main → Core → 磁盘链路通过；覆盖键盘粘贴与按钮粘贴、取消、001 / 002 编号、立即保存、撤销 / 重做、预览解码和重开。既有 21,555,643 字节图片的复制、替换及预览保持回归通过。

## 已确认发现

- [Important] `utilities/long-project-store/chapter-illustrations.ts`：既有小说事务包装会移除预期版本条件，导致新增插画覆盖外部较新正文。新增插画改用现有通用项目事务，保留图片不存在、正文、索引及清单的哈希条件；正文在提交前变化的失败测试已转绿。
- [Important] `renderer/src/features/chapter-images/useChapterIllustrationInsertion.ts`：父组件解除写入忙状态会触发弹窗失效，保存失败后丢失粘贴图片。解除锁定且文档未变化时保留弹窗；复现测试先失败，修复后 6 个相关用例通过。
- [Test] `renderer/src/features/chapter-images/chapter-illustration.smoke.ts`：此前预览测试记住了同一章节的预览模式，新测试不能假定初次挂载为编辑。等待文本按钮可用后显式进入编辑。
- [Test] 同一冒烟文件：屏幕外的懒加载图片会让 `decode()` 等待。沿用既有预览冒烟的 eager 解码方式检验保存后的 URL；生产懒加载行为保留，测试超时上限恢复为原来的 40 秒。

## Push-back

- 无拒绝的阻断发现。没有增加新的图片清单或平行存储格式；编号按当前章节的已有文件和正文引用分配。

## 剩余风险或用户决策

- 无待决策事项。正文被外部改写或文件写入失败时拒绝添加并保留粘贴内容；不会覆盖已有数字图片。
- 撤销作用于正文引用，已保存的图片保留；取消弹窗不创建图片。
- 真实窗口受 Mac 锁屏影响，未声称完成前台人工点击验收；隔离 Electron 的真实保存、渲染和重开验证已完成。

## 结论

- ready。复核命令为 `pnpm verify`、`pnpm smoke`，均成功。
- 实际开发服务已重启，`http://localhost:5173/` 返回 HTTP 200；启动日志确认 Main 和 Preload 构建成功。
- 测试只使用隔离临时作品。重启前后另行比较真实小说文件哈希，核对原始内容未被测试修改。
