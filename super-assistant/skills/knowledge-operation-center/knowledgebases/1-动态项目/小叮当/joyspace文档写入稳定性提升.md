---
审查状态: 待审查
来源追溯: 2026-10-27 用户反馈498及两张原始时序图；JoyDesk docs/bugs/repro/2026-10-27-joyspace-created-empty-document.md；本地端到端回读验证
aliases:
  - JoySpace空文档修复
  - 反馈498文档写入
tags:
  - 开发文档
  - JoyDesk
  - JoySpace
  - 问题复盘
知识类型: 人读排障知识
创建时间: 2026-10-27T13:07
修改时间: 2026-10-27T13:16
---
# 图例说明

![[JoySpace文档写入-原链路与回读验证时序图.png|900]]

![[JoySpace文档写入-修复方案时序图.png|900]]

# 执行路径

1. **核对反馈与成功标准。** 用户反馈 498（桌面端 `2026.9.23`）要求向 JoySpace 写文档。`create_joyspace_page` 返回页面 `aS9ojo2SXo80MbOkMHlZ`，旧 `sdk_joyspace.py create` 返回页面 `DT0acrQR3qmdbYVVqYOk`；官方 `fetchPageContent` 对两页的回读均为 `content: []`。因此“拿到 `pageId`”只能证明建页请求被接受，不能证明正文已经保存。
2. **对照实际成功路径。** 报告中的 Agent 改用 JoySpace 原生文档块后，独立回读新页 `RDzsprT1Cgar8Wjpb0lh` 得到 43 个顶层块，其中包含 6 个折叠块。两条空页路径采用 `content: [{ value: Markdown }]`、`contentType: markdown`；这一对照支持修改客户端写入形态，但没有服务端源码证据证明其内部为何未落正文。
3. **确定修复位置与基线。** 从当时最新的 `origin/feature/202609`（`95a9ad9a7f643d2f1fe2d6a614594e22d6573b93`）创建 `fix/20261027-joyspace-empty-document`。共用逻辑放在 `packages/joyspace-client`，让桌面 Host 的不同调用入口使用同一套创建与回读结果，而不依赖 Agent 自行组装原生块。
4. **写入前转换与拒绝。** `create-native.ts` 用固定代码把 Markdown 的标题、段落、行内样式、链接、列表、表格、代码块、引用、分隔线和受支持的折叠结构转换为 JoySpace 原生块。无法可靠转换的原始 HTML 等结构返回 `JOYSPACE_MARKDOWN_UNSUPPORTED`，在最终建页请求前停止；报告原始约 16 KB 的正文离线转换为 44 个原生块。这里的转换是明确覆盖的结构集合，不等于任意 Markdown 或 HTML 都可无损转换。
5. **创建后回读并保留页面凭据。** `create.ts` 将原生块传给 `/v1/pages`；`index.ts` 拿到 `pageId` 后调用 `/v1/pages/content` 回读。正文非空才返回 `contentVerified: true`；回读为空或失败则返回 `contentVerified: false`、提示与同一个 `pageId`，不自动再建一页，避免出现重复文档。第二张图中的“有限次数回读”是设计表达；当前实现只回读一次，若首次未确认，由调用方用已返回的 `pageId` 检查原页。
6. **回归与真实接口验证。** 回归用例覆盖原生块请求、空正文、回读失败、转换失败及“不重复建页”；JoySpace 客户端 94/94、Host Actions 1178/1178、桌面 Host 双内核入口 26/26 通过，相关类型检查通过。真实本地端到端调用创建测试页 `VpVfBLe2vMhJmSk5Sp0p`，返回 `contentVerified: true`；再用官方读取接口独立回读到 4 个块（段落、表格、折叠块），并读到测试标记。
7. **记录边界和交付状态。** 修复只作用于后续创建，不会自动补写反馈中的既有空页。排查和验证记录见 JoyDesk 仓库 `docs/bugs/repro/2026-10-27-joyspace-created-empty-document.md`；截至本笔记整理时，代码仍在上述开发分支的工作区中，尚未提交、推送或合入 `feature/202609`，也不能把本地端到端验证等同于生产发布。
