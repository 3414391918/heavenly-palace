# 桌面标题栏

Linux 与 Windows 共用 Electron 无系统装饰窗口及应用内标题栏；macOS 保留 hiddenInset 与原生交通灯。浏览器预览不模拟原生标题栏。

- 标题栏背景与目录侧栏共用 `--sidebar` / `--sidebar-surface`，底层均为 `--surface-main`。不复制明暗色值；外观设置及系统主题变化由现有 appearance runtime 同步，包含自定义配色、半透明侧栏和 UI 字号。
- 标题栏最小高度 36px，随字号增大自然增长。工作台占剩余高度，不增加页面滚动。中间标题保持居中，左侧菜单和右侧窗口按钮不参与拖动。
- Electron 的 `app-region: drag` 负责原生拖动及双击最大化，`frame: false` 保留默认 resizable 窗口边缘。顶部保留 3px 不可点击的边缘空间，防止菜单覆盖缩放命中区域。
- 左上角使用纯文字按钮，普通、悬停、展开与焦点状态均无背景、边框和阴影；下划线区分悬停、展开与键盘焦点。文件、视图、帮助菜单复用 `PopupSelect` 的 menu 变体，保留主题、边界避让、禁用态及焦点。上下、Home/End 跳过禁用项，左右切换菜单，Enter/空格执行，Escape 收起并恢复焦点；F10 聚焦菜单，Alt+F 打开文件菜单，F11 切换全屏。全屏保留菜单和退出入口。
- 新建、打开作品、设置、外观、分栏和快捷键帮助复用 WorkspaceShell 的现有协调器。文稿面板操作在非写作视图禁用，作品变更期间禁用新建和打开。
- WindowFrame 的主进程桥只接受所属窗口主 Frame 的白名单 Envelope 命令，Preload 双向校验；不向 Renderer 暴露通用 Electron 或 IPC 能力。窗口状态通过 Envelope 事件同步。
- 关闭调用 `BrowserWindow.close()`，继续经过托盘隐藏、renderer state flush、退出保存和 Utility 关闭流程；退出调用 `app.quit()`，不使用 destroy/exit 绕过保存。失败使用既有 toast。

原生行为依据 [Electron 自定义窗口交互](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions)。原生拖动、边缘缩放与桌面窗口管理器有关；浏览器或模拟桥的验证不能替代原生验收。

菜单及帮助通过现有 lazyAppComponents 首次使用时加载。目录的旧库导入与打开项目操作移入 catalogProjectActions，保留原有 pending、刷新、导航及反馈，避免标题栏增加首屏负担。
