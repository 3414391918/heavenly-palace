<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type {
  CatalogSnapshot,
  LongBookAnalysisPreset,
  LongBookAnalysisResult
} from "@deepwrite/contracts/renderer";
import PopupSelect, {
  type PopupSelectOption
} from "../../components/PopupSelect.vue";
import {
  analysisLibraryOption,
  analysisOutputTypeLabel,
  compatibleAnalysisLibraries
} from "./task-options";

const props = defineProps<{
  result: LongBookAnalysisResult;
  preset: LongBookAnalysisPreset;
  catalogSnapshot: CatalogSnapshot | null;
  targetLibraryId: string;
  saving: boolean;
}>();
const emit = defineEmits<{
  update: [result: LongBookAnalysisResult];
  save: [
    input: {
      libraryId: string;
      baseProjectRevision?: number;
    }
  ];
}>();

const targetId = ref("");
const compatibleLibraries = computed(() =>
  compatibleAnalysisLibraries(props.preset, props.catalogSnapshot)
);
const targetOptions = computed<PopupSelectOption[]>(() =>
  compatibleLibraries.value.map(analysisLibraryOption)
);
const targetLibrary = computed(() => {
  return compatibleLibraries.value.find(
    (library) => library.id === targetId.value
  );
});
const outputTypeLabel = computed(() => analysisOutputTypeLabel(props.preset));

watch(
  [() => props.targetLibraryId, compatibleLibraries],
  ([preferredId, libraries]) => {
    if (libraries.some((library) => library.id === targetId.value)) return;
    const presetDefaultId = props.preset.output.libraryId ?? "";
    targetId.value =
      [preferredId, presetDefaultId].find((id) =>
        libraries.some((library) => library.id === id)
      ) ??
      libraries[0]?.id ??
      "";
  },
  { immediate: true }
);

function updateName(event: Event): void {
  const element = event.target;
  if (element instanceof HTMLInputElement)
    emit("update", { ...props.result, name: element.value });
}

function updateDescription(event: Event): void {
  const element = event.target;
  if (element instanceof HTMLTextAreaElement)
    emit("update", { ...props.result, description: element.value });
}

function updateContent(event: Event): void {
  const element = event.target;
  if (element instanceof HTMLTextAreaElement)
    emit("update", { ...props.result, content: element.value });
}

function save(): void {
  if (!targetLibrary.value) return;
  emit("save", {
    libraryId: targetLibrary.value.id,
    ...(targetLibrary.value.projectRevision === undefined
      ? {}
      : { baseProjectRevision: targetLibrary.value.projectRevision })
  });
}
</script>

<template>
  <section class="analysis-card result-card">
    <header class="analysis-card-heading">
      <div>
        <p class="analysis-eyebrow">分析与结果</p>
        <h2>“{{ preset.name }}”生成结果</h2>
      </div>
      <span
        >{{ preset.output.domain === "material" ? "素材" : "技能" }} ·
        {{ outputTypeLabel }}</span
      >
    </header>
    <input
      class="result-title"
      :value="result.name"
      maxlength="256"
      aria-label="结果名称"
      @input="updateName"
    />
    <textarea
      class="result-description"
      :value="result.description"
      maxlength="1000"
      rows="3"
      aria-label="结果描述"
      placeholder="简要说明用途、适用场景和何时使用"
      @input="updateDescription"
    />
    <textarea
      class="result-body"
      :value="result.content"
      maxlength="200000"
      aria-label="Markdown 结果正文"
      @input="updateContent"
    />
    <div class="result-save-row">
      <div class="result-target-library">
        <label>
          <span
            >写入到{{
              preset.output.domain === "material" ? "素材库" : "技能库"
            }}</span
          >
          <PopupSelect
            v-model="targetId"
            :options="targetOptions"
            accessible-label="结果写入目标资料库"
            :placeholder="
              targetOptions.length ? '选择具体资料库' : '没有兼容的资料库'
            "
            :disabled="saving || targetOptions.length === 0"
            :menu-min-width="280"
          />
        </label>
        <small>{{ outputTypeLabel }} · 生成后可随时更换目标库</small>
      </div>
      <button
        class="analysis-primary-button"
        type="button"
        :disabled="saving || !targetLibrary"
        @click="save"
      >
        {{
          saving
            ? "写入中…"
            : `写入${preset.output.domain === "material" ? "素材库" : "技能库"}`
        }}
      </button>
    </div>
    <p class="analysis-help">
      保存时会自动在正文顶部添加 name 和 description
      说明头部。结果会一直保留在当前预览中；每次写入只创建新条目，不会覆盖已有内容。
    </p>
  </section>
</template>

<style scoped>
.result-card {
  display: grid;
  gap: 12px;
}
.result-title,
.result-description,
.result-body,
.result-target-library {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid var(--theme-line-soft);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--surface-main);
  color: var(--text-primary);
  font: inherit;
}
.result-title {
  font-size: 16px;
  font-weight: 650;
}
.result-description {
  resize: vertical;
  line-height: 1.7;
}
.result-body {
  min-height: 420px;
  resize: vertical;
  line-height: 1.7;
}
.result-save-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.result-save-row > .analysis-primary-button {
  flex: 0 0 auto;
  min-width: 110px;
  white-space: nowrap;
}
.result-target-library {
  display: grid;
  min-width: 0;
  gap: 6px;
}
.result-target-library label {
  display: grid;
  grid-template-columns: auto minmax(220px, 1fr);
  align-items: center;
  gap: 8px;
}
.result-target-library label > span,
.result-target-library small {
  color: var(--text-tertiary);
  font-size: 12px;
}
.analysis-help {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 12px;
}
@media (max-width: 800px) {
  .result-save-row {
    align-items: stretch;
    flex-direction: column;
  }
  .result-target-library label {
    grid-template-columns: 1fr;
  }
}
</style>
