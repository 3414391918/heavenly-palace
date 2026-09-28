<script setup lang="ts">
import { nextTick, ref, useId, watch } from "vue";
import type {
  CatalogSnapshot,
  LongBookAnalysisPreset
} from "@deepwrite/contracts/renderer";
import { createId } from "@deepwrite/shared";
import PresetEditor from "./PresetEditor.vue";
import { uiMessage } from "../../ui-feedback";
import {
  MATERIAL_KIND_LABELS,
  SKILL_KIND_LABELS
} from "../../data/catalogWorkspace";
import { cloneLongBookAnalysisPreset } from "./preset-draft";

const props = defineProps<{
  short?: boolean;
  open: boolean;
  presets: readonly LongBookAnalysisPreset[];
  saving: boolean;
  catalogSnapshot: CatalogSnapshot | null;
}>();
const emit = defineEmits<{
  close: [];
  save: [presets: LongBookAnalysisPreset[]];
  reset: [presetId?: string];
}>();

type PresetDraft = LongBookAnalysisPreset & {
  selectionMode?: "single" | "multiple";
};
const draft = ref<PresetDraft[]>([]);
const expandedId = ref<string | null>(null);
const editorId = useId();
const draggedIndex = ref<number | null>(null);

watch(
  () => [props.open, props.presets] as const,
  ([open]) => {
    if (open) draft.value = props.presets.map(cloneLongBookAnalysisPreset);
    expandedId.value = null;
    draggedIndex.value = null;
  },
  { immediate: true }
);

function addPreset(): void {
  if (draft.value.length >= 50) {
    uiMessage.warning("预设最多 50 项。");
    return;
  }
  const id = createId("analysis_preset");
  draft.value.push({
    ...(props.short ? { selectionMode: "single" as const } : {}),
    id,
    name: `新预设 ${draft.value.length + 1}`,
    description: props.short
      ? "说明这个预设要从短篇中提炼什么。"
      : "说明这个预设要从长篇中提炼什么。",
    systemPrompt: props.short
      ? "你是短篇拆书分析师。基于完整短篇提炼可复用方法，多本输入时联合比较并标明书名证据。"
      : "你是长篇拆书分析智能体。请基于章节证据提炼可复用的方法与结构，避免大段复制原文。",
    output: { domain: "material", kind: "other", stageId: "other" }
  });
  void editPreset(id);
}

function copyPreset(index: number): void {
  const current = draft.value[index];
  if (!current || draft.value.length >= 50) return;
  const id = createId("analysis_preset");
  draft.value.splice(index + 1, 0, {
    ...cloneLongBookAnalysisPreset(current),
    id,
    name: `${current.name} 副本`,
    builtin: false
  });
  void editPreset(id);
}

function removePreset(index: number): void {
  const current = draft.value[index];
  if (!current) return;
  if (!window.confirm(`确认删除预设“${current.name}”吗？`)) return;
  draft.value.splice(index, 1);
  if (expandedId.value === current.id) expandedId.value = null;
}

function dropAt(targetIndex: number): void {
  const sourceIndex = draggedIndex.value;
  draggedIndex.value = null;
  if (sourceIndex === null || sourceIndex === targetIndex) return;
  const [preset] = draft.value.splice(sourceIndex, 1);
  if (preset) draft.value.splice(targetIndex, 0, preset);
}

async function editPreset(id: string): Promise<void> {
  expandedId.value = id;
  await nextTick();
  const editor = document.getElementById(`${editorId}-${id}`);
  editor?.scrollIntoView({ block: "nearest" });
  editor?.querySelector("input")?.focus({ preventScroll: true });
}

