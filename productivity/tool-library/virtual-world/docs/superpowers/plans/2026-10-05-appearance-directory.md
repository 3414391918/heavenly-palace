# 当前形象资产目录修复计划

**目标：** 复制按钮返回当前形象的真实独立目录，两套形象各自包含自己的图片。

**设计：** 沿用 assets.json 的资产 ID、标签及文件名；新增可选 directory 字段，其值只能等于记录的 appearanceId。旧记录仍从 assets 根目录读取，新记录从 assets/形象ID 读取。Core 的显式目录准备命令将选中形象的旧图与清单通过项目事务迁移，分批保持内存有界；复制只在迁移完成后返回目录。图片协议仍通过资产 ID 读取，引用 URL 不变。

**技术：** Electron、Vue、Zod、Core Utility、项目事务、Vitest、隔离 Electron 冒烟。

## 执行步骤

- [x] 新建 long-project-store.appearance-directory.test.ts，构造一个角色的两套旧形象。准备第二套目录后，断言目录内容、文件哈希、第一套原图、标签、ID、再次调用和重开；覆盖未知形象、目标冲突、链接及缺图拒绝。
- [x] 运行定向 Vitest，确认目录准备接口缺失使测试失败。
- [x] contracts 定义 directory 与 prepareCharacterAppearanceDirectory 的输入/输出；directory 必须匹配形象 ID。Main、Preload、Core 沿用现有角色资产命令入口。
- [x] Core 迁移模块按现有文件哈希约束提交图片写入、旧路径删除和清单更新。读取与删除、复制书籍和冲突恢复统一通过 characterAssetPaths.binary(filename, directory) 定位。
- [x] 上传新图保存到 assets/appearanceId；更新外部形象制作提示词的目录和清单字段。旧扁平记录继续可读。
- [x] 复制按钮传递当前 appearanceId，使用返回的真实目录，刷新清单。通过真实 Electron 验证第二套目录的剪贴板内容和图片显示。
- [x] 按持久化兼容性及路径隔离分别自审，运行 pnpm verify 与 pnpm smoke；重启实际服务，核对实际图片数量与哈希后迁移星离的两套资产。

## 不变量

- 没有重复图片副本作为浏览目录；迁移保留文件内容、图片 ID、标签及形象归属。
- 旧记录无需立即全部迁移；已有外部任务写入旧格式后仍可以读取并再次整理。
- 准备目录失败不得返回成功，不覆盖碰撞文件；每批图片和清单同时提交。
- 只有明确复制当前形象、确认使用参考形象或上传图片的操作才整理资产；普通读取不写盘。
