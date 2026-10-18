# 安装后的初始化与路径配置

用户自行安装 Obsidian。Skill 只负责连接已经安装的应用与目标知识库，不包含下载、安装或升级应用的步骤。

## 应用位置与知识位置彼此独立

- **应用目录**：每台机器可以不同，通常使用系统默认目录；不放入 Git。
- **知识库目录**：默认是本 Skill 内的 `knowledgebases/`。换机器后打开克隆得到的这个文件夹，不新建另一个同名空库。
- **本机路径配置**：需要时通过环境变量指定，不写进笔记、共享配置或 Git。

脚本按下列顺序定位 CLI：

1. `OBSIDIAN_CLI`：明确指定 CLI 文件。
2. `OBSIDIAN_INSTALL_DIR`：明确指定应用目录。macOS 支持 `.app` 本身或它的父目录；Windows 指包含 `Obsidian.com` 的目录。
3. PATH 中可执行的 `obsidian` 或 `Obsidian.com`。
4. macOS `/Applications`、用户 `~/Applications`；Windows 由 `LOCALAPPDATA`、`ProgramFiles` 等环境变量确定的常用目录。

自动探测跳过失效链接。显式设置的路径无效则直接报错，避免静默选中另一套应用。自定义位置不在探测范围时，指定一次本机路径即可；无需修改 Skill。

## 首次连接

1. 打开 Obsidian，选择“打开本地仓库 / Open folder as vault”，选中本机 `<Skill目录>/knowledgebases`。目录已有模板、Base 和配置时直接沿用。
2. 在设置中启用“命令行界面 / Command line interface”。官方文档当前位于“常规 / General”，本次验证的 1.13.7 中文界面位于“关于”；以实际界面为准。CLI 需要支持该功能的安装器（官方要求 1.12.7+），不只是更新应用内部版本。
3. PATH 注册便于在终端直接运行 `obsidian`，但不是本 Skill 的必要条件；脚本能直接调用应用自带的 CLI。若移动应用导致旧注册失效，可重新注册或使用本机路径变量。
4. 启用核心功能“模板”“属性”“反向链接”“关系图谱”“Bases”；模板文件夹设为 `5-系统模板`，打开“自动更新内部链接”。保留其他个人设置，无需社区插件。
5. 运行下面的检测与查询。CLI 返回的真实 Vault 路径必须与预期一致，不能仅凭 `help` 成功判断初始化完成。

## 检测与自定义位置

在本 Skill 目录运行：

```bash
bash scripts/detect_obsidian.sh
bash scripts/obsidian.sh template:read name="业务域模板"
bash scripts/obsidian.sh base:query path="知识库总览.base" view="待审查" format=json
bash scripts/obsidian.sh search query="银行压降" format=json
```

macOS 的自定义位置示例（通常自动发现，无需设置）：

```bash
export OBSIDIAN_CLI="/自定义目录/Obsidian.app/Contents/MacOS/obsidian-cli"
# 或：export OBSIDIAN_INSTALL_DIR="/自定义目录/Obsidian.app"
bash scripts/detect_obsidian.sh
```

Windows 的脚本在 **Git Bash** 中执行，控制台入口是应用目录中的 `Obsidian.com`：

```bash
export OBSIDIAN_INSTALL_DIR='/d/工具/Obsidian'
# 或：export OBSIDIAN_CLI='/d/工具/Obsidian/Obsidian.com'
bash scripts/detect_obsidian.sh
```

只在需要改用另一个知识目录时设置 `OBSIDIAN_VAULT_PATH`。脚本默认从自身所在位置计算 `knowledgebases` 路径，因此仓库在各台机器的位置也可以不同。进入正确 Vault 目录执行 CLI 后还会核对真实路径，防止写错库。

上述变量只需保存在本机 shell 配置中，或由 Agent 在本次命令环境中传入；不要把个人绝对路径提交到仓库。

## 初始化检查

- `detect_obsidian.sh` 输出正确的 `VAULT_PATH` 与 `VAULT_READY=yes`。
- 模板可读，Base 结果与当前审查状态一致，关键词可命中实际笔记。
- 设置过链接规则后，用本次专属临时笔记验证创建、属性回读、双链和移动引用，再清理测试数据。
- 空库初始化只补建缺失的七类目录、模板、Base 与通用设置，不覆盖已有内容。日常管理继续遵守待审查和来源追溯流程。

脚本依赖 Bash、base64、awk、shasum 或 sha256sum；正文写入使用 Obsidian 桌面内置 Node 环境，无需另装 Python 或 Node。CLI 通常连接运行中的 Obsidian；应用未运行时官方 CLI 会尝试启动它，首次连接仍应先打开正确 Vault。

官方参考：[Obsidian CLI](https://obsidian.md/help/cli)。当前验证环境与限制见 [验收记录](verification.md)。
