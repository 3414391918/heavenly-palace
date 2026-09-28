<script setup lang="ts">
import { computed } from "vue";
import type { SyncKind, SyncStatus } from "@deepwrite/contracts/renderer";

const props = defineProps<{
  items: SyncStatus["items"];
  pending: boolean;
}>();
const emit = defineEmits<{ toggle: [key: string, included: boolean] }>();
const categories: { title: string; kinds: SyncKind[] }[] = [
  { title: "创作空间", kinds: ["book", "long-book"] },
  { title: "技能库", kinds: ["skill-library", "skill-group"] },
  { title: "素材库", kinds: ["material-library", "material-group"] }
];
const groups = computed(() =>
  categories.map((category) => {
    const items = props.items.filter((item) =>
      category.kinds.includes(item.kind)
    );
    return {
      title: category.title,
      items,
      included: items.filter((item) => item.included).length
    };
  })
);
function changeIncluded(key: string, event: Event) {
  if (event.target instanceof HTMLInputElement)
    emit("toggle", key, event.target.checked);
}
</script>

<template>
  <section class="sync-card sync-content-panel">
    <h2>同步内容</h2>
    <p>
      按创作空间、技能库和素材库管理。关闭只暂停本机同步，不删除任何内容。作品绑定的技能库和素材库也需要加入。
    </p>
    <section
      v-for="group in groups"
      :key="group.title"
      class="sync-content-group"
      :aria-label="group.title"
    >
      <header class="sync-content-heading">
        <h3>{{ group.title }}</h3>
        <span>已启用 {{ group.included }} / {{ group.items.length }} 项</span>
      </header>
      <label v-for="item in group.items" :key="item.key" class="sync-list-row">
        <span>
          {{ item.title }}
          <small>{{
            !item.included
              ? "已暂停同步"
              : item.dirty && item.remoteDirty
                ? "两端都有修改"
                : item.dirty
                  ? "待上传到远端"
                  : item.remoteDirty
                    ? "待下载到本机"
                    : "已同步"
          }}</small>
        </span>
        <input
          type="checkbox"
          :checked="item.included"
          :disabled="pending"
          :aria-label="`同步 ${item.title}`"
          @change="changeIncluded(item.key, $event)"
        />
      </label>
      <p v-if="!group.items.length" class="sync-content-empty">
        暂无可同步的{{ group.title }}内容
      </p>
    </section>
  </section>
</template>

<style scoped>
.sync-content-group {
  min-width: 0;
  border: 1px solid var(--theme-line-soft);
  border-radius: 10px;
  overflow: hidden;
}
.sync-content-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 12px 16px;
  background: var(--surface-muted);
}
.sync-content-heading h3 {
  font-size: 1em;
  line-height: 1.5;
}
.sync-content-heading > span {
  font-size: 0.875em;
  color: var(--text-secondary);
}
.sync-content-group .sync-list-row {
  margin: 0 16px;
  flex-wrap: nowrap;
  gap: 16px;
  cursor: pointer;
}
.sync-content-group .sync-list-row > span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.sync-content-group input {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: inherit;
}
.sync-content-group input:disabled {
  cursor: default;
}
.sync-content-group .sync-content-empty {
  margin: 0;
  padding: 16px;
  color: var(--text-secondary);
}
</style>
