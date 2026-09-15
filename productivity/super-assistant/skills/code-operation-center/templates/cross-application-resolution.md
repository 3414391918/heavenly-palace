# 跨应用边解析

## 基本模型

跨应用分析不是把多个本地调用树拼接起来，而是显式构造桥接边：

```text
consumer caller -> client/proxy contract -> provider implementation -> provider local callees
```

报告中可以折叠代理节点，但 JSON 必须保留足以复核的契约、调用点、提供者和绑定证据。RPC、HTTP、gRPC、消息、事件总线和配置路由都按此模型处理。

## 下游：从消费者定位提供者

### 1. 提取远程契约

从调用点获取：

- 协议/框架类型。
- 接口或 endpoint 的全限定身份。
- 完整方法签名或 HTTP method + path。
- alias、group、namespace、version、topic/tag 等路由键。
- 消费者应用及注入/客户端配置。

只有变量名或简单类名不够。重载方法必须解析参数类型。

### 2. 生成候选项目

优先顺序：

1. 用户已给出的应用根目录。
2. `workspace_inventory.py` 发现的 CodeGraph 项目和构建项目。
3. 在明确工作区范围内搜索契约全名、endpoint 或路由键。

不要搜索整个用户主目录。项目路径不唯一或工作区不含目标时，列出已搜索范围并让用户提供/确认路径。

### 3. 验证提供者

自动确认一条 RPC/HTTP 跨应用边，至少需要三个角色的证据：

1. `contract`：消费者调用解析到精确契约和签名。
2. `implementation`：目标方法确实实现/承接该契约。
3. `registration` 或 `configuration`：代码注解、XML/YAML、路由表、框架绑定或生成代码证明该实现作为对应提供者发布。

CodeGraph 的动态分派可强化前两项，但不能代替远程注册证据。缺一项、多个有效提供者或路由随环境变化时，使用 `block` 让用户确认。

用户确认可以解决应用/路由归属歧义，但仍应保留已有代码证据。确认写为 `user_confirmation`，不要伪造成工具发现。

### 4. 继续展开

为每个已确认提供者建立跨应用边，从提供者实现方法继续下游。多个提供者、广播消费者或多实现路由必须分别入队。一直分析到：

- 数据库表/SQL、缓存、文件等持久化边界。
- 无源码第三方系统。
- 已确认但不在用户工作区的外部应用。
- 继续跨应用解析后的最终业务边界。

消息发布不是天然终点。能定位消费者时建立一对多 `mq` 边并继续；无法确定订阅者时阻塞确认。

## 上游：从 ApiImpl/Provider 定位消费者

### 1. 判断是否是远程提供者

对当前候选 `ApiImpl` 或实现方法检查：

- 实现的接口和完整签名。
- RPC/provider 注解、Spring 暴露 Bean、XML/YAML 注册、HTTP mapping。
- 构建依赖中的 API/contract 模块。
- 是否仅被本应用内部调用。

结论分为：

- `local_internal`：无远程暴露证据，只有本应用调用方。
- `remote_provider`：有明确远程注册，必须跨项目找消费者。
- `entry_candidate`：Controller、task、listener、CLI 等进程入口。
- `unresolved`：证据冲突，询问用户。

不能因为类名以 `ApiImpl` 结尾就认定对外，也不能因为本应用没有 caller 就认定系统顶层。

### 2. 穷举消费者

以完整契约、方法签名和路由键为中心，在所有候选应用执行：

1. CodeGraph 查接口方法的调用者及动态绑定。
2. 搜客户端注入、代理工厂、Feign/HTTP client、XML/YAML 和依赖配置。
3. 回读每个命中所在方法，确认真实 caller。
4. 为全部消费者建立 `consumer caller -> provider implementation` 的跨应用边。
5. 在每个消费者 caller 上继续上游队列。

只搜方法名会引入大量同名误报；只搜接口声明又会漏掉生成客户端和配置绑定。两者必须结合。

### 3. 对外与顶层确认

“找不到消费者”只产生顶层候选，必须向用户提供：

- 候选接口/入口及应用。
- 已搜索的全部工作区和项目数。
- 使用的契约、签名和路由键。
- 是否存在未索引或未克隆应用。
- 建议结论及残余风险。

询问用户该候选是否已到达需要的业务最上层。用户回答“是”后记录确认并标为 upstream terminal；回答“否”时请用户给出缺失应用路径或线索，扩展项目清单后恢复分析。可以一次确认一组同类顶层候选，但确认内容必须可追溯。

## 常见框架证据

不同项目以实际技术栈为准，常见线索包括：

- Java RPC：接口依赖、consumer/provider 注解或 XML、alias/group/version。
- Spring/Feign/HTTP：`@FeignClient`、`@RequestMapping`、client builder、网关路由。
- gRPC：生成 stub、proto service、server bind。
- MQ：topic、tag、consumer group、listener 注册。
- SPI/插件：service descriptor、注册表、工厂映射。
- 配置中心：字符串 Bean 名、路由映射、环境化 provider 地址。

关键是形成“调用契约—实现—绑定—应用归属”的闭环，而不是依赖固定框架名列表。

## 无法确认时的提问模板

```text
当前无法唯一确定跨应用边：<consumer contract> -> <provider>。
已搜索：<workspace/project list>。
候选：
1. <app/path/method>，证据：<...>，缺少：<...>
2. <app/path/method>，证据：<...>，缺少：<...>
请确认实际目标应用/方法，或提供目标项目路径、RPC alias/group/version（或 HTTP/MQ 路由信息）。
在确认前，该边保持 unresolved，整体调用图不会标记为完整。
```
