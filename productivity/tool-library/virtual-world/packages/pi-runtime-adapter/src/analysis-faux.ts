import {
  fauxToolCall,
  fauxAssistantMessage,
  fauxText
} from "@earendil-works/pi-ai";
import type { AgentRunInput } from "./runtime-types";
export function analysisFauxResponses(input: AgentRunInput) {
  const revision = input.workspaceContext?.revisionAnalysis;
  if (revision)
    return [
      fauxAssistantMessage(
        fauxToolCall(
          "create_skill_draft",
          {
            title: "修改方向技能",
            description: "在文稿修订时根据修改证据调整表达并保留作品事实。",
            content:
              "# 修改方向\n\n适用场景：文稿修订。\n\n1. 阅读原文与修改目标。\n2. 根据证据调整表达。\n3. 检查是否保留作品事实。\n\n这是 Faux Runtime 验证草稿。"
          },
          { id: `${input.runId}-revision-result` }
        ),
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage(
        fauxText(
          "# 修改分析报告\n\n这是 Faux Runtime 验证结果。\n\n" +
            revision.changes
              .map(
                (c, i) =>
                  `差异 ${i + 1}（${c.id}）：${c.reason || "修改动机为推断"}`
              )
              .join("\n")
        )
      )
    ];
  const short = input.workspaceContext?.shortBookAnalysis;
  if (short)
    return [
      fauxAssistantMessage(
        fauxToolCall(
          "write_analysis_result",
          {
            name: `${input.shortBookAnalysisProfile?.name ?? "短篇拆书"}｜${short.books.length} 本`,
            description: "根据作品证据提炼可复用的写作方法与适用场景。",
            content: `# 短篇联合分析\n\n${short.books.map((b) => `- 《${b.title}》：已读取完整短篇。`).join("\n")}\n\n这是 Faux Runtime 验证结果。`
          },
          { id: `${input.runId}-short-result` }
        ),
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage(fauxText("短篇拆书分析完成。"))
    ];
  const analysisContext = input.workspaceContext?.longBookAnalysis;
  if (!analysisContext) return undefined;
  const chapterStart = analysisContext.selectionStart;
  const chapterEnd = analysisContext.selectionEnd;
  const toolCall =
    analysisContext.phase === "final"
      ? fauxToolCall(
          "write_analysis_result",
          {
            name: `${input.longBookAnalysisProfile?.name ?? "长篇拆书"}｜第 ${chapterStart}-${chapterEnd} 章`,
            description: "根据作品证据提炼可复用的写作方法与适用场景。",
            content: [
              `# ${input.longBookAnalysisProfile?.name ?? "长篇拆书分析"}`,
              "",
              `> 分析范围：第 ${chapterStart}-${chapterEnd} 章`,
              "",
              "## 核心发现",
              "",
              "- 这是 Faux Runtime 生成的端到端验证结果；真实模型会依据分批笔记填充完整证据、结构与可复用模板。",
              "",
              "## 执行模板",
              "",
              "1. 识别章节目标与阻力。",
              "2. 标记转折、兑现与结尾钩子。",
              "3. 将重复规律整理成可迁移检查清单。"
            ].join("\n")
          },
          { id: `${input.runId}-analysis-result` }
        )
      : fauxToolCall(
          "write_analysis_note",
          {
            text: [
              `范围：第 ${chapterStart}-${chapterEnd} 章。`,
              `阶段：${analysisContext.phase === "batch" ? "章节分批提炼" : "中间笔记归并"}。`,
              "Faux 验证笔记：已保留章节范围、关键结构标签与递归归并所需的摘要边界。"
            ].join("\n")
          },
          { id: `${input.runId}-analysis-note` }
        );
  return [
    fauxAssistantMessage(toolCall, { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxText("当前长篇拆书阶段已完成。"))
  ];
}
