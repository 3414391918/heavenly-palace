<script setup lang="ts">
import { computed, ref } from "vue";
import type { BookTemplate, SaveBookTemplateInput } from "@deepwrite/contracts";
import BookTemplateEditor from "./BookTemplateEditor.vue";
import { useBookTemplates } from "../composables/useBookTemplates";
const props = defineProps<{
  workspaceType: "short" | "script";
  defaultStageIds: readonly string[];
  disabled: boolean;
}>();
const { templates, catalog, loading, saving, failed, load, save, remove } =
  useBookTemplates();
const items = computed(() =>
  templates.value.filter(
    (item) => item.configuration.workspaceType === props.workspaceType
  )
);
const editing = ref<BookTemplate | null | undefined>(undefined);
const deleting = ref<BookTemplate | null>(null);
async function saveTemplate(input: SaveBookTemplateInput) {
  if (await save(input)) editing.value = undefined;
}
async function deleteTemplate() {
  if (deleting.value && (await remove(deleting.value.id)))
    deleting.value = null;
}
</script>
<template>
  <section class="book-template-settings" aria-label="新建模板配置">
    <div class="template-settings-heading">
      <h3>新建模板</h3>
      <button
        class="dialog-primary-button"
        :disabled="disabled || loading || saving || !catalog"
        @click="editing = null"
      >
        新建模板配置
      </button>
    </div>
    <p>保存题材、人物样式、剧情阶段和关联资料库，供「按模板新建」使用。</p>
    <p v-if="loading">正在加载模板…</p>
    <button v-else-if="failed" class="dialog-secondary-button" @click="load">
      重新加载
    </button>
    <p v-else-if="!items.length">尚未配置模板。</p>
    <ul v-else class="book-template-list">
      <li v-for="item in items" :key="item.id">
        <div>
          <strong>{{ item.configuration.name }}</strong
          ><small
            >{{ item.configuration.genre }} ·
            {{
              item.configuration.characterFormat === "text"
                ? "文本样式"
                : "条目样式"
            }}</small
          >
        </div>
        <button
          class="dialog-secondary-button"
          :disabled="disabled || saving"
          @click="editing = item"
        >
          编辑</button
        ><button
          class="dialog-secondary-button"
          :disabled="disabled || saving"
          @click="deleting = item"
        >
          删除
        </button>
      </li>
    </ul>
    <BookTemplateEditor
      v-if="editing !== undefined && catalog"
      :workspace-type="workspaceType"
      :template="editing ?? undefined"
      :catalog="catalog"
      :default-stage-ids="defaultStageIds"
      :saving="saving"
      @close="editing = undefined"
      @save="saveTemplate"
    />
    <Teleport to="body"
      ><div
        v-if="deleting"
        class="dialog-backdrop"
        @keydown.esc.stop="!saving && (deleting = null)"
      >
        <section
          class="workspace-dialog book-template-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-template-title"
        >
          <header><h2 id="delete-template-title">删除模板</h2></header>
          <div class="dialog-content book-template-form">
            <p>
              确认删除模板「{{
                deleting.configuration.name
              }}」？已创建作品不受影响。
            </p>
            <div class="dialog-actions">
              <button
                class="dialog-secondary-button"
                :disabled="saving"
                @click="deleting = null"
              >
                取消</button
              ><button
                class="template-danger-button"
                :disabled="saving"
                @click="deleteTemplate"
              >
                {{ saving ? "删除中…" : "删除模板" }}
              </button>
            </div>
          </div>
        </section>
      </div></Teleport
    >
  </section>
</template>
<style src="./book-template.css"></style>
