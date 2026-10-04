<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from "vue";
import type { PromptTemplate } from "@deepwrite/contracts";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{
  draft: PromptTemplate;
  busy: boolean;
  existing: boolean;
}>();
const emit = defineEmits<{
  close: [];
  save: [];
  use: [];
  delete: [];
  updateName: [value: string];
  updateContent: [value: string];
}>();
const titleId = useId();
const nameInput = ref<HTMLInputElement>();
const dialog = ref<HTMLElement>();
let previousFocus: HTMLElement | null = null;
function close() {
  if (!props.busy) emit("close");
}
function keydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
  if (event.key !== "Tab") return;
  const controls = Array.from(
    dialog.value?.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)"
    ) ?? []
  );
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
onMounted(() => {
  previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  nameInput.value?.focus();
});
onBeforeUnmount(() => {
  if (previousFocus?.isConnected) previousFocus.focus();
});
</script>

<template>
  <Teleport to="body">
    <div
      class="dialog-backdrop prompt-template-backdrop"
      @mousedown.self="close"
      @keydown="keydown"
    >
      <section
        ref="dialog"
        class="workspace-dialog prompt-template-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-busy="busy"
      >
        <header>
          <h2 :id="titleId">{{ existing ? "编辑模板" : "新增模板" }}</h2>
          <button
            class="template-close"
            type="button"
            aria-label="关闭模板编辑窗口"
            :disabled="busy"
            @click="close"
          >
            <AppIcon name="close" :size="18" />
          </button>
        </header>
        <div class="template-fields">
          <label
            ><span>模板名称</span
            ><input
              ref="nameInput"
              :value="draft.name"
              type="text"
              maxlength="200"
              :disabled="busy"
              @input="
                emit('updateName', ($event.target as HTMLInputElement).value)
              "
          /></label>
          <label class="template-content"
            ><span>模板内容</span
            ><textarea
              :value="draft.content"
              maxlength="100000"
              spellcheck="false"
              :disabled="busy"
              @input="
                emit(
                  'updateContent',
                  ($event.target as HTMLTextAreaElement).value
                )
              "
            />
          </label>
        </div>
        <footer>
          <button
            type="button"
            class="dialog-primary-button is-danger template-delete"
            :disabled="busy || !existing"
            @click="emit('delete')"
          >
            删除模板
          </button>
          <button
            type="button"
            class="dialog-secondary-button"
            :disabled="busy"
            @click="emit('use')"
          >
            使用模板
          </button>
          <button
            type="button"
            class="dialog-primary-button"
            :disabled="busy"
            @click="emit('save')"
          >
            {{ busy ? "正在保存…" : "保存模板" }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.prompt-template-backdrop {
  z-index: 1500;
}
.prompt-template-dialog {
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  padding: 24px;
  color: var(--text-primary);
  font-family: var(--ui-font);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
h2 {
  margin: 0;
  font-size: 1.142857rem;
}
.template-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.template-close:hover {
  background: var(--surface-hover);
}
.template-fields {
  display: grid;
  gap: 18px;
  margin: 20px 0;
  min-height: 0;
  overflow: auto;
}
label {
  display: grid;
  gap: 8px;
}
label span {
  font-size: 0.857143rem;
  color: var(--text-secondary);
}
input,
textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid var(--theme-line);
  border-radius: 9px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font: inherit;
}
textarea {
  height: clamp(160px, 40dvh, 400px);
  resize: vertical;
  line-height: 1.65;
}
input:focus,
textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
footer {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
footer button {
  min-height: 36px;
}
.template-delete {
  margin-right: auto;
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
@media (max-width: 480px) {
  .prompt-template-dialog {
    padding: 16px;
  }
  footer {
    gap: 6px;
  }
  footer button {
    flex: 1;
    padding-inline: 8px;
  }
}
</style>
