<script setup lang="ts">
import { ref, watch } from "vue";
import {
  REVISION_REASON_LIMIT,
  type RevisionChange
} from "@deepwrite/contracts/renderer";
const props = defineProps<{
  changes: RevisionChange[];
  disabled: boolean;
  current: boolean;
}>();
const emit = defineEmits<{ reason: [id: string, text: string] }>();
const visible = ref(20);
const expanded = ref(true);
watch(
  () => props.changes,
  () => {
    visible.value = 20;
    expanded.value = true;
  }
);
function update(id: string, event: Event) {
  emit("reason", id, (event.target as HTMLTextAreaElement).value);
}
</script>
<template>
  <section class="analysis-setup-panel revision-differences">
    <header class="revision-differences-header">
      <div class="revision-heading">
        <h2>
          修改段落 <small class="revision-count">{{ changes.length }} 组</small>
        </h2>
        <button
          v-if="changes.length"
          class="revision-text-button"
          type="button"
          :aria-expanded="expanded"
          :aria-label="expanded ? '收起差异段落' : '展开差异段落'"
          @click="expanded = !expanded"
        >
          <span>{{ expanded ? "收起差异" : "展开差异" }}</span>
          <svg
            class="revision-toggle-icon"
            :class="{ 'is-expanded': expanded }"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
      </div>
      <span class="revision-comparison-status">{{
        current ? "已比较当前正文" : "请比较当前正文后再分析"
      }}</span>
    </header>
    <p v-if="!changes.length">比较差异后，在这里查看修改段落并填写可选理由。</p>
    <article
      v-for="(change, index) in changes.slice(0, visible)"
      v-show="expanded"
      :key="change.id"
      class="revision-change"
    >
      <header>
        <strong>差异 {{ index + 1 }}</strong
        ><small v-if="change.coarse"
          >变化较多，按较大范围合并展示；内容完整保留</small
        >
      </header>
      <div class="revision-change-grid">
        <section>
          <h3>
            修改前
            <small v-if="change.beforeStart"
              >第 {{ change.beforeStart }} 行起</small
            >
          </h3>
          <pre>{{ change.before || "无对应段落" }}</pre>
        </section>
        <section>
          <h3>
            修改后
            <small v-if="change.afterStart"
              >第 {{ change.afterStart }} 行起</small
            >
          </h3>
          <pre>{{ change.after || "无对应段落" }}</pre>
        </section>
        <label>
          <span>修改理由 <small>选填</small></span>
          <textarea
            :value="change.reason"
            :maxlength="REVISION_REASON_LIMIT"
            :disabled="disabled || !current"
            :aria-label="`差异 ${index + 1} 的修改理由`"
            placeholder="例如：减少解释，让人物通过行动表达情绪…"
            @input="update(change.id, $event)"
          />
        </label>
      </div>
    </article>
    <button
      v-if="expanded && visible < changes.length"
      class="revision-text-button"
      @click="visible += 20"
    >
      继续显示 {{ Math.min(20, changes.length - visible) }} 组差异
    </button>
  </section>
</template>

<style scoped>
.revision-differences > .revision-differences-header {
  align-items: center;
  gap: 12px 20px;
}
.revision-heading,
.revision-heading h2 {
  display: flex;
  align-items: center;
}
.revision-heading {
  flex-wrap: wrap;
  gap: 8px 14px;
  min-width: 0;
}
.revision-heading h2 {
  gap: 9px;
  line-height: 1.5;
}
.revision-count {
  padding: 2px 8px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 7px;
  background: var(--surface-muted);
  font-size: 0.75em;
  font-weight: 500;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.revision-toggle-icon {
  width: 1em;
  height: 1em;
  flex: none;
  transition: transform 200ms ease;
}
.revision-toggle-icon.is-expanded {
  transform: rotate(180deg);
}
.revision-comparison-status {
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.5;
}
@media (prefers-reduced-motion: reduce) {
  .revision-toggle-icon {
    transition: none;
  }
}
</style>
