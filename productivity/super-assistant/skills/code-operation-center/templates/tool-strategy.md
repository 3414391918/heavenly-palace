# 工具协同与单跳取证

## 核心结论

使用“CodeGraph 图事实 + 源码调用点与配置核对 + 源码结构语义补充”的分层策略：

| 层级 | 工具 | 负责什么 | 不能负责什么 |
|---|---|---|---|
| 1 | CodeGraph | 精确符号、源码、直接调用关系、实现与动态分派候选 | 自动判断业务应用边界和所有 RPC 路由 |
| 2 | 源码与 `rg` | 核对调用点、注解、XML/YAML、Bean/RPC 配置；索引构建失败时临时兜底 | 仅凭文本命中证明方法级调用关系 |
| 3 | 源码结构分析 | 补充代码顺序、条件分支、责任链、策略表、lambda 等业务语义 | 未经 CodeGraph 或源码结构验证就确认调用边 |

## CodeGraph 查询方式

完成 CodeGraph 安装、MCP 配置和当前代码版本的索引检查后，优先使用可用的 `codegraph_explore` 工具；否则进入应用根目录使用：

```bash
codegraph explore "<精确符号和问题>"
```

每次查询限定为一个当前节点和一个方向，不直接请求“递归找出所有链路”。推荐问题结构：

### 下游一跳

```text
在项目 <absolute-project-path> 中读取并解析
<FQCN#method(parameterTypes):returnType>。
只列出此方法直接调用的项目自有方法；给出每个目标的完整签名、
动态分派的所有项目内实现、调用文件与行号、所在条件/循环/异常分支。
不要递归展开目标方法。另列无法解析的反射、RPC、HTTP、MQ 和持久层边界。
```

### 上游一跳

```text
在项目 <absolute-project-path> 中查找所有直接调用
<FQCN#method(parameterTypes):returnType> 的项目自有方法。
按完整签名区分重载，包含接口分派到该实现的调用；给出调用文件与行号。
不要继续递归调用方。另列通过配置、反射或框架入口触达的候选。
```

一次结果太大时按包、实现类型或调用方分页，但最终必须合并全部批次并记录 `complete: true`。

## 源码核验

CodeGraph 输出的每条边至少核验以下字段：

1. caller 与 callee 的完整签名。
2. 调用表达式所在文件和行号。
3. 接口调用的运行时实现集合。
4. 条件、switch、循环、catch/finally、lambda 或回调上下文。
5. 目标是否属于当前应用自有代码，还是第三方/远程/持久层边界。

CodeGraph 结果不包含配置关系时，可在用户指定工作区内使用 `rg` 补充配置证据。索引不存在或疑似过期时必须先重新构建；只有构建失败时才能用 `rg` 临时推进，并保留阻塞项、禁止把结果标为完整。先搜全限定接口/类名和配置绑定，再搜方法名；文本命中必须回读包含它的方法体，证明调用者身份。类级命中不能直接记为方法级边。

常用兜底模式示例：

```bash
rg -n --glob '*.java' --glob '*.xml' --glob '*.yml' --glob '*.yaml' \
  'com\.example\.OrderApi|OrderApi|submit\s*\(' /absolute/workspace/root
```

## 源码语义补充

对当前方法源码额外识别：

- `if/else`、`switch`、循环、异常路径对应的分支标签。
- 责任链注册（如 `addHandler`/`addCommand`）到各 handler 执行方法的隐式边。
- 策略 Map、枚举到实现类、lambda/方法引用、模板方法和回调。
- 同一目标在多个分支出现时保留多个调用点证据，但图中目标节点只建一次。

这些规则只能增加“待验证候选”。候选必须通过 CodeGraph 或源码结构证明后，才记为 `confirmed` 边。

## 证据和置信度

每条边的 `evidence` 是对象数组：

```json
[
  {
    "kind": "codegraph",
    "detail": "Call path and resolved target from CodeGraph"
  },
  {
    "kind": "source",
    "detail": "/abs/App.java:83 orderService.submit(request)"
  }
]
```

常用 `kind`：`codegraph`、`source`、`contract`、`implementation`、`registration`、`configuration`、`search`、`user_confirmation`。

- `confirmed`：项目内边至少有解析结果和实际调用点；跨应用边满足跨应用指南的更高门槛。
- `probable`：存在结构性证据但仍缺少关键绑定。保留边并产生未决项，不可计入完整结果。
- `unresolved`：多个冲突候选或无法定位。使用 `block` 等待用户，不继续猜测。

工具名称不是证据本身；`detail` 必须足以让另一个 AI 定位并复核。
