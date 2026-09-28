<script setup lang="ts">
import { CHAT_ASSISTANT_PROJECT_PROMPT_MAX_LENGTH } from "@deepwrite/contracts/renderer";
import PopupSelect from "../../components/PopupSelect.vue";
import type { ChatAssistantModeFeature } from "./useChatAssistantMode";
import { useChatAssistantProjectConfig } from "./useChatAssistantProjectConfig";
const props = defineProps<{ assistant: ChatAssistantModeFeature }>();
const {
  projectConfigOpen,
  projectConfigMode,
  projectConfigProjectKey,
  projectConfigPrompt,
  projectConfigCustomized,
  projectConfigPending,
  projectBookOptions,
  projectConfigOption,
  projectConfigTitle,
  updateProjectAssociation,
  saveProjectConfig,
  resetProjectConfig,
  openAddProject,
  openEditProject
} = useChatAssistantProjectConfig(props.assistant);
defineExpose({
  openAddProject,
  openEditProject,
  pending: projectConfigPending
});
</script>
<template>
  <div
    v-if="projectConfigOpen"
    class="chat-assistant-config-backdrop"
    @mousedown.self="!projectConfigPending && (projectConfigOpen = false)"
    @keydown.esc.stop.prevent="
      !projectConfigPending && (projectConfigOpen = false)
    "
  >
    <section
      class="chat-assistant-config-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="项目配置"
    >
      <header>
        <div>
          <strong>{{ projectConfigTitle }}</strong>
          <span>配置项目提示词和关联书籍</span>
        </div>
        <button
          type="button"
          aria-label="关闭项目配置"
          :disabled="projectConfigPending"
          @click="projectConfigOpen = false"
        >
          ×
        </button>
      </header>
      <label for="chat-assistant-project-book">关联书籍</label>
      <PopupSelect
        id="chat-assistant-project-book"
        :model-value="projectConfigProjectKey"
        :options="projectBookOptions"
        accessible-label="关联书籍"
        placeholder="选择短篇、剧本或长篇书籍"
        :disabled="projectConfigMode === 'edit' || projectConfigPending"
        :menu-min-width="320"
        :menu-z-index="130"
        @update:model-value="updateProjectAssociation"
      />
      <p class="chat-assistant-project-lock-hint">
        {{
          projectConfigMode === "edit"
            ? "关联书籍已锁定，不可更换；后续项目记忆将始终归属这本书。"
            : "书籍关联在项目保存后锁定，后续不可更换。"
        }}
      </p>
      <label for="chat-assistant-project-prompt">项目提示词</label>
      <textarea
        id="chat-assistant-project-prompt"
        v-model="projectConfigPrompt"
        :maxlength="CHAT_ASSISTANT_PROJECT_PROMPT_MAX_LENGTH"
        :disabled="projectConfigPending || !projectConfigOption"
        rows="10"
      />
      <div class="chat-assistant-config-meta">
        <span>{{
          projectConfigCustomized
            ? "当前使用自定义提示词"
            : "当前使用默认提示词"
        }}</span>
        <span
          >{{ projectConfigPrompt.length }} /
          {{ CHAT_ASSISTANT_PROJECT_PROMPT_MAX_LENGTH }}</span
        >
      </div>
      <p>此内容会追加到固定系统底座，不能覆盖只读、脱敏或工具边界。</p>
      <footer>
        <button
          type="button"
          class="is-secondary"
          :disabled="projectConfigPending || !projectConfigOption"
          @click="resetProjectConfig"
        >
          恢复默认
        </button>
        <span />
        <button
          type="button"
          class="is-secondary"
          :disabled="projectConfigPending"
          @click="projectConfigOpen = false"
        >
          取消
        </button>
        <button
          type="button"
          class="is-primary"
          :disabled="projectConfigPending || !projectConfigOption"
          @click="saveProjectConfig"
        >
          保存
        </button>
      </footer>
    </section>
  </div>
</template>
<style scoped src="./chat-assistant-config.css"></style>
