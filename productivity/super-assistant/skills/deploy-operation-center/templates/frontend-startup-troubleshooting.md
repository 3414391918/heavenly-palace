# 前端本地启动与依赖故障排查

用于前端项目无法安装依赖、无法启动开发服务器，或启动后页面不可用的场景。目标是恢复一个可重复、可解释的本地运行环境；不要把临时绕过当成代码已通过质量门禁。

## 目录

1. 范围与授权
2. 项目环境画像
3. 安装依赖
4. 启动开发服务器
5. 已知故障模式
6. 验证与报告

## 1. 范围与授权

默认可以执行只读检查、使用项目已有工具和在项目目录内复现错误。以下动作会改变项目、用户环境或安全边界，执行前必须说明目标和影响并取得授权：

- 安装 NVM、Node、包管理器、Joyer CLI、Xcode Command Line Tools 等系统或全局工具。
- 修改 `.zshrc` 等 shell 启动文件，切换全局 registry，或改变 npm/yarn/pnpm 的全局配置。
- 删除 lock、`node_modules`，重建依赖树，升级或降级 npm，批准依赖安装脚本。
- 修改 `package.json`、构建配置、业务源码或既有依赖版本。
- 使用 `DISABLE_ESLINT_PLUGIN` 等方式绕过检查，或把开发服务器监听到 `0.0.0.0`。

优先通过环境选择和命令行参数复现、定位问题。若根因需要改源码、配置或依赖契约，把它作为明确的代码变更处理并运行相应测试；不要借“启动修复”扩大修改范围。

## 2. 项目环境画像

先读取并记录：

- `.nvmrc`、`.node-version`、`package.json` 中的 `engines` 和 `packageManager`。
- `yarn.lock`、`pnpm-lock.yaml`、`package-lock.json` 的类型和版本；存在多种 lock 时先查项目历史和 CI，不能自行挑一个。
- `scripts` 中真实的 install、dev、serve、start 和 build 命令。
- CI/容器构建使用的 Node、npm、yarn 或 pnpm 版本。
- `vue.config.*`、`vite.config.*`、webpack 配置和 `.env*` 中的 host、port、proxy、mode、输出目录；读取敏感环境文件时不要把值输出到日志。
- 当前 `node --version`、包管理器版本、CPU 架构、registry，以及 macOS 上 `xcode-select -p` 的结果。

Node 版本以项目证据为准。老 Vue CLI、webpack、`node-sass` 项目通常需要较旧 Node；现代 Vite 项目通常需要受支持的较新 Node。不要只靠经验表猜版本，应结合 lock、原生模块发布说明和 CI 的成功版本。

包管理器按 `packageManager` 和 lock 选择：有 `yarn.lock` 用项目约定的 Yarn，有 `pnpm-lock.yaml` 用 pnpm，有 `package-lock.json` 用 npm。不要因为个人偏好更换包管理器。NVM 已安装但当前 shell 未加载时，只在当前会话加载并切换版本；不要顺手修改 shell 配置。

## 3. 安装依赖

先使用保持 lock 不变的安装方式，例如项目兼容的 `yarn install --frozen-lockfile`、`pnpm install --frozen-lockfile` 或 `npm ci`。具体参数以包管理器和 lock 版本为准；老项目确有 peer dependency 冲突时，记录证据后再评估 `npm install --legacy-peer-deps`。

安装失败时先保存首个有效错误、退出码和完整日志位置，再分类处理：

1. 检查 registry、代理、DNS、证书和失败 URL 是否可达。
2. 判断失败 URL 来自全局配置、项目配置、`package.json` 直接依赖还是 lock 的 `resolved`。
3. 检查 Node、包管理器与原生模块 ABI 是否匹配。
4. 检查安装脚本是否被安全策略阻止；pnpm 需要批准构建脚本时，只批准已检查的具体包，不使用无差别批准。
5. 不用 `--ignore-scripts` 掩盖原生模块问题，它可能得到表面安装成功但不可运行的依赖树。

仅当 lock 中的下载地址已确认失效、当前 registry 能解析到同一依赖、项目允许刷新 lock 且用户授权时，才删除项目内精确的 lock 与 `node_modules` 后重新安装。重新生成后必须审查 lock diff，避免版本大面积漂移。不得手工替换 lock 中 URL，也不得因为一次超时就删除 lock。

