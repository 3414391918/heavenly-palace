import { z } from "zod";

export const PromptTemplateSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1, "请输入模板名称").max(200),
    content: z
      .string()
      .min(1)
      .max(100_000)
      .refine((value) => value.trim().length > 0, "请输入模板内容")
  })
  .strict();
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;

export const PromptTemplatesSchema = z
  .array(PromptTemplateSchema)
  .max(200)
  .superRefine((templates, context) => {
    const ids = new Set<string>();
    templates.forEach((template, index) => {
      if (ids.has(template.id))
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "模板 ID 不能重复"
        });
      ids.add(template.id);
    });
  });

export const PromptTemplateUpdateSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("save"), template: PromptTemplateSchema })
    .strict(),
  z
    .object({ action: z.literal("delete"), id: PromptTemplateSchema.shape.id })
    .strict()
]);
export type PromptTemplateUpdate = z.infer<typeof PromptTemplateUpdateSchema>;

/** Used only when an existing configuration has never saved templates. */
export function promptTemplatesFromShortcuts(
  shortcuts: readonly string[]
): PromptTemplate[] {
  return shortcuts.map((text, index) => ({
    id: `welcome-${index + 1}`,
    name: text,
    content: text
  }));
}
