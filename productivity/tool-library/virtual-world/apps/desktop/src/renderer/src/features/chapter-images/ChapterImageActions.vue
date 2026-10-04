<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import type { LongReadChapterImageInput } from "@deepwrite/contracts";
import ChapterImagePasteDialog from "./ChapterImagePasteDialog.vue";
import { uiMessage } from "../../ui-feedback";
import {
  useChapterImageActions,
  type ChapterImageContext
} from "./useChapterImageActions";
const props = defineProps<{
  context?: ChapterImageContext | undefined;
  disabled: boolean;
  resolveImageUrl?: ((source: string) => string | undefined) | undefined;
}>();
const state = useChapterImageActions(
  () => props.context,
  () => {
    const api = window.deepwrite?.long;
    if (!api) throw new Error("桌面服务不可用。");
    return api;
  }
);
const { menu, dialog, busy, loading } = state;
const menuPanel = ref<HTMLElement | null>(null);
watch(menu, async (value) => {
  if (value) {
    await nextTick();
    menuPanel.value?.querySelector<HTMLButtonElement>("button")?.focus();
  }
});
function resolveUrl(source: string) {
  return state.versionedUrl(props.resolveImageUrl?.(source));
}
function onContextMenu(event: MouseEvent) {
  const element = event.target;
  if (!(element instanceof HTMLImageElement) || !props.context) return;
  const match =
    /^deepwrite-image:\/\/book\/([^/]+)\/([a-f0-9]{32})\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|gif|avif))(?:\?v=[a-f0-9]{64})?$/iu.exec(
      element.getAttribute("src") ?? ""
    );
  if (!match || match[1] !== props.context.bookId) return;
  event.preventDefault();
  event.stopPropagation();
  if (props.disabled) return;
  const target: LongReadChapterImageInput = {
    ...props.context,
    filename: match[3]!
  };
  state.openMenu(
    target,
    Math.max(8, Math.min(event.clientX, window.innerWidth - 180)),
    Math.max(8, Math.min(event.clientY, window.innerHeight - 100))
  );
}
async function perform(action: () => Promise<unknown>, success?: string) {
  try {
    await action();
    if (success) uiMessage.success(success);
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "图片操作失败。");
  }
}
</script>

<template>
  <div class="chapter-image-actions" @contextmenu="onContextMenu">
    <slot :resolve-url="resolveUrl" />
    <Teleport to="body">
      <div
        v-if="menu"
        class="chapter-image-menu-dismiss"
        @mousedown.self="menu = null"
        @contextmenu.prevent="menu = null"
        @keydown.esc.stop="menu = null"
      >
        <div
          ref="menuPanel"
          class="chapter-image-menu"
          role="menu"
          aria-label="正文图片操作"
          :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
        >
          <button
            type="button"
            role="menuitem"
            @click="perform(state.copy, '图片已复制')"
          >
            复制图片
          </button>
          <button
            type="button"
            role="menuitem"
            @click="perform(state.beginReplacement)"
          >
            替换图片
          </button>
        </div>
      </div>
    </Teleport>
    <ChapterImagePasteDialog
      v-if="dialog"
      mode="replace"
      :image="dialog.pastedImage"
      :busy="busy"
      :loading="loading"
      :ready="Boolean(dialog.revision)"
      @close="state.closeDialog"
      @image="state.acceptPng"
      @confirm="perform(state.confirm, '图片已替换并保存')"
    />
  </div>
</template>

<style scoped src="./chapter-image-actions.css" />
