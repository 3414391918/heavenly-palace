<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { usePromptTemplates } from "../composables/usePromptTemplates";
import { uiMessage } from "../ui-feedback";
import PromptTemplateDialog from "./PromptTemplateDialog.vue";

const emit = defineEmits<{ use: [content: string] }>();
const model = usePromptTemplates({
  api: () => window.deepwrite?.longAgents,
  use: (content) => emit("use", content),
  error: uiMessage.error,
  warning: uiMessage.warning
});
const { templates, draft, busy, loaded, existing } = model;
const refresh = () => {
  void model.load();
};
onMounted(() => {
  refresh();
  window.addEventListener("focus", refresh);
});
onBeforeUnmount(() => {
  window.removeEventListener("focus", refresh);
  model.dispose();
});
</script>

<template>
  <div class="empty-suggestions prompt-template-buttons">
    <button
      v-for="template in templates"
      :key="template.id"
      type="button"
      :disabled="busy"
      :title="template.name"
      @click="model.open(template)"
    >
      {{ template.name }}
    </button>
    <button type="button" :disabled="busy || !loaded" @click="model.open()">
      ＋ 新增模板
    </button>
    <button v-if="!busy && !loaded" type="button" @click="refresh">
      重新加载
    </button>
  </div>
  <PromptTemplateDialog
    v-if="draft"
    :draft="draft"
    :busy="busy"
    :existing="existing"
    @close="model.close"
    @save="model.save"
    @use="model.use"
    @delete="model.remove"
    @update-name="draft.name = $event"
    @update-content="draft.content = $event"
  />
</template>

<style scoped>
.prompt-template-buttons button {
  max-width: 100%;
  overflow-wrap: anywhere;
  padding-block: 6px;
}
</style>
