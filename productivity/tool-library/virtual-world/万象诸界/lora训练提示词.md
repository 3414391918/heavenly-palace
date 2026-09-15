训练集路径：【填写服务器上的训练集绝对路径】
身份固定前缀：【填写唯一身份触发词，例如 xingli_001】

请完整执行角色 LoRA 的打标、训练、checkpoint 归档、结果交付和清理工作。

一、基本要求

1. 用户只负责启动 GPU 服务器。服务器启动完成后，AI Toolkit 服务的检查、启动、故障处理以及网页打开操作全部由 Agent 完成，不得要求用户手动执行启动命令。

2. 启动并打开 AI Toolkit：

   2.1 检查服务器上的 AI Toolkit 项目目录：

   /root/ai-toolkit

   确认项目文件、Python 环境、Node.js 环境和现有启动脚本仍然完整。

   2.2 检查 8675 端口和 AI Toolkit 进程：

   - 如果服务已经正常运行，不要重复启动或终止现有进程。
   - 分别检查：
     - AI Toolkit 相关进程
     - 8675 端口监听状态
     - http://127.0.0.1:8675 是否能够正常响应
     - http://117.50.216.10:8675/jobs/new 是否能够访问

   2.3 如果服务没有运行：

   - 进入 `/root/ai-toolkit`。
   - 检查服务器现有的启动脚本、`package.json`、运行环境和历史启动方式。
   - 使用项目已经配置好的正确命令启动 AI Toolkit。
   - 加载服务器上已经配置的 `AI_TOOLKIT_AUTH` 等必要环境变量，但不得在日志或回复中暴露这些环境变量的值。
   - 服务必须监听能够通过公网访问的地址和 8675 端口。
   - 使用可持续运行的方式启动服务，确保关闭当前终端后 AI Toolkit 不会随之退出。
   - 将启动日志写入明确的日志文件，方便后续排查。

   2.4 如果启动失败，Agent 必须自行检查并解决：

   - 端口占用
   - 残留进程
   - Python 或 Node.js 环境问题
   - 依赖缺失
   - 环境变量未加载
   - 权限问题
   - 前端或后端启动报错
   - GPU、CUDA 或模型环境异常

   修复后重新启动并验证，不得仅把错误信息转交给用户。

   2.5 服务启动后必须完成以下验证：

   - 8675 端口处于监听状态
   - AI Toolkit 进程持续运行
   - 本机地址能够返回正常页面
   - 公网地址能够访问
   - `/jobs/new` 页面能够完整加载
   - 页面没有持续报错、白屏或服务连接失败
   - 能够正常进入新建训练任务界面

   2.6 使用浏览器实际打开：

   http://117.50.216.10:8675/jobs/new

   不得只通过命令行判断服务正常。必须在浏览器中确认 AI Toolkit 页面已经成功打开，并能够进行后续训练配置操作。

3. 使用以下训练模板：

   /root/ComfyUI/models/loras/krea2/training_template.json

4. 将模板中的字段替换为：

   - `__DATASET_PATH__`：用户提供的训练集路径
   - `__TRIGGER_WORD__`：用户提供的身份固定前缀
   - `__JOB_NAME__`：根据身份固定前缀和当前时间自动生成的唯一任务名称sssssssssssssssssss

5. 必须通过 AI Toolkit 网页创建并启动训练任务，让用户能够在网页中直接查看训练状态、生成样本和 checkpoint。

6. 不得自行创造其他身份词、角色名、英文别名或随机触发词。整个打标、训练和生成样本过程只能使用用户提供的身份固定前缀。

7. 未经用户明确要求，不得关闭 GPU 实例。用户负责服务器的最终关机操作。

二、训练集检查

打标前检查：

1. 统计图片数量、分辨率、格式和损坏情况。
2. 检查是否存在一图多份、重复图、严重模糊图或异常裁剪。
3. 检查图片是否覆盖：
   - 脸部特写
   - 头肩近景
   - 上半身
   - 中景
   - 全身
   - 三分之二侧脸
   - 侧脸
   - 服装局部
   - 鞋子及腿部
4. 检查人物是否始终为同一人。
5. 检查服装是否为同一套。若发现明显不同的服装，在训练前向用户报告，不得擅自把不同服装标成同一套。
6. 如果已有标注文件，先检查并备份，不得直接覆盖用户原始标注。

三、打标规则

为每张图片创建同名 `.txt` 标注文件。

统一格式：

【身份固定前缀】, 【景别】, 【人物视角】, 【表情】, 【姿势或动作】, 【当前可见的固定服装描述】, 【背景】, 【光线】

例如：

xingli_001, close-up portrait, frontal view, neutral expression, looking at the camera, black high-collar upper garment with silver embroidered trim, dark studio background, soft dramatic lighting

必须遵守以下规则：

1. 每一个标注必须以用户提供的身份固定前缀开头，而且必须完全一致。

2. 标注中不得出现任何其他身份词或历史触发词。例如用户提供的是 `xingli_001`，就不得残留 `zlyra`、其他随机英文名或自动生成的别名。

3. 修改 AI Toolkit 的 Trigger Word 不等于修改标注文件。必须真正检查和修改每一个 `.txt` 文件，不能只改网页中的 Trigger Word。

4. 景别使用统一词汇：
   - extreme close-up portrait
   - close-up portrait
   - head-and-shoulders portrait
   - upper-body portrait
   - medium shot
   - three-quarter body portrait
   - full-body character portrait
   - close-up of the lower outfit and legs
   - close-up of legs and footwear

