---
name: mock-operation-center
description: 当用户提到需要mock某个接口的时候使用这个skill
---

在使用这个skill之前必须先确认当前需求涉及到的所有应用所部署在的环境的别名

测试mock地址：http://xingyun.jd.com/mock/singleInterface?env=test
预发和生产mock地址：http://xingyun.jd.com/mock/singleInterface?env=main
登录账号：wangshaofan.7
登录密码：331691025QWer@

以测试环境在market-jdou-center应用中mock掉com.jd.jpos.jingbean.rpc.jsf.JingBeanJsfFacade#incomeBeans这个方法为例

访问测试mock地址后点击“新增接口”
在出现的弹窗中输入：
1、接口名称（com.jd.jpos.jingbean.rpc.jsf.JingBeanJsfFacade）
2、mock别名（随便起，以easymock_easymock_wsf为例）
3、方法名称（incomeBeans）
4、指定pom选择“是”
5、pom坐标在market-jdou-center中的pom.xml文件中找到引入com.jd.jpos.jingbean.rpc.jsf.JingBeanJsfFacade这个接口的jar包pom坐标
比如：
<dependency>
<groupId>com.jd.jposMiddleware</groupId>
<artifactId>jposMiddleware-rpc</artifactId>
<version>0.4.8-SNAPSHOT</version>
</dependency>

创建成功之后点击“设置模版”，再点击“新增模版”。
在出现的弹窗中配置这次需求需要mock的接口的返回参数，可以点击“出参示例”查看怎么配置。

最后关键的一步就是找到market-jdou-center这个应用部署在的环境，以“开发2(dev2)”环境为例，找到这个实例的配置文件，将调用这个com.jd.jpos.jingbean.rpc.jsf.JingBeanJsfFacade
接口的别名改成mock的别名easymock_easymock_wsf即可。