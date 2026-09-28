<script setup lang="ts">
import { computed, ref } from "vue";
import type { CatalogSnapshot } from "@deepwrite/contracts/renderer";
import MarkdownContent from "../../components/MarkdownContent.vue";
import PopupSelect from "../../components/PopupSelect.vue";
import { uiMessage } from "../../ui-feedback";
import type { RevisionAnalysisController } from "./useRevisionAnalysis";
const props = defineProps<{
  controller: RevisionAnalysisController;
  catalogSnapshot: CatalogSnapshot | null;
}>();
const emit = defineEmits<{ refreshCatalog: [] }>();
const c = props.controller;
const libraryId = ref("");
const libraries = computed(() =>
  (props.catalogSnapshot?.skills ?? []).filter((l) => !l.isBuiltin)
);
const saved = computed(() => c.savedKey.value === c.skillKey());
async function save() {
  const library = libraries.value.find((l) => l.id === libraryId.value);
  if (!library) {
    uiMessage.error("请选择目标技能库。");
    return;
  }
  try {
    if (await c.persistSkill(library)) {
      emit("refreshCatalog");
      uiMessage.success("技能已保存，可在写作时选择使用。");
    }
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "保存技能失败。");
  }
}
</script>
<template>
  <section v-if="c.result.value" class="analysis-setup-panel revision-result">
    <header>
      <h2>分析结果</h2>
      <span v-if="c.isStale.value">基于上次输入</span>
    </header>
    <template v-if="c.result.value.report">
      <h3>修改分析报告</h3>
      <MarkdownContent
        class="revision-report"
        :content="c.result.value.report"
      />
    </template>
    <h3>可复用技能草稿</h3>
    <label
      >技能标题<input
        v-model="c.result.value.title"
        maxlength="256"
        :disabled="c.saving.value || c.isBusy.value"
    /></label>
    <label
      >技能描述<textarea
        v-model="c.result.value.description"
        maxlength="4000"
        :disabled="c.saving.value || c.isBusy.value"
        placeholder="简要说明技能的用途，以及适合在什么场景下使用。"
      />
    </label>
    <label
      >技能正文<textarea
        v-model="c.result.value.body"
        class="revision-skill-body"
        maxlength="200000"
        :disabled="c.saving.value || c.isBusy.value"
      />
    </label>
    <div class="revision-save-controls">
      <label
        >目标技能库<PopupSelect
          v-model="libraryId"
          :options="libraries.map((l) => ({ value: l.id, label: l.title }))"
          :disabled="c.saving.value"
          accessible-label="修改分析目标技能库"
          :placeholder="
            libraries.length ? '请选择技能库' : '请先在技能库中新建资料库'
          "
      /></label>
      <button
        class="analysis-primary-button"
        :disabled="
          c.saving.value ||
          c.isBusy.value ||
          !libraryId ||
          saved ||
          !c.result.value.title.trim() ||
          !c.result.value.description?.trim() ||
          !c.result.value.body.trim()
        "
        @click="save"
      >
        {{
          c.saving.value ? "保存中…" : saved ? "已保存此版技能" : "保存到技能库"
        }}
      </button>
    </div>
  </section>
</template>
