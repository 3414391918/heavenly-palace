<script setup lang="ts">
import { computed, ref } from "vue";
import type { CreateCreativeBookPayload } from "./WorkspaceDialogLayer.types";
import PopupSelect from "./PopupSelect.vue";
import { useBookTemplates } from "../composables/useBookTemplates";
import { bookTemplateReferenceError } from "../utils/bookTemplateReferences";
import { uiMessage } from "../ui-feedback";
const props = defineProps<{ submitting: boolean }>();
const emit = defineEmits<{
  close: [];
  submit: [input: CreateCreativeBookPayload];
  settings: [];
}>();
const { templates, catalog, loading, failed, load } = useBookTemplates();
const templateId = ref("");
const title = ref("");
const selected = computed(() =>
  templates.value.find((item) => item.id === templateId.value)
);
const configuration = computed(() => selected.value?.configuration);
const options = computed(() =>
  templates.value.map((item) => ({
    value: item.id,
    label: `${item.configuration.name} · ${item.configuration.workspaceType === "short" ? "短篇" : "剧本"}`
  }))
);
const stageSummary = computed(() =>
  configuration.value?.defaultPlotStageIds
    .map(
      (id) =>
        catalog.value?.creativePlotStages.find((stage) => stage.id === id)
          ?.title ?? "已失效阶段"
    )
    .join("、")
);
const librarySummary = computed(() => {
  if (!configuration.value) return { materials: "不关联", skills: "不关联" };
  const materials = [
    ...new Set(
      Object.values(configuration.value.linkedMaterialIdsByKind).flat()
    )
  ].map(
    (id) =>
      catalog.value?.materials.find((item) => item.id === id)?.title ??
      "已失效素材库"
  );
  const skills = [
    ...new Set(Object.values(configuration.value.linkedSkillIdsByKind).flat())
  ].map(
    (id) =>
      catalog.value?.skills.find((item) => item.id === id)?.title ??
      "已失效技能库"
  );
  return {
    materials: materials.join("、") || "不关联",
    skills: skills.join("、") || "不关联"
  };
});
function submit() {
  if (props.submitting || loading.value) return;
  if (!selected.value || !catalog.value) {
    uiMessage.warning("请选择模板");
    return;
  }
  if (!title.value.trim()) {
    uiMessage.warning("请输入作品名");
    return;
  }
  const error = bookTemplateReferenceError(
    selected.value.configuration,
    catalog.value
  );
  if (error) {
    uiMessage.warning(error);
    return;
  }
  emit("submit", {
    workspaceType: selected.value.configuration.workspaceType,
    genre: selected.value.configuration.genre,
    templateId: selected.value.id,
    title: title.value.trim()
  });
}
</script>
<template>
  <Teleport to="body"
    ><div
      class="dialog-backdrop"
      @mousedown.self="!submitting && emit('close')"
      @keydown.esc.stop="!submitting && emit('close')"
    >
      <section
        class="workspace-dialog book-template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-template-title"
      >
        <header>
          <h2 id="create-template-title">按模板新建</h2>
          <button
            class="dialog-close"
            :disabled="submitting"
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
          <p v-if="loading">正在加载模板…</p>
          <button
            v-else-if="failed"
            class="dialog-secondary-button"
            type="button"
            @click="load"
          >
            重新加载
          </button>
          <p v-else-if="!templates.length">
            尚未配置模板，请先在创作空间配置中创建短篇或剧本模板。
          </p>
          <template v-else>
            <label
              >选择模板<PopupSelect
                v-model="templateId"
                :options="options"
                accessible-label="选择新建模板"
                :disabled="submitting"
            /></label>
            <dl v-if="configuration" class="template-summary">
              <dt>作品类型</dt>
              <dd>
                {{ configuration.workspaceType === "short" ? "短篇" : "剧本" }}
              </dd>
              <dt>题材</dt>
              <dd>{{ configuration.genre }}</dd>
              <dt>人物样式</dt>
              <dd>
                {{
                  configuration.characterFormat === "text"
                    ? "文本样式"
                    : "条目样式"
                }}
              </dd>
              <dt>剧情阶段</dt>
              <dd>{{ stageSummary }}</dd>
              <dt>技能库</dt>
              <dd>{{ librarySummary.skills }}</dd>
              <dt>素材库</dt>
              <dd>{{ librarySummary.materials }}</dd>
            </dl>
            <label
              >作品名<input
                v-model="title"
                maxlength="80"
                :disabled="submitting"
                placeholder="请输入作品名"
            /></label>
          </template>
          <div class="dialog-actions">
            <button
              type="button"
              class="dialog-secondary-button"
              :disabled="submitting"
              @click="emit('settings')"
            >
              前往模板配置</button
            ><button
              type="button"
              class="dialog-secondary-button"
              :disabled="submitting"
              @click="emit('close')"
            >
              取消</button
            ><button
              type="submit"
              class="dialog-primary-button"
              :disabled="submitting || loading || failed || !selected"
            >
              {{ submitting ? "创建中…" : "创建作品" }}
            </button>
          </div>
        </form>
      </section>
    </div></Teleport
  >
</template>
<style src="./book-template.css"></style>
