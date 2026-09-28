import {
  LongBookAnalysisResultSchema,
  parseSkillMarkdown,
  updateMaterialMarkdownMetadata,
  updateSkillMarkdownMetadata,
  type LongBookAnalysisResult
} from "@deepwrite/contracts/renderer";

/** Prepare an edited preview for the existing catalog save/conflict flow. */
export function analysisResultEntry(
  draft: LongBookAnalysisResult,
  domain: "material" | "skill"
): { title: string; content: string } {
  const result = LongBookAnalysisResultSchema.safeParse(draft);
  if (!result.success) {
    throw new Error(
      "请填写结果名称、描述和正文；名称最多 256 字符，描述最多 1,000 字符，正文最多 200,000 字符。"
    );
  }
  const { name, description, content } = result.data;
  const updated = (
    domain === "skill"
      ? updateSkillMarkdownMetadata
      : updateMaterialMarkdownMetadata
  )(content, { name, description });
  if (!updated.updated) throw new Error(updated.message);
  if (domain === "skill") {
    const parsed = parseSkillMarkdown(updated.content);
    if (!parsed.valid) throw new Error(parsed.message);
  }
  return { title: name, content: updated.content };
}
