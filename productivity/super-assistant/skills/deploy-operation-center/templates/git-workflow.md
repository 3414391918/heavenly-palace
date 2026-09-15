# Git 分支、提交、推送与合并

## 目录

- [1. 识别真实范围](#1-识别真实范围)
- [2. 分支命名与创建](#2-分支命名与创建)
- [3. 提交与推送](#3-提交与推送)
- [4. 把 master 合入开发分支](#4-把-master-合入开发分支)
- [5. 冲突处理原则](#5-冲突处理原则)
- [6. 合并后的完整性审计](#6-合并后的完整性审计)
- [7. 预发或团队共享分支](#7-预发或团队共享分支)

## 1. 识别真实范围

只把满足下列证据之一的仓库纳入本需求：

- 当前开发分支名称与需求一致，且相对 `origin/master` 存在需求变更。
- 当前工作树存在已确认属于需求的修改。
- 公共包版本变化要求该仓库更新依赖。
- 用户或需求文档明确列出该仓库。

不要因为仓库位于同一工作区、存在历史需求分支或曾被工具扫描过就纳入范围。

## 2. 分支命名与创建

优先使用团队文档中的规则。没有更具体规则时使用三段式：

```text
<8 位日期>-<开发者姓名首字母>-<需求简称>
```

示例：`20260806-wsf-baitiaoquxian`。

创建前先执行 `git fetch origin`，确认当前起点和远端同名分支是否存在。不得在来源不明或落后的本地 `master` 上直接创建分支。

## 3. 提交与推送

逐仓库执行以下检查：

```bash
git status --short --branch
git diff --check
git diff --name-status
git diff --cached --name-status
```

提交前逐项核对暂存文件，排除：

- `.codegraph/`、`.idea/`、编辑器缓存。
- `node_modules/`、`target/`、`dist/` 等构建产物。
- 与需求无关的格式化、重构和依赖更新。
- 包含密码、令牌、内网凭证的文件。

使用普通 `git push` 推送开发分支。禁止 force push，除非用户明确授权且已说明会覆盖哪些远端提交。

## 4. 把 master 合入开发分支

“合 master”默认含义是把远端最新 `master` 合入当前需求开发分支，不是修改、提交或推送 `master`。

开始前记录：

```bash
git rev-parse master
git rev-parse HEAD
git status --short --branch
```

标准操作：

```bash
git fetch origin master <开发分支>
git switch <开发分支>
git merge origin/master
```

禁止为了“更新 master”而切到本地 `master` 后提交、合并或推送。结束时再次执行 `git rev-parse master`，结果必须与开始时完全一致。

若涉及公共包和消费方，先合公共包，再发布新快照，最后更新并合消费方。

## 5. 冲突处理原则

对每个冲突先比较三个版本：合并基线、当前开发分支、`origin/master`。处理目标只有两个：

1. 保留 master 上已经存在的正常演进。
2. 保留本需求已经测试过的最小变更。

不得借冲突顺手修复其他缺陷、统一代码风格或优化旧链路。公共包版本冲突按 `public-package-release.md` 处理。

如果共享分支中的自定义版本包含其他开发者或其他需求标识，说明该分支可能被占用。不要直接覆盖，先向用户说明现状并确认协调方式。

## 6. 合并后的完整性审计

至少执行：

```bash
git merge-base --is-ancestor origin/master HEAD
git rev-list --left-right --count @{upstream}...HEAD
git diff --name-status origin/master...HEAD
git diff --diff-filter=D --name-status origin/master...HEAD
git status --short --branch
```

检查要点：

- `origin/master` 必须是当前分支祖先。
- 推送后本地和远端同名分支的 ahead/behind 都为 0。
- 工作树干净。
- 相对 master 的删除都能由需求直接解释。
- master 中存在的测试文件在开发分支中仍然存在。
- 本地 `master` 提交号未变化。

IDE 的“工作树差异”可能把比较基线或分支方向显示错。评审前用上述 Git 命令确认真实差异，再刷新 IDE 的 Git 日志、索引和比较基线；不要通过删除、恢复或重写提交来迎合错误视图。

## 7. 预发或团队共享分支

只有用户明确要求时才把开发分支合入预发或共享分支。合入前确认：

- 目标分支名称和用途。
- 当前占用人和已部署制品。
- 公共包自定义快照是否与当前需求一致。
- 冲突解决不会覆盖其他在测需求。

共享分支发生冲突时，优先保留两项需求的有效改动；无法证明兼容时停止并请用户协调，不擅自取舍。
