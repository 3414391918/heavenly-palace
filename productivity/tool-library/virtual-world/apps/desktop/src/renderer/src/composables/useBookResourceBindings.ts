import { computed, reactive, ref, watch } from "vue";
import type {
  LinkedMaterialIdsByKind,
  LinkedSkillIdsByKind,
  MaterialKind,
  MaterialLibraryGroup,
  SkillKind,
  SkillLibraryGroup
} from "@deepwrite/contracts";
import type {
  BookResourceDialogMode,
  ResourceTreeNode
} from "../types/workspace";

interface BookResourceBindingProps {
  mode: BookResourceDialogMode | null;
  book: ResourceTreeNode | null;
  materialLibraries: ResourceTreeNode[];
  skillLibraries: ResourceTreeNode[];
  materialGroups: readonly MaterialLibraryGroup[];
  skillGroups: readonly SkillLibraryGroup[];
}

const MATERIAL_KINDS: ReadonlyArray<{
  id: MaterialKind;
  label: string;
  description: string;
}> = [
  { id: "character", label: "人设素材库", description: "人物与关系设定" },
  { id: "gimmick", label: "梗素材库", description: "核心创意与钩子" },
  { id: "plot", label: "剧情素材库", description: "剧情、导语与细化" },
  { id: "draft", label: "正文素材库", description: "正文片段与表达参考" },
  { id: "other", label: "其他素材库", description: "未归入以上分类的素材" }
];
const SKILL_KINDS: ReadonlyArray<{
  id: SkillKind;
  label: string;
  description: string;
}> = [
  { id: "general", label: "通用技能库", description: "多个阶段均可使用" },
  { id: "plot", label: "剧情设计技能库", description: "人物、剧情与大纲方法" },
  { id: "style", label: "文风写作技能库", description: "正文与分节写作方法" },
  { id: "other", label: "其他技能库", description: "自定义写作方法" }
];

export function useBookResourceBindings(props: BookResourceBindingProps) {
  const bindingMode = ref<"single" | "group">("single");
  const selectedGroupId = ref("");
  const selectedMaterialIds = reactive<Record<MaterialKind, string>>({
    character: "",
    gimmick: "",
    plot: "",
    draft: "",
    other: ""
  });
  const selectedSkillIds = reactive<Record<SkillKind, string>>({
    general: "",
    plot: "",
    style: "",
    other: ""
  });
  const bindingDomain = computed<"skill" | "material" | null>(() => {
    if (props.mode === "bind-skill") return "skill";
    if (props.mode === "bind-material") return "material";
    return null;
  });
  function materialCandidates(kind: MaterialKind): ResourceTreeNode[] {
    return props.materialLibraries.filter(
      (library) =>
        library.materialKind === kind || library.materialKind === "mixed"
    );
  }

  function materialKindDescription(
    kind: (typeof MATERIAL_KINDS)[number]
  ): string {
    return props.book?.workspaceType === "script" && kind.id === "plot"
      ? "剧情设计与细化"
      : kind.description;
  }

  function skillKindDescription(kind: (typeof SKILL_KINDS)[number]): string {
    return props.book?.workspaceType === "script" && kind.id === "style"
      ? "正文与分集写作方法"
      : kind.description;
  }

  function skillCandidates(kind: SkillKind): ResourceTreeNode[] {
    return props.skillLibraries.filter((library) => library.skillKind === kind);
  }

  function materialGroupLinks(
    group: MaterialLibraryGroup | undefined
  ): LinkedMaterialIdsByKind {
    const links: LinkedMaterialIdsByKind = {
      character: [],
      gimmick: [],
      plot: [],
      draft: [],
      other: []
    };
    if (!group) return links;
    for (const { id: kind } of MATERIAL_KINDS) {
      const libraryId = group.members[kind];
      if (
        libraryId &&
        materialCandidates(kind).some((library) => library.id === libraryId)
      ) {
        links[kind] = [libraryId];
      }
    }
    return links;
  }

  function skillGroupLinks(
    group: SkillLibraryGroup | undefined
  ): LinkedSkillIdsByKind {
    const links: LinkedSkillIdsByKind = {
      general: [],
      plot: [],
      style: [],
      other: []
    };
    if (!group) return links;
    for (const { id: kind } of SKILL_KINDS) {
      const libraryId = group.members[kind];
      if (
        libraryId &&
        skillCandidates(kind).some((library) => library.id === libraryId)
      ) {
        links[kind] = [libraryId];
      }
    }
    return links;
  }

  const availableMaterialGroups = computed(() =>
    props.materialGroups.filter((group) =>
      MATERIAL_KINDS.some(({ id }) => materialGroupLinks(group)[id].length > 0)
    )
  );
  const availableSkillGroups = computed(() =>
    props.skillGroups.filter((group) =>
      SKILL_KINDS.some(({ id }) => skillGroupLinks(group)[id].length > 0)
    )
  );
  const availableGroups = computed(() =>
    bindingDomain.value === "skill"
      ? availableSkillGroups.value
      : availableMaterialGroups.value
  );
  const selectedMaterialGroup = computed(() =>
    availableMaterialGroups.value.find(
      (group) => group.id === selectedGroupId.value
    )
  );
  const selectedSkillGroup = computed(() =>
    availableSkillGroups.value.find(
      (group) => group.id === selectedGroupId.value
    )
  );
  const groupOptions = computed(() => [
    { value: "", label: bindingDomain.value === "skill" ? "不绑定" : "不关联" },
    ...availableGroups.value.map((group) => ({
      value: group.id,
      label: group.title
    }))
  ]);

  function materialOptions(
    kind: MaterialKind
  ): Array<{ value: string; label: string }> {
    return [
      { value: "", label: "不关联" },
      ...materialCandidates(kind).map((library) => ({
        value: library.id,
        label: library.badge
          ? `${library.label} · ${library.badge}`
          : library.label
      }))
    ];
  }

  function skillOptions(
    kind: SkillKind
  ): Array<{ value: string; label: string }> {
    return [
      { value: "", label: "不绑定" },
      ...skillCandidates(kind).map((library) => ({
        value: library.id,
        label: library.badge
          ? `${library.label} · ${library.badge}`
          : library.label
      }))
    ];
  }

  function resetBindingDraft(): void {
    bindingMode.value = "single";
    selectedGroupId.value = "";
    for (const { id } of MATERIAL_KINDS) {
      selectedMaterialIds[id] =
        props.book?.boundMaterialLibraryIdsByKind?.[id]?.[0] ?? "";
    }
    for (const { id } of SKILL_KINDS) {
      selectedSkillIds[id] =
        props.book?.boundSkillLibraryIdsByKind?.[id]?.[0] ?? "";
    }
  }

  watch(availableGroups, (groups) => {
    if (
      selectedGroupId.value &&
      !groups.some((group) => group.id === selectedGroupId.value)
    ) {
      selectedGroupId.value = "";
    }
  });

  return {
    MATERIAL_KINDS,
    SKILL_KINDS,
    bindingMode,
    selectedGroupId,
    selectedMaterialIds,
    selectedSkillIds,
    bindingDomain,
    materialKindDescription,
    skillKindDescription,
    materialGroupLinks,
    skillGroupLinks,
    availableGroups,
    selectedMaterialGroup,
    selectedSkillGroup,
    groupOptions,
    materialOptions,
    skillOptions,
    resetBindingDraft
  };
}
