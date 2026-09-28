<script setup lang="ts">
import type {
  CatalogSnapshot,
  LongBookAnalysisPreset,
  MaterialKind,
  MaterialStageId,
  SkillKind
} from "@deepwrite/contracts/renderer";
import PopupSelect, {
  type PopupSelectOption
} from "../../components/PopupSelect.vue";
import {
  MATERIAL_KIND_LABELS,
  MATERIAL_STAGE_KINDS,
  SKILL_KIND_LABELS
} from "../../data/catalogWorkspace";

const props = defineProps<{
  short?: boolean;
  preset: LongBookAnalysisPreset & { selectionMode?: "single" | "multiple" };
  catalogSnapshot: CatalogSnapshot | null;
}>();

const materialKinds: PopupSelectOption[] = (
  ["character", "gimmick", "plot", "draft", "other"] as const
).map((value) => ({ value, label: MATERIAL_KIND_LABELS[value] }));
const skillKinds: PopupSelectOption[] = (
  ["general", "plot", "style", "other"] as const
).map((value) => ({ value, label: SKILL_KIND_LABELS[value] }));
const materialStageIds: readonly MaterialStageId[] = [
  "gimmick",
  "character",
  "pacing",
  "intro",
  "plot_refine",
  "draft_excerpt",
  "other"
] as const;
const domainOptions: PopupSelectOption[] = [
  { value: "material", label: "素材库" },
  { value: "skill", label: "技能库" }
];

const selectionOptions = [
  { value: "single", label: "单本（1 本）" },
  { value: "multiple", label: "多本（1—10 本）" }
];

function setDomain(
  preset: LongBookAnalysisPreset,
  value: string | number
): void {
  preset.output =
    value === "skill"
      ? { domain: "skill", kind: "general", stageId: "draft" }
      : { domain: "material", kind: "other", stageId: "other" };
}

function targetLibraryOptions(
  preset: LongBookAnalysisPreset
): PopupSelectOption[] {
  const unset = { value: "", label: "每次任务时选择" };
  if (preset.output.domain === "material") {
    return [
      unset,
      ...(props.catalogSnapshot?.materials ?? [])
        .filter(
          (library) =>
            library.materialKind === preset.output.kind ||
            library.materialKind === "mixed"
        )
        .map((library) => ({
          value: library.id,
          label: library.title,
          description: MATERIAL_KIND_LABELS[library.materialKind]
        }))
    ];
  }
  return [
    unset,
    ...(props.catalogSnapshot?.skills ?? [])
      .filter(
        (library) =>
          library.skillKind === preset.output.kind && !library.isBuiltin
      )
      .map((library) => ({
        value: library.id,
        label: library.title,
        description: SKILL_KIND_LABELS[library.skillKind]
      }))
  ];
}

function setTargetLibrary(
  preset: LongBookAnalysisPreset,
  value: string | number
): void {
  const libraryId = String(value).trim();
  if (preset.output.domain === "material") {
    const output = {
      domain: preset.output.domain,
      kind: preset.output.kind,
      stageId: preset.output.stageId
    } as const;
    preset.output = libraryId ? { ...output, libraryId } : output;
    return;
  }
  const output = {
    domain: preset.output.domain,
    kind: preset.output.kind,
    stageId: preset.output.stageId
  } as const;
  preset.output = libraryId ? { ...output, libraryId } : output;
}

function setKind(preset: LongBookAnalysisPreset, value: string | number): void {
  if (preset.output.domain === "material") {
    const kind = value as MaterialKind;
    const stageId =
      MATERIAL_STAGE_KINDS[preset.output.stageId] === kind
        ? preset.output.stageId
        : materialStageIds.find(
            (stageId) => MATERIAL_STAGE_KINDS[stageId] === kind
          );
    preset.output = {
      domain: "material",
      kind,
      stageId: stageId ?? "other"
    };
    return;
  }
  preset.output = {
    domain: "skill",
    kind: value as SkillKind,
    stageId: preset.output.stageId
  };
}
</script>

<template>
  <div class="preset-editor">
    <label class="preset-output-field">
      <span>预设名称</span>
      <input v-model="preset.name" maxlength="80" aria-label="预设名称" />
    </label>
    <label class="preset-output-field">
      <span>预设说明</span>
      <input
        v-model="preset.description"
        maxlength="500"
        aria-label="预设说明"
      />
    </label>
    <label v-if="short" class="preset-output-field"
      ><span>可选择书本数量</span
      ><PopupSelect
        :model-value="preset.selectionMode ?? 'single'"
        @update:model-value="
          preset.selectionMode = $event === 'multiple' ? 'multiple' : 'single'
        "
        :options="selectionOptions"
        accessible-label="可选择书本数量"
        :menu-z-index="3200"
    /></label>
    <div class="preset-output-row">
      <label class="preset-output-field">
        <span>输出领域</span>
        <PopupSelect
          :model-value="preset.output.domain"
          :options="domainOptions"
          accessible-label="结果领域"
          :menu-z-index="3200"
          @update:model-value="setDomain(preset, $event)"
        />
      </label>
      <label class="preset-output-field">
        <span>资料库分类</span>
        <PopupSelect
          :model-value="preset.output.kind"
          :options="
            preset.output.domain === 'material' ? materialKinds : skillKinds
          "
          accessible-label="资料库分类"
          :menu-z-index="3200"
          @update:model-value="setKind(preset, $event)"
        />
      </label>
      <label class="preset-output-field">
        <span>默认目标资料库</span>
        <PopupSelect
          :model-value="preset.output.libraryId ?? ''"
          :options="targetLibraryOptions(preset)"
          accessible-label="默认目标资料库"
          :menu-min-width="260"
          :menu-z-index="3200"
          @update:model-value="setTargetLibrary(preset, $event)"
        />
      </label>
    </div>
    <label class="preset-output-field">
      <span>系统提示词</span>
      <textarea
        v-model="preset.systemPrompt"
        maxlength="200000"
        aria-label="预设系统提示词"
      />
    </label>
  </div>
</template>

<style scoped>
.preset-editor {
  display: grid;
  gap: 14px;
  padding-top: 16px;
  border-top: 1px solid var(--theme-line-soft);
}
.preset-editor input,
.preset-editor textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--surface-muted);
  color: var(--text-primary);
  font: inherit;
}
.preset-editor input:focus-visible,
.preset-editor textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.preset-editor textarea {
  min-height: 200px;
  resize: vertical;
  line-height: 1.6;
}
.preset-output-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.preset-output-field {
  display: grid;
  min-width: 0;
  gap: 6px;
}
.preset-output-field > span {
  color: var(--text-secondary);
  font-size: 0.85rem;
}
@media (max-width: 720px) {
  .preset-output-row {
    grid-template-columns: 1fr;
  }
}
</style>
