<script setup lang="ts">
import { computed, reactive, ref, toRaw } from "vue";
import {
  loadBookTemplateDraftSchema,
  DEFAULT_NEW_BOOK_ENABLED_PLOT_STAGE_IDS,
  SHORT_BOOK_GENRES,
  SCRIPT_BOOK_GENRES
} from "@deepwrite/contracts/renderer";
import type {
  BookTemplate,
  BookTemplateDraft,
  CatalogIndexSnapshot,
  SaveBookTemplateInput
} from "@deepwrite/contracts";
import PopupSelect from "./PopupSelect.vue";
import BookLibraryBindings from "./BookLibraryBindings.vue";
import { bookTemplateReferenceError } from "../utils/bookTemplateReferences";
import { uiMessage } from "../ui-feedback";
const props = defineProps<{
  workspaceType: "short" | "script";
  template?: BookTemplate | undefined;
  catalog: CatalogIndexSnapshot;
  defaultStageIds: readonly string[];
  saving: boolean;
}>();
const emit = defineEmits<{ close: []; save: [input: SaveBookTemplateInput] }>();
const initial = props.template?.configuration;
const enabled = new Set(
  props.workspaceType === "short"
    ? props.defaultStageIds
    : DEFAULT_NEW_BOOK_ENABLED_PLOT_STAGE_IDS
);
const stages = props.catalog.creativePlotStages
  .filter((stage) => enabled.has(stage.id))
  .map((stage) => stage.id);
const draft = reactive<BookTemplateDraft>(
  initial
    ? structuredClone(toRaw(initial))
    : {
        name: "",
        workspaceType: props.workspaceType,
        genre: "世情",
        characterFormat: "text",
        defaultPlotStageIds: stages.length
          ? stages
          : props.catalog.creativePlotStages
              .slice(0, 1)
              .map((stage) => stage.id),
        linkedMaterialIdsByKind: {
          character: [],
          gimmick: [],
          plot: [],
          draft: [],
          other: []
        },
        linkedSkillIdsByKind: { general: [], plot: [], style: [], other: [] }
      }
);
const genres = computed(() =>
  (props.workspaceType === "short"
    ? SHORT_BOOK_GENRES
    : SCRIPT_BOOK_GENRES
  ).map((value) => ({ value, label: value }))
);
const invalidStages = computed(() =>
  draft.defaultPlotStageIds.filter(
    (id) => !props.catalog.creativePlotStages.some((stage) => stage.id === id)
  )
);
function toggleStage(id: string, checked: boolean) {
  const ids = new Set(draft.defaultPlotStageIds);
  if (checked) ids.add(id);
  else ids.delete(id);
  draft.defaultPlotStageIds = [
    ...props.catalog.creativePlotStages.map((stage) => stage.id),
    ...invalidStages.value
  ].filter((value) => ids.has(value));
}
const validating = ref(false);
const busy = computed(() => validating.value || props.saving);
async function submit() {
  if (validating.value || props.saving) return;
  validating.value = true;
  try {
    const schema = await loadBookTemplateDraftSchema();
    const result = schema.safeParse(draft);
    if (!result.success) {
      uiMessage.warning(
        !draft.name.trim()
          ? "请输入模板名称"
          : "请至少选择一个剧情阶段，并检查模板配置。"
      );
      return;
    }
    const error = bookTemplateReferenceError(result.data, props.catalog);
    if (error) {
      uiMessage.warning(error);
      return;
    }
    emit("save", {
      ...(props.template ? { id: props.template.id } : {}),
      configuration: result.data
    });
  } catch (error) {
    uiMessage.error(
      error instanceof Error ? error.message : "加载模板校验失败，请重试。"
    );
  } finally {
    validating.value = false;
  }
}
</script>
<template>
  <Teleport to="body">
    <div
      class="dialog-backdrop"
      @mousedown.self="!busy && emit('close')"
      @keydown.esc.stop="!busy && emit('close')"
    >
      <section
        class="workspace-dialog book-template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-editor-title"
      >
        <header>
          <h2 id="template-editor-title">
            {{ template ? "编辑模板" : "新建模板配置" }} ·
            {{ workspaceType === "short" ? "短篇" : "剧本" }}
          </h2>
          <button
            class="dialog-close"
            :disabled="busy"
            aria-label="关闭"
            @click="emit('close')"
          >
            ×
          </button>
        </header>
        <form
          class="dialog-content book-template-form"
          @submit.prevent="submit"
        >
          <label
            >模板名称<input
              v-model="draft.name"
              maxlength="80"
              :disabled="busy"
              autofocus
          /></label>
          <label
            >题材<PopupSelect
              :model-value="draft.genre"
              :options="genres"
              accessible-label="模板题材"
              :disabled="busy"
              @update:model-value="
                draft.genre = $event as BookTemplateDraft['genre']
              "
          /></label>
          <label
            >人物默认样式<PopupSelect
              v-model="draft.characterFormat"
              :options="[
                { value: 'text', label: '文本样式' },
                { value: 'list', label: '条目样式' }
              ]"
              accessible-label="人物默认样式"
              :disabled="busy"
          /></label>
          <fieldset>
            <legend>默认启用的剧情阶段</legend>
            <label
              v-for="stage in catalog.creativePlotStages"
              :key="stage.id"
              class="template-stage"
              ><input
                type="checkbox"
                :checked="draft.defaultPlotStageIds.includes(stage.id)"
                :disabled="busy"
                @change="
                  toggleStage(
                    stage.id,
                    ($event.target as HTMLInputElement).checked
                  )
                "
              />{{ stage.title }}</label
            >
            <label v-for="id in invalidStages" :key="id" class="template-stage"
              ><input
                type="checkbox"
                checked
                :disabled="busy"
                @change="toggleStage(id, false)"
              />已失效阶段：{{ id }}（取消选择后保存）</label
            >
          </fieldset>
          <BookLibraryBindings
            :workspace-type="workspaceType"
            :materials="catalog.materials"
            :skills="catalog.skills"
            :material-groups="catalog.materialGroups"
            :skill-groups="catalog.skillGroups"
            :initial-materials="initial?.linkedMaterialIdsByKind"
            :initial-skills="initial?.linkedSkillIdsByKind"
            preserve-missing
            :submitting="busy"
            @change="Object.assign(draft, $event)"
          />
          <div class="dialog-actions">
            <button
              type="button"
              class="dialog-secondary-button"
              :disabled="busy"
              @click="emit('close')"
            >
              取消</button
            ><button
              class="dialog-primary-button"
              type="submit"
              :disabled="busy"
            >
              {{ busy ? "保存中…" : "保存模板" }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
<style src="./book-template.css"></style>
