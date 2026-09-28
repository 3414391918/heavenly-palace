# 移动端会话过程区

对照桌面端已经落地的助手过程区，给 DeepWrite **手机客户端**实现。不是给外部产品抄样式。

桌面源码在本仓库 `apps/desktop/src/renderer`。手机按同一套**可见结构、折叠规则、文案和时序**做原生界面（Expo / React Native），不要把 Vue 的 `details/summary` 或桌面 CSS 原样搬过去。

聊天记录本身不进双端同步。两端各自画过程区，但用户看到的层次和用词必须一致。

---

## 1. 要对齐什么

桌面刚改完的体验：

1. 思考和工具不再上下交替铺成「思考过程 / 执行完成」长列表。
2. 相邻干活过程收成一行「处理中 / 处理完成」，点开才看到里面的思考和工具。
3. 整轮顶部始终是「已处理 Ns」计时；这几个字不要改成「处理中」。
4. 用户一点发送，第一帧就是这条计时，不要先闪「正在思考」或其它占位句。
5. 整轮结束后，过程区收成一行可展开的「已处理 Ns」，默认合上。

手机做完后，同一轮生成在两端应是同一套信息层次，只是控件换成触控。

---

## 2. 可见结构

```text
助手消息
├─ 过程区
│   ├─ 已处理 Ns                         整轮唯一计时
│   ├─ 处理中 / 处理完成                 工作组，默认合上
│   │    └─ 思考中 / 思考过程 / 工具     组内再折，相对组标题缩进
│   ├─ 可见回复 / 子智能体卡 / 审批卡     打断物，不进工作组
│   └─ 回复之后若又开始干活，再开一组「处理中」
└─ 气泡正式回复                          整轮结束后才放最后一段正文
```

两种外壳，计时不要删：

| 阶段 | 外壳 |
| --- | --- |
| 正在生成（`status === "streaming"`） | 列表顶上粘着「已处理 Ns」，下面跟工作组和打断物 |
| 本轮已结束 | 整段过程包进一行「已处理 Ns」，默认合上；点开后内部仍是工作组 + 打断物 |

没展开时，过程区最多两行：计时 +「处理中」或「处理完成」。

流式中如果过程区已经在写可见回复，气泡正文留空，避免同一段字上下出现两次。结束后，最后一段升到气泡；更早的阶段性回复留在过程区里。

---

## 3. 折叠规则

先得到时间线条目（思考、回复、工具、工具组、子智能体、审批卡），再把连续的**工作成员**合成工作组。

**进组**

- 思考
- 只读工具，以及连续只读工具合成的工具组
- 写入类工具（属于干活过程，不要单独拎到组外）

**打断（单独成行，切开工作组）**

- 非空回复
- 子智能体卡片
- 文件审批卡 / 长篇提案卡

**额外**

- 空回复丢掉，不当打断，也不渲染。
- 一组可以包含多段思考和工具，只要中间没有打断物。
- 「处理中」只给**最后一组，且该条助手消息仍在 streaming**。前面的组只要后面已经出现可见回复，即使整轮还在流，也显示「处理完成」。
- 子智能体卡片内部的思考/工具用同一套工作组，不要在卡片外面再铺一层交替列表。

```ts
function foldWorkGroups(items, streaming) {
  const result = [];
  let current;

  const flush = () => {
    if (current) result.push(current);
    current = undefined;
  };

  for (const item of items) {
    if (item.type === "response" && !item.content) continue;
    if (
      item.type === "thinking" ||
      item.type === "tool" ||
      item.type === "tool-group"
    ) {
      current ??= { type: "work-group", running: false, items: [] };
      current.items.push(item);
      continue;
    }
    flush();
    result.push(item);
  }
  flush();

  if (streaming) {
    const last = result.at(-1);
    if (last?.type === "work-group") last.running = true;
  }
  return result;
}
```

桌面对照：

- `apps/desktop/src/renderer/src/components/conversationWorkGroups.ts`
- `conversationToolPresentation.ts` 的 `processingDisplayItems`（先编条目，再 `foldWorkGroups`）
- 子智能体：`subagentRunPresentation.ts`

---

## 4. 文案

| 位置 | 文案 | 条件 |
| --- | --- | --- |
| 顶部计时 | `已处理 Ns` | 默认；N 至少为 1，不要 `0s` |
| 顶部计时 | `模型排队中 · 已等待 Ns` | 已流式 ≥ 10s，且还没有任何思考 / 工具 / 正文 |
| 顶部计时 | `正在重试（第 a/b 次）` 或 `网络波动，Ns 后重试（第 a/b 次）` | 重试中，覆盖「已处理」 |
| 工作组 | `处理中` | 仅 streaming 下的最后一组 |
| 工作组 | `处理完成` | 其它组，以及整轮结束后的组 |
| 组内思考 | `思考中` | 该组 `running` 且整轮仍在流 |
| 组内思考 | `思考过程` | 其余 |

顶部计时**禁止**写成「处理中」。这两个字只给工作组标题。

桌面对照：`processingLabel`、`workGroupLabel`、思考行 `streaming && running ? "思考中" : "思考过程"`。

