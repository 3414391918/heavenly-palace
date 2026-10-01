<script setup lang="ts">
import {
  LEARNING_IMITATION_STAGE_IDS,
  LEARNING_IMITATION_STAGE_LABELS,
  type LearningImitationPromptInput,
  type LearningImitationSettings,
  type LearningImitationSettingsInput,
  type LearningImitationStageId
} from "@deepwrite/contracts";
import { computed, ref, watch } from "vue";
import { uiMessage } from "../ui-feedback";

const props = defineProps<{
  stageId: LearningImitationStageId;
  settings: LearningImitationSettings | null;
  loading: boolean;
  saving: boolean;
  runtimeAvailable: boolean;
}>();

const emit = defineEmits<{
  save: [settings: LearningImitationSettingsInput];
  reset: [stageId: LearningImitationStageId];
}>();

const draftPrompts = ref<LearningImitationPromptInput[]>([]);
const placeholderNames = [
  "STAGE_ID",
  "STAGE_LABEL",
  "DOCUMENT_COUNT",
  "DOCUMENTS_SUMMARY",
  "CURRENT_RESULT"
] as const;

watch(
  () => props.settings,
  (settings) => {
    draftPrompts.value = settings
      ? settings.prompts.map(({ id, systemPrompt }) => ({ id, systemPrompt }))
      : [];
  },
  { immediate: true }
);

const activeDraft = computed(() =>
  draftPrompts.value.find((prompt) => prompt.id === props.stageId)
);
const activeSavedPrompt = computed(() =>
  props.settings?.prompts.find((prompt) => prompt.id === props.stageId)
);
const activeHasUnsavedChanges = computed(
  () =>
    activeDraft.value?.systemPrompt !== activeSavedPrompt.value?.systemPrompt
);
const hasUnsavedChanges = computed(() =>
  draftPrompts.value.some(
    (draft) =>
      draft.systemPrompt !==
      props.settings?.prompts.find((prompt) => prompt.id === draft.id)
        ?.systemPrompt
  )
);
const hasUnsavedOtherStages = computed(() =>
  draftPrompts.value.some(
    (draft) =>
      draft.id !== props.stageId &&
      draft.systemPrompt !==
        props.settings?.prompts.find((prompt) => prompt.id === draft.id)
          ?.systemPrompt
  )
);
const formDisabled = computed(
  () => props.loading || props.saving || !props.runtimeAvailable
);

function updatePrompt(event: Event): void {
  if (activeDraft.value)
    activeDraft.value.systemPrompt = (
      event.target as HTMLTextAreaElement
    ).value;
}

function savePrompts(): void {
  if (
    formDisabled.value ||
    draftPrompts.value.length !== LEARNING_IMITATION_STAGE_IDS.length
  ) {
    return;
  }
  if (draftPrompts.value.some((prompt) => !prompt.systemPrompt.trim())) {
    uiMessage.warning("三个学习阶段的系统提示词都不能为空");
    return;
  }
  emit("save", {
    prompts: LEARNING_IMITATION_STAGE_IDS.map((id) => ({
      id,
      systemPrompt: draftPrompts.value.find((prompt) => prompt.id === id)!
        .systemPrompt
    }))
  });
}

function resetPrompt(): void {
  if (hasUnsavedOtherStages.value) {
    uiMessage.warning("请先保存其他阶段的提示词修改，再恢复当前阶段默认值");
    return;
  }
  emit("reset", props.stageId);
}

function formatPlaceholder(name: string): string {
  return `{{${name}}}`;
}
</script>

<template>
  <details class="learning-prompt-editor">
    <summary>
      {{ LEARNING_IMITATION_STAGE_LABELS[stageId] }} · 智能体提示词
      <span v-if="activeHasUnsavedChanges" class="prompt-status">未保存</span>
      <span v-else-if="hasUnsavedChanges" class="prompt-status">
        其他阶段有未保存修改
      </span>
      <span v-else-if="activeSavedPrompt?.customized" class="prompt-status">
        已自定义
      </span>
    </summary>
    <div v-if="loading" class="prompt-state">正在加载提示词…</div>
    <div v-else-if="!settings || !activeDraft" class="prompt-state">
      暂无可用的提示词设置。
    </div>
    <div v-else class="prompt-content">
      <p v-if="!runtimeAvailable" class="prompt-note">
        当前环境仅支持查看；保存和恢复默认提示词需要使用桌面端。
      </p>
      <label :for="`learning-prompt-${stageId}`">系统提示词</label>
      <textarea
        :id="`learning-prompt-${stageId}`"
        :value="activeDraft.systemPrompt"
        :disabled="formDisabled"
        spellcheck="false"
        @input="updatePrompt"
      />
      <div class="prompt-help">
        <span>{{ activeDraft.systemPrompt.length }} 字符</span>
        <span>运行时自动填充：</span>
        <code v-for="name in placeholderNames" :key="name">
          {{ formatPlaceholder(name) }}
        </code>
      </div>
      <div class="prompt-actions">
        <button type="button" :disabled="formDisabled" @click="resetPrompt">
          恢复当前阶段默认
        </button>
        <button
          type="button"
          class="prompt-save"
          :disabled="formDisabled || !hasUnsavedChanges"
          @click="savePrompts"
        >
          {{ saving ? "保存中…" : "保存提示词修改" }}
        </button>
      </div>
    </div>
  </details>
</template>

<style scoped>
.learning-prompt-editor {
  margin: 0 0 14px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 12px;
  color: var(--text-primary);
  background: var(--surface-raised);
}
.learning-prompt-editor summary {
  padding: 12px 14px;
  cursor: pointer;
  font-size: 0.857143rem;
  font-weight: 650;
}
.prompt-status {
  margin-left: 10px;
  color: var(--text-secondary);
  font-size: 0.785714rem;
  font-weight: 400;
}
.prompt-content {
  display: grid;
  gap: 9px;
  padding: 0 14px 14px;
}
.prompt-content label {
  color: var(--text-secondary);
  font-size: 0.785714rem;
}
.prompt-content textarea {
  width: 100%;
  min-height: 280px;
  resize: vertical;
  padding: 12px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 9px;
  color: var(--text-primary);
  background: var(--surface-main);
  font:
    0.857143rem/1.6 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
}
.prompt-content textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.prompt-help {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
  font-size: 0.75rem;
}
.prompt-help code {
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--surface-muted);
}
.prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.prompt-actions button {
  padding: 7px 10px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 7px;
  color: var(--text-primary);
  background: var(--surface-main);
  cursor: pointer;
}
.prompt-actions button.prompt-save {
  border-color: var(--neutral-solid);
  color: var(--neutral-solid-text, #fff);
  background: var(--neutral-solid);
}
.prompt-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.prompt-state,
.prompt-note {
  padding: 0 14px 14px;
  color: var(--text-secondary);
  font-size: 0.785714rem;
}
</style>
