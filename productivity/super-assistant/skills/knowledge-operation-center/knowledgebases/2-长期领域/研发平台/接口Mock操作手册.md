---
审查状态: 已确认
来源追溯: heavenly-palace 原平台资料；版本 9383ac13ffc0f5acba2567a819afa79f76ba2b24；历史路径见来源小节
创建时间: 2026-09-16T17:58
修改时间: 2026-09-16T23:43
tags:
  - 研发平台
  - 操作手册
  - Mock
aliases:
  - 接口Mock
  - Mock操作
  - mock-operation-center
---
# 接口Mock操作手册

> [!info] 使用边界
> 平台地址、凭据及界面尚未在线复验。使用时核对目标应用、部署环境和实际权限；下文保留已知的信息缺口与示例适用范围。

## 适用场景与前置定位

需要在联调或测试中模拟依赖接口返回时使用。先确定涉及的应用、部署环境和环境别名；其他平台和测试资料见 [[研发平台入口与环境]]。

| 环境 | Mock平台入口 |
|------|---------------|
| 测试 | http://xingyun.jd.com/mock/singleInterface?env=test |
| 预发、生产 | http://xingyun.jd.com/mock/singleInterface?env=main |

### 登录信息

以下登录信息未逐一说明适用环境，登录时确认：

```text
登录账号：wangshaofan.7
登录密码：331691025QWer@
```

## 操作步骤

以下保留原文测试环境示例。应用、接口、方法、依赖版本和环境别名应替换为本次任务的真实值。

### 1. 确认目标

示例是在 `market-jdou-center` 中 Mock 接口方法 `com.jd.jpos.jingbean.rpc.jsf.JingBeanJsfFacade#incomeBeans`，应用部署环境示例为“开发2(dev2)”。

### 2. 新增接口

访问对应 Mock 平台，点击“新增接口”，填写：

| 字段 | 原文示例或取值方式 |
|------|--------------------|
| 接口名称 | `com.jd.jpos.jingbean.rpc.jsf.JingBeanJsfFacade` |
| Mock别名 | 自行命名，原文示例为 `easymock_easymock_wsf` |
| 方法名称 | `incomeBeans` |
| 指定POM | 选择“是” |
| POM坐标 | 从目标应用 `pom.xml` 中找到提供该接口的依赖坐标 |

原文 POM 示例：

```xml
<dependency>
<groupId>com.jd.jposMiddleware</groupId>
<artifactId>jposMiddleware-rpc</artifactId>
<version>0.4.8-SNAPSHOT</version>
</dependency>
```

这里的版本是原文示例，不表示当前依赖版本；应读取本次应用实际使用的坐标。

### 3. 配置返回模板

创建成功后点击“设置模版”，再点击“新增模版”。配置本次需求要模拟的接口返回参数，可通过“出参示例”查看格式。

### 4. 将调用接入Mock

找到目标应用实际部署的实例及其配置文件，将目标接口的调用别名改为前面创建的 Mock 别名。原文对应的是 `market-jdou-center` 的“开发2(dev2)”环境、上述接口以及 `easymock_easymock_wsf`。

原文没有提供配置文件的准确路径、具体配置键、生效方式或恢复步骤；这些内容必须现场核对，不能把示例当成可直接执行的完整配置。

## 验证与收尾建议

完成 Mock 配置后，按以下步骤检查调用并收尾：

- 变更前记录原接口别名和本次修改范围，便于测试完成后按任务要求恢复。
- 检查实际调用是否命中目标 Mock，并核对返回内容；仅创建接口和模板不代表应用已经接入。
- 配置生效、部署或日志验证需要进一步操作时，分别使用现有部署、日志 Skill，按当前任务范围执行。

## 来源与关联

- 原始资料：`heavenly-palace` 仓库的平台说明。
- 来源版本：`9383ac13ffc0f5acba2567a819afa79f76ba2b24`。
- [[研发平台入口与环境]]：数据、权益、DUCC、JMQ、DeepTest 的入口、环境与登录信息。
- [[知识库导航]]：全库入口。