function targetLibraryLabel(preset: PresetDraft): string {
  if (!preset.output.libraryId) return "每次任务时选择";
  const libraries =
    preset.output.domain === "material"
      ? props.catalogSnapshot?.materials
      : props.catalogSnapshot?.skills;
  return (
    libraries?.find((library) => library.id === preset.output.libraryId)
      ?.title ?? "资料库不可用，请重新选择"
  );
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="analysis-modal-backdrop"
      @click.self="emit('close')"
    >
      <section
        class="analysis-preset-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="short ? '短篇拆书预设管理' : '长篇拆书预设管理'"
      >
        <header>
          <div>
            <p>{{ short ? "短篇拆书" : "长篇拆书" }} · 预设配置</p>
            <h2>拆书预设管理</h2>
          </div>
          <button type="button" aria-label="关闭" @click="emit('close')">
            ×
          </button>
        </header>
        <div class="preset-toolbar">
          <button
            type="button"
            :disabled="draft.length >= 50"
            @click="addPreset"
          >
            新增预设
          </button>
          <button type="button" @click="emit('reset')">恢复全部默认</button>
          <small>点击卡片展开编辑，拖动手柄调整顺序</small>
          <span>{{ draft.length }} / 50</span>
        </div>
        <div class="preset-list">
          <article
            v-for="(preset, index) in draft"
            :key="preset.id"
            :class="{ 'is-expanded': expandedId === preset.id }"
            @dragover.prevent
            @drop.prevent="dropAt(index)"
          >
            <div class="preset-card-heading">
              <span
                class="drag-handle"
                draggable="true"
                title="拖动调整预设顺序"
                @dragstart="draggedIndex = index"
                @dragend="draggedIndex = null"
                >⋮⋮</span
              >
              <button
                class="preset-summary"
                type="button"
                :aria-expanded="expandedId === preset.id"
                :aria-controls="`${editorId}-${preset.id}`"
                @click="
                  expandedId = expandedId === preset.id ? null : preset.id
                "
              >
                <span class="preset-title-row">
                  <strong>{{ preset.name || "未命名预设" }}</strong>
                  <span class="preset-badge">{{
                    preset.builtin ? "默认预设" : "自定义"
                  }}</span>
                </span>
                <span class="preset-description">{{
                  preset.description || "暂无说明"
                }}</span>
                <span class="preset-meta">
                  <span v-if="short">{{
                    preset.selectionMode === "multiple"
                      ? "多本 · 1—10 本"
                      : "单本 · 1 本"
                  }}</span>
                  <span
                    >{{
                      preset.output.domain === "material" ? "素材库" : "技能库"
                    }}
                    ·
                    {{
                      preset.output.domain === "material"
                        ? MATERIAL_KIND_LABELS[preset.output.kind]
                        : SKILL_KIND_LABELS[preset.output.kind]
                    }}</span
                  >
                </span>
                <span class="preset-target"
                  >默认目标：{{ targetLibraryLabel(preset) }}</span
                >
                <span class="preset-toggle">{{
                  expandedId === preset.id ? "收起编辑 ▴" : "展开编辑 ▾"
                }}</span>
              </button>
              <div class="preset-card-actions">
                <button
                  type="button"
                  :disabled="draft.length >= 50"
                  @click="copyPreset(index)"
                >
                  复制
                </button>
                <button
                  v-if="preset.builtin"
                  type="button"
                  @click="emit('reset', preset.id)"
                >
                  恢复默认
                </button>
                <button
                  v-if="!preset.builtin"
                  class="delete-button"
                  type="button"
                  @click="removePreset(index)"
                >
                  删除
                </button>
              </div>
            </div>
            <PresetEditor
              v-if="expandedId === preset.id"
              :id="`${editorId}-${preset.id}`"
              :preset="preset"
              :short="short"
              :catalog-snapshot="catalogSnapshot"
            />
          </article>
        </div>
        <footer>
          <button type="button" @click="emit('close')">取消</button>
          <button
            class="analysis-primary-button"
            type="button"
            :disabled="saving"
            @click="emit('save', draft)"
          >
            {{ saving ? "保存中…" : "保存预设" }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped src="./preset-manager.css"></style>
