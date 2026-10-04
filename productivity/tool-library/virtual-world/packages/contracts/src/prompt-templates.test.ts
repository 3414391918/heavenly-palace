import { describe, expect, it } from "vitest";
import {
  CommandEnvelopeSchema,
  createEnvelope,
  PromptTemplateSchema,
  PromptTemplatesSchema
} from "./index";

describe("prompt template public commands", () => {
  it("accepts single-template saves and deletes through the command envelope", () => {
    const template = {
      id: "template-one",
      name: "检查人物",
      content: "检查当前人物状态。"
    };
    for (const payload of [
      { action: "save", template },
      { action: "delete", id: template.id }
    ]) {
      expect(
        CommandEnvelopeSchema.parse(
          createEnvelope("longAgents.updatePromptTemplate", payload, {
            id: "cmd_template_test"
          })
        ).payload
      ).toEqual(payload);
    }
  });
  it("rejects blank text and duplicate IDs but accepts an intentionally empty list", () => {
    const template = { id: "one", name: "模板", content: "有效内容" };
    expect(
      PromptTemplateSchema.safeParse({ ...template, content: "  " }).success
    ).toBe(false);
    expect(
      PromptTemplateSchema.safeParse({ ...template, name: "  " }).success
    ).toBe(false);
    expect(PromptTemplatesSchema.safeParse([template, template]).success).toBe(
      false
    );
    expect(PromptTemplatesSchema.parse([])).toEqual([]);
  });
});