5. 视角使用统一词汇：
   - frontal view
   - left three-quarter view
   - right three-quarter view
   - left side profile
   - right side profile
   - rear view

6. 先查看清晰的上半身和全身素材，提炼一条准确的“固定服装标准描述”。必须包括实际可见的：
   - 主体颜色
   - 服装款式和剪裁
   - 领口
   - 袖型
   - 面料或质感
   - 花纹、刺绣和装饰
   - 腰带或配饰
   - 裤装或裙装
   - 鞋子

7. 同一个服装部位必须始终使用同一种描述，不得一张写 black coat、另一张写 dark robe、又一张写 black costume。

8. 不得使用以下模糊服装描述：
   - same clothes
   - same outfit
   - training outfit
   - original clothes
   - character costume

9. 特写图片只描述实际可见的服装部分，不得凭空添加画面中不可见的鞋子、裤子或下半身细节。

10. 全身图片必须完整描述上衣、下装、腰部配饰和鞋子，以强化整套服装的一致性。

11. 不要在标注中反复详细描述人物固有的五官形状。人物身份、脸型、眼睛、鼻子和嘴唇应主要绑定到身份固定前缀，避免被拆散绑定到大量普通单词。

12. 不得加入与图片无关的质量词、风格词和摄影词，例如 masterpiece、best quality、8K，除非这些内容确实属于素材风格且需要被 LoRA 学习。

四、标注质量检查

完成打标后必须自动检查：

1. 图片数量与标注数量完全一致。
2. 每个图片文件都有唯一同名标注。
3. 所有标注第一项都完全等于用户提供的身份固定前缀。
4. 搜索所有标注，确认不存在其他身份词、旧触发词或随机别名。
5. 固定服装的颜色、款式和配饰描述不存在相互矛盾。
6. 抽查全部脸部特写、上半身和全身标注。
7. 向用户报告：
   - 图片数量
   - 标注数量
   - 身份固定前缀
   - 提炼出的固定服装标准描述
   - 是否发现异常图片或服装冲突

确认检查通过后再启动训练。

五、训练配置

1. 使用 Krea 2 Raw 底模。
2. 其余学习率、步数、LoRA Rank、优化器、显存卸载、采样间隔和生成设置使用已保存的训练模板。
3. 所有生成样本的正向提示词必须以用户提供的身份固定前缀开头。
4. 样本提示词不得包含其他身份词或历史触发词。
5. 样本提示词中的服装描述必须使用打标阶段确定的固定服装标准描述。
6. 保留近景、上半身和全身样本，用于检查五官和服装一致性。

六、保存每一个 checkpoint

1. AI Toolkit 可能只保留最近几个 checkpoint，因此必须在训练开始前创建独立归档目录：

   /root/ai-toolkit/checkpoint_archive/<任务名称>/

2. 每生成一个 checkpoint，立即复制到独立归档目录。
3. 复制后校验文件大小或 SHA-256。
4. 不得因为 AI Toolkit 的滚动保存机制丢失任何 checkpoint。
5. 用户没有明确选择前，不得主观删除或替用户选择 checkpoint。

七、训练结束后的交付

训练完成后向用户提供：

1. 任务名称。
2. 身份固定前缀。
3. 固定服装标准描述。
4. 全部 checkpoint 的步数、文件名、大小和路径。
5. 每个 checkpoint 对应的代表性样本。
6. 训练是否完整结束以及是否出现异常。

等待用户决定保留哪些 checkpoint，并等待用户提供：

- 要保留的 checkpoint 步数
- 最终模型命名
- 最终保存路径

收到后复制模型、代表样本、实际训练配置和可复用训练模板，并逐个校验文件一致性。

八、生成触发提示词文件

在用户指定的最终模型保存目录中创建：

IDENTITY_PROMPT.txt

文件只能包含以下三部分，不要添加动作库、镜头模板、ComfyUI 操作说明或其他身份词。

【身份固定前缀】

格式：

用户提供的身份固定前缀, same character, consistent facial identity, identical facial features, same facial proportions, same face shape, same eyes, same eyebrows, same nose, same lips, same hairstyle, same hair color, natural realistic skin texture

【固定服装描述】

使用打标阶段从训练素材中提炼出的固定服装标准描述。必须具体描述服装颜色、款式、面料、领口、袖型、装饰、下装和鞋子，不得使用 same outfit 等模糊词。

【负面提示词】

different person, inconsistent identity, altered facial features, different face shape, different eyes, different eyebrows, different nose, different lips, different hairstyle, different hair color, different outfit, incorrect clothing colors, missing clothing details, altered costume design, doll face, plastic face, waxy skin, over-smoothed skin, deformed face, distorted face, asymmetrical eyes, bad anatomy

九、训练文件清理

只有满足以下条件后才能清理：

1. 用户已经选定 checkpoint。
2. 用户已经提供最终保存路径。
3. 模型、样本、训练配置和 IDENTITY_PROMPT.txt 已复制成功。
4. 所有文件一致性校验通过。

永久删除前列出准确的删除目标并取得用户确认。

确认后清理：

- AI Toolkit 本次任务输出目录
- 未选 checkpoint 归档
- 全量生成样本
- 训练缓存
- 临时日志和监控文件

默认保留用户原始图片和最终标注文件，不得删除。清理后报告释放空间和当前磁盘占用。未经用户明确要求，不得关闭 GPU 实例。

