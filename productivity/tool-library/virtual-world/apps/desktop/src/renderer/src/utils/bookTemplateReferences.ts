import type {
  BookTemplateDraft,
  CreativePlotStage,
  MaterialLibrary,
  SkillLibrary
} from "@deepwrite/contracts";
export function bookTemplateReferenceError(
  configuration: BookTemplateDraft,
  catalog: {
    creativePlotStages: readonly CreativePlotStage[];
    materials: readonly Pick<MaterialLibrary, "id" | "materialKind">[];
    skills: readonly Pick<SkillLibrary, "id" | "skillKind">[];
  }
): string | null {
  if (
    configuration.defaultPlotStageIds.some(
      (id) => !catalog.creativePlotStages.some((stage) => stage.id === id)
    )
  )
    return "模板中的剧情阶段已失效，请编辑模板后重试。";
  for (const [kind, ids] of Object.entries(
    configuration.linkedMaterialIdsByKind
  )) {
    if (
      ids.some(
        (id) =>
          !catalog.materials.some(
            (item) =>
              item.id === id &&
              (item.materialKind === kind || item.materialKind === "mixed")
          )
      )
    )
      return "模板中的素材库已失效，请重新选择。";
  }
  for (const [kind, ids] of Object.entries(
    configuration.linkedSkillIdsByKind
  )) {
    if (
      ids.some(
        (id) =>
          !catalog.skills.some(
            (item) => item.id === id && item.skillKind === kind
          )
      )
    )
      return "模板中的技能库已失效，请重新选择。";
  }
  return null;
}