---

## 5. 发送后立刻出现计时

不要在列表底部再挂一条与助手消息无关的占位（「正在思考」、静态「已处理 1s」等）。那种占位会先画一遍，等真正的助手消息进来再换组件，字会闪。

做法：用户点发送后立刻插入一条空的流式助手消息：

- `role: "assistant"`
- `status: "streaming"`
- `activityOnly: true`
- `processingStartedAt` = 发送时刻
- 此时还没有 `runId`

界面第一帧就走过程区，从 `processingStartedAt` 起算「已处理 1s」。

之后：

- 真正的 `runId` / `messageId` 到达时**认领**这条消息，不要再插第二条助手气泡。
- 发送失败、切会话、受理超时且尚未观察到 run：删掉这条未认领占位。
- 落盘时不要保存 `activityOnly && !runId` 的消息。
- 错误/停止收尾也先认领再改状态，避免空占位旁边再长出一个错误气泡。

桌面对照：

- 创建 / 丢弃 / 认领：`composables/agent-conversation/message-identity.ts`
- 发送时插入：`composables/agent-conversation/send-message.ts`
- 过滤未认领占位：`composables/agent-conversation/persistence-history.ts`

消息字段以桌面 `ChatMessage` 为准：`processingSteps`、`processingStartedAt`、`processingCompletedAt`、`activityOnly`、`status`、`retry`。

---

## 6. 视觉（手机特有约束）

### 6.1 「处理中」扫光

只给「处理中」四个字做从左扫到右的高光，类似 Cursor 状态行那种活着的感觉。

- 不要整行闪底色，不要换字体。
- 「思考中」「处理完成」「已处理 Ns」保持静止三级灰。
- 系统「减少动态效果」开启时关掉扫光。

桌面实现是文字渐变位移（`background-clip: text` + 1.8s 循环）。手机用 Reanimated / MaskedView 等价即可。

### 6.2 箭头

图标本体朝右。

| 状态 | 朝向 |
| --- | --- |
| 合上 | 向右 |
| 展开 | 向下 |

不要做成合上朝下、展开朝上。

桌面因为有鼠标，箭头默认隐藏、悬停才出现。**手机没有悬停**：折叠行应始终露出这颗小箭头，否则用户不知道能点。触控热区按行高来，不要只点得到 13px 图标。按压时可以略加深文字或箭头，不要靠长按才提示。

### 6.3 缩进与思考正文

工作组展开后，内部条目相对组标题左缩进约 16pt，左侧一条淡分隔，表明是组内细节。

思考正文：弱化灰色、保留换行、**不要 Markdown**。可见回复：正文色 Markdown。流式光标只给气泡正式回复，过程区里的回复不要再画光标。

合上时不要挂载长思考正文。展开状态跟这条消息走，滑出屏幕再回来应保持。

### 6.4 计时与无障碍

计时每秒更新，但不要用会每秒朗读的 live region。VoiceOver 读标题即可，不要读秒数变化。

运行中的工作组在无障碍树上标为忙（busy）。

用户一旦上滑离开底部，后续 token 不要再把列表拽回底部。

---

## 7. 桌面文件索引

实现时以这些为准，而不是以 `docs/STREAM_DESIGN.md` 的 HTML 拷贝为准（那份是桌面样式摘录，不适合直接进 RN）。

| 内容 | 路径 |
| --- | --- |
| 工作组折叠 | `apps/desktop/src/renderer/src/components/conversationWorkGroups.ts` |
| 展示条目 + 计时文案 | `.../conversationToolPresentation.ts` |
| 流式 / 结束后两种外壳 | `.../ConversationProcessingTimeline.vue` |
| 工作组行 | `.../ConversationWorkGroup.vue` |
| 思考 / 工具行 | `.../ConversationProcessingItem.vue` |
| 子智能体内部过程 | `.../subagentRunPresentation.ts`、`SubagentRunList.vue` |
| 发送占位 | `.../composables/agent-conversation/send-message.ts` |
| 占位身份 | `.../composables/agent-conversation/message-identity.ts` |
| 扫光与箭头（桌面 CSS） | `apps/desktop/src/renderer/src/styles.css` 过程区一段 |

---

## 8. 手机验收

- [ ] 点发送后第一眼就是 `已处理 1s`，不闪其它文案。
- [ ] 生成过程中计时一直在；结束后变成一行可展开的 `已处理 Ns`，默认合上。
- [ ] 连续思考/工具合成「处理中 / 处理完成」，不再交替铺开。
- [ ] 非空回复、子智能体卡、审批卡切开工作组。
- [ ] 只有最后一组在 streaming 时显示「处理中」并扫光。
- [ ] 箭头合上朝右、展开朝下；手机上始终可见。
- [ ] 组内有缩进；思考是纯文本。
- [ ] 发送失败不留下空的流式助手。
- [ ] 减少动态效果时无扫光。
- [ ] 上滑阅读时不强制吸底。
- [ ] 小屏、动态岛/横条安全区、系统动态字号下，折叠行仍可点、不裁切。