如果 `package.json` 直接写了已失效的内网 tgz，必须把它视为依赖契约问题。只有确认该包在源码和构建链中均未使用、用户明确接受且产物绝不会用于生产时，才可在隔离临时目录用本地 mock 做诊断；这不是正式修复，不得提交到仓库。

## 4. 启动开发服务器

优先执行 `package.json` 中已有的 dev/serve/start 脚本，避免用 `npx` 临时下载一个不同版本的 CLI。需要覆盖参数时先确认脚本的参数透传方式。

- 本机访问优先绑定 `127.0.0.1`。配置中的 host 指向本机不存在的内网 IP/域名时，可用 CLI 覆盖；只有局域网或容器访问确有需要且用户接受暴露范围时才使用 `0.0.0.0`。
- 端口被占用时先识别占用进程及归属；不要结束未知进程，可改用项目允许的端口。`strictPort` 项目应遵守配置或明确覆盖。
- 不要默认用 root 启动低端口服务；优先选择非特权端口。
- 进程编译成功后继续观察，确认没有随后退出或进入重复重编译失败。

编译错误应先定位根因。少量格式或类型问题若要改源码，需得到代码修改授权并正常测试；大量 lint 问题可以在仅为本地诊断且用户同意时临时绕过，但不得用于构建、提交或部署门禁，最终报告必须说明绕过项。

## 5. 已知故障模式

| 现象 | 典型根因 | 处理原则 |
| --- | --- | --- |
| `ETIMEDOUT` 指向旧内网 tgz | lock 的 `resolved` 指向已下线 CDN | 先验证地址和当前 registry；授权后才重建 lock，并审查版本漂移 |
| `CERT_HAS_EXPIRED` 指向 `registry.npm.taobao.org` | lock 锁定已停用的旧镜像 | 不关闭证书校验；确认替代 registry 后按受控流程刷新 lock |
| `node-sass` 在 macOS arm64/当前 Node 上失败 | 预编译 binding 与架构或 Node ABI 不匹配 | 对照项目版本选择 Node，尝试项目包管理器支持的 rebuild；源码编译前确认 Xcode CLT |
| `node-gyp` 缺 `graceful-fs` 等级联依赖 | 老安装链与当前 npm 提升策略不兼容，或曾跳过脚本 | 回到项目已验证的 Node/npm 组合并完整安装，不靠连续补装间接依赖 |
| npm 长时间停在 `idealTree buildDeps` | 无 lock 重算大依赖树、registry 慢或老项目与 npm 版本不匹配 | 先用 verbose 日志区分网络和解析；有项目证据时在隔离环境临时使用兼容 npm，不改全局默认 |
| ESLint/Prettier 阻断 dev 编译 | loader 把 lint 错误当编译错误 | 能在授权范围内修复则修复；临时关闭只用于诊断并明确披露，不能代表质量通过 |
| webpack CLI `isMultipleCompiler`/`options.forEach` | `webpack-cli` 与 `webpack-dev-server` API 不兼容 | 先核对实际版本；可用已安装依赖的 Node API 临时启动验证，正式修复需单独授权依赖变更 |
| `EADDRNOTAVAIL` 或 localhost 返回 `000` | devServer 绑定远端域名或本机不存在的 IP | 用 CLI 覆盖为 `127.0.0.1`；确需外部访问再使用 `0.0.0.0` |
| 启动成功但白屏、404 或接口失败 | 环境变量、代理、public path、路由模式或后端不可达 | 检查浏览器控制台、Network、目标 mode 和代理；区分前端编译成功与业务页面可用 |

新的故障模式只有在根因和修复经真实项目验证后，才应在维护本 Skill 的任务中补充到本表。普通启动任务只在结果报告中记录，不要未经授权修改 Skill 仓库。

## 6. 验证与报告

至少验证：

1. 开发服务器进程持续存活，监听地址和端口符合预期。
2. 用 HTTP 请求打开入口并记录状态；重定向也要确认最终地址。
3. 在浏览器打开本次目标页面，检查控制台和关键 Network 请求。
4. 确认使用的 Node、包管理器、lock 和启动命令在新 shell 中可重复。
5. 若改动 lock、依赖或配置，运行对应构建/测试并检查 diff。

最终报告包括访问地址、Node 与包管理器版本、使用的 lock、执行命令、根因、修复、验证证据，以及全局环境变更、host/port 覆盖、重建依赖、mock 或 lint 绕过。仍未解决时列出最小复现、已排除项和需要用户决定的下一步。
