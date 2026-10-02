# Review

## 范围与证据

- BASE / HEAD：c3f6bdc8a61dc2fc1a4f7a1e56ed711d2bcb4e59；审查当前未提交工作树中的新增形象功能，不包含此前正文图片和预览位置的改动。
- 三个独立审查视角：形象创建流程与提示词正确性、跨运行时合同与验证、绝对路径与资产隔离。
- 最终目标测试命令：`pnpm exec vitest run apps/desktop/src/utilities/long-character-appearance-references.test.ts apps/desktop/src/utilities/long-core-commands.character-profile.test.ts apps/desktop/src/utilities/long-project-store.character-profile.test.ts apps/desktop/src/main/ipc/character-asset-commands.test.ts apps/desktop/src/renderer/src/features/character-assets/useCharacterProfile.test.ts apps/desktop/src/renderer/src/features/character-assets/profile-draft.test.ts apps/desktop/src/renderer/src/features/character-assets/appearance-prompt.test.ts`，7 个文件、29 个测试通过。
- `pnpm build`、`pnpm smoke` 通过。真实 Electron 组件验证确认取消、保存、系统剪贴板复制、选定形象隔离、外部写入后重新读取与图片解码，并保留旧资产。
- 范围 ESLint、Prettier、Renderer 边界检查和 `git diff --check` 通过。

## 已确认发现

- [P2] `appearance-prompt.ts:51` — 制作模式未明确排除用户上传参考图中的脸部，可能改变目标角色身份；补充目标身份约束，新增测试先失败后通过，原流程审查视角复核通过。
- [P2] `long-character-appearance-paths.ts:22` — 参考查询原先可返回经符号链接指向其他角色或外部目录的路径；发布路径前检查父目录、资产目录与每个登记图片，拒绝符号链接、文件映射和无效尺寸。两个回归测试先失败后通过，原路径审查视角复核 4 个查询测试全部通过。
- 合同审查指出需证明已有目标图片不会被外部追加流程覆盖；Electron 临时作品加入旧图片，追加新清单时保留旧记录，重读确认两张图片同时存在、旧图片 ID 保持不变。

## Push-back

- 名称检查正则被误读为排除普通英文字母；直接读取原始源码并运行英文名称保存与换行拒绝测试，确认实际正则为换行检查，审查者撤回该发现。

## 剩余风险或用户决策

- 外部 Agent 实际生图效果及是否遵循提示词由用户执行后检查。应用已验证按提示词规定的现有文件格式写入结果后可以读取与展示。
- 多角色共用目录中的图片清单必须保留已有记录；提示词包含逐图清单、新形象 ID、唯一图片 ID、保留旧记录和原子保存要求。

## 结论

- ready。已确认问题均已修复且通过对应审查视角复核，没有剩余阻断发现；目标回归、构建和 Electron 验证全部通过。
