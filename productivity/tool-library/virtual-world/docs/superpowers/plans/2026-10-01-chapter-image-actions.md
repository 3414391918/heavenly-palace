# 正文图片操作 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** 正文预览支持图片复制、单张剪贴板图片确认替换，并保持原引用路径。

**Architecture:** contracts 定义窄图片目标与 SHA-256；Core 负责图片解码和事务覆盖；Main 负责剪贴板；Renderer 管理右键菜单、替换弹窗和 URL 版本。

**Tech Stack:** Electron、Vue、Zod、Sharp、Vitest。

---

## 1. 契约与存储

- [x] 增加 long-chapter-image 契约（bookId、chapterCardId、filename；read 返回 pngDataUrl/revision；replace 接收 pngDataUrl/expectedRevision）。
- [x] 先编写失败测试：覆盖后正文引用不变、重复/并发覆盖拒绝、路径与链接攻击拒绝。
- [x] 实现 Core store/service 命令；复用安全读取与事务写入，Sharp 按原扩展名编码；目标必须在当前正文中被引用。
- [x] 运行存储和契约目标测试。

## 2. 系统边界

- [x] 编写 Main/Preload 测试，验证复制图片与空剪贴板、大小限制、命令桥。
- [x] 主进程提供读取剪贴板图片与复制接口，替换命令经 Core；实际 Main index 和模块 dispatcher 均注册。
- [x] 双向 Zod 校验，内部命令不能由 Renderer 调用。

## 3. 预览交互

- [x] 编写界面状态测试：菜单两项、取消不写盘、多图拒绝、确认写入及 URL 更新、切换章节时关闭。
- [x] 独立 chapter-images 组件/composable 管理交互，接入 LongManuscriptEditor；避免给巨型工作台增加业务逻辑。
- [x] 弹窗支持粘贴事件和显式粘贴按钮，图片预览、确认/取消，主题与现有表单一致。
- [x] URL 版本只用于刷新，正文中的相对路径保持不变；协议只接受合法 revision 查询。

## 4. 验收

- [x] 独立审查合同和持久化安全，修复阻断发现。
- [x] 运行 pnpm verify，确认测试、格式、类型、边界、构建。
- [x] 用临时作品验证完整链路和系统剪贴板，清理临时数据后重启开发服务。


## 验证结果

1. 开发前的角色档案与资产功能已提交为 `c3f6bdc`，并推送至 `origin/master`。
2. `VITEST_MAX_WORKERS=2 pnpm verify` 通过：662 个测试文件、3750 项测试；格式、类型、Lint、边界检查与构建全部通过。
3. `pnpm smoke` 通过真实 Renderer → Preload → Main → Core 链路：系统剪贴板读取、图片替换、保存后重读、旧版本拒绝、图片复制及自定义协议渲染；确认正文和索引字节不变。
4. macOS arm64 的目录打包与 Electron 中的 Sharp 加载通过；PNG、JPEG、WebP、GIF、AVIF 编解码通过。其他操作系统和架构未做实机验收。
5. 契约与安全独立审查完成；修复 Renderer 显式导出边界、JPEG EXIF 方向与 Sharp 原生依赖解包路径问题。
6. 临时冒烟作品已自动清理。开发服务已重启至 `http://localhost:5173/`，截图确认应用正常加载。电脑操作工具无法可靠点击该窗口，交互行为由界面状态测试与真实 IPC 冒烟验证覆盖。

7. 修复实际界面复制时的 `An object could not be cloned`：菜单中的目标经 Vue `ref` 包装为 Proxy，复制和打开替换窗口前先提取普通对象。回归测试在模拟 contextBridge 的 `structuredClone` 边界上先复现失败，再验证修复通过；13 项相关测试、类型、格式与 ESLint 检查通过，开发服务已自动热更新。

8. 修复大图片校验时的 `Maximum call stack size exceeded`：原 Base64 正则按四字符分组反复匹配，8 MB 输入即复现 V8 RegExp 栈溢出；改为连续字符匹配并单独检查编码长度，保留 PNG 类型、字符、补齐和大小限制。大数据回归测试先失败再通过。全仓 `pnpm verify` 通过（662 个文件、3763 项测试），补充后的契约目标测试 15 项通过；真实 Electron 冒烟使用 3072×2048、高熵 PNG，最终文件 18,909,913 字节，验证剪贴板复制、读取、确认替换、保存重读、旧版本拒绝和协议渲染，正文与索引不变。临时作品自动清理，重新启动开发服务使 Main、Preload、Core 同时加载新版契约。

9. 修复快捷键粘贴时的 `The source image cannot be decoded`：粘贴 File 原先生成 blob: 图片地址，被页面 img-src 拒绝。真实 Electron 页面中新加入的 Renderer 冒烟先复现同一 EncodingError，再改为 FileReader 读取页面允许的 data: 图片并解码为 PNG；无效图片提示中文。新增冒烟直接调用实际 Vue composable 与 File 解码函数，覆盖响应式目标跨 contextBridge、按钮读取和快捷键使用的 File 转换、确认替换、重读、复制与渲染；最终 PNG 为 21,555,643 字节，正文和索引未变化。7 项界面相关测试通过，真实 Electron 冒烟通过；临时模块、作品与测试目录自动清理，当前开发页面已热更新。

10. 修复替换后重新进入预览仍显示旧图：确认实际图片已原位覆盖，真实作品的事务目录为空。真实 Electron 中保留旧预览的 Image 引用，替换后销毁并重新创建预览状态，先复现 `reopened preview shows old image`；原因是组件销毁后丢失版本标记，Chromium 仍可能复用原地址的解码图片，`no-store` 不足以消除这个情况。每次打开预览或切换章节生成独立刷新标记，替换成功时仍使用新文件校验值刷新，正文相对路径保持不变。35 项相关测试、类型检查、ESLint、边界检查和构建通过；约 21 MB 图片真实 IPC 冒烟确认重新打开预览显示新图、正文及索引不变、图片目录只剩原文件名且事务目录无旧图。临时作品与模块自动清理，开发页面已热更新。

11. 修复 Mac 切回应用后预览重置为编辑、阅读位置丢失：焦点刷新会重新分配索引与所选文件对象，原数组 getter 的同步 watch 无条件重置视图和编辑历史。提取 `useLongEditorViewSession`，只以稳定的文档标识识别真正切换，并在当前应用会话中分别记住各文档的视图；显式修改默认设置与只读限制仍生效。滚动恢复改为等待实际滚动元素及正文加载完成，加载期间的布局滚动不覆盖记录。补充 `longPreviewImageSizes`，重新打开预览时先预留已加载图片的尺寸，解码后释放临时尺寸，防止图片延迟加载造成位置漂移。长篇专用加载与图片恢复集中在按需加载的 `useLongEditorViewport`，共享滚动模块不承担这部分启动成本。真实 Electron 挂载实际 LongWorkspaceEditor，先复现焦点刷新切换成编辑、含图片的重新打开偏移至 1448.5 像素，再验证刷新和重新打开均保持预览及 820 像素位置；使用真实 Core 的临时作品和约 21 MB 图片，测试数据自动清理。另在真实剧情页的重新挂载中复现布局监听读取尚未初始化的剧情页签，调整布局初始化顺序后验证剧情页可正常重新打开。49 项相关测试、类型、ESLint、边界检查、构建与真实 Electron 冒烟通过；启动就绪 JavaScript 为 999,822 字节，满足现有性能限制。
