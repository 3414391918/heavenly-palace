---
审查状态: 待审查
来源追溯: 2026-10-23 用户反馈470及两张原始时序图；JoyDesk提交 f33bf6d9fc02c0d8034a8f8e370dd7ba5a848077；仓库 docs/bugs/repro/2026-10-23-issue-470-skill-optimize-apply.md
aliases:
  - 技能优化预览提交修复
  - 反馈470技能修改报错
tags:
  - 开发文档
  - JoyDesk
  - 技能优化
  - 问题复盘
知识类型: 人读排障知识
创建时间: 2026-10-23T17:12
修改时间: 2026-10-23T17:12
---
# 图例说明

![[技能优化修复方案-previewId应用时序图.png|900]]

![[技能优化原流程-参数回填时序图.png|900]]

# 执行路径

1. **还原反馈与复现。** 反馈 470 的 `2026.10.23-beta.1` 调用记录显示：`skill_manage.optimize` 已生成技能修改预览；对话 Agent 随后把完整 `changes` 与占位 `diffs` 同时传给 `apply_optimize_changes`，触发 `conflicts_with_changes`。另一次重试将非空 `original` 填成空字符串，被文件原文校验拒绝。在内场预发桌面 Dev 应用中，对自建测试技能 `AI_TEST_SKILL_UPLOAD_20261023_001` 重现了这两种入参错误。
2. **定位旧调用链。** `skill_manage.optimize → skill-control-plane.ts → skill-optimization.ts` 读取 `SKILL.md`，把原文和要求交给优化模型，返回完整 `diffs`。旧的模型可见 `apply_optimize_changes(skillPath, changes, 可选 diffs)` 要求 Agent 自己回填文件正文；`skill-schema.ts` 先校验 `changes/diffs` 是否一致，后端再比较 `original` 与当前文件。反馈中的失败发生在 Agent 回填和参数校验阶段，不能据空 `original` 报错推断文件真的被并发修改。
3. **改为预览 ID 提交。** 在最新 `origin/feature/202609` 合入后的当前开发分支上，先写失败回归测试，再修改 `packages/host-actions`：`optimize` 把原文和完整修改稿暂存于 `skill-optimization.ts` 的进程内预览记录，返回随机 `previewId` 与供查看的 `diffs`；模型可见的 `apply_optimize_changes` 只要求 `previewId`。预览记录绑定会话与授权的用户技能目录，15 分钟过期并受容量限制。原有非模型接口仍可直接提交 `changes`。
4. **保留写入保护。** `applySkillOptimizationPreview → applySkillOptimizeChanges` 从预览记录取回修改稿，检查会话、目录和当前文件原文；文件变化时报 `PREVIEW_STALE`，要求重新预览。文件未变化时沿用 Host 修改授权，写入后回读核对；成功的 `previewId` 不可重放，写入失败时按原备份路径回滚。空白修改稿和没有实际变化的预览不会进入提交路径。
5. **验证并交付。** 新增反馈 470 回归测试，覆盖矛盾字段被忽略、跨会话和跨目录隔离、文件变更、过期、重放及空白修改稿。Host Actions 全套 1114 项、Kernel Protocol 全套 1903 项、桌面 Skill 相关后端测试 116 项及 Desk 类型检查通过。修复后在同一内场预发桌面应用中，真实对话一次 `optimize`、一次审批后的 `apply_optimize_changes` 即成功写入测试技能，提交包含 `previewId`，没有 `changes/diffs`。修复提交 `f33bf6d9fc` 已推送到 `fix/20261023-noninterrupting-followup-202609`，远端 SHA 一致，尚未合并；仓库复现文档见 `docs/bugs/repro/2026-10-23-issue-470-skill-optimize-apply.md`。
