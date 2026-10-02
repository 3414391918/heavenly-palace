<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue";
import type { LongReadChapterImageInput } from "@deepwrite/contracts";
import ImageDialog from "../character-assets/CharacterAssetDialog.vue";
import { uiMessage } from "../../ui-feedback";
import {
  useChapterImageActions,
  type ChapterImageContext
} from "./useChapterImageActions";
import { pastedImagePng, singlePastedImage } from "./clipboard-image";
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
const pasting = ref(false);
let pasteGeneration = 0;
watch(dialog, () => {
  pasteGeneration++;
  pasting.value = false;
});
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
async function onPaste(event: ClipboardEvent) {
  if (!dialog.value) return;
  event.preventDefault();
  event.stopPropagation();
  if (busy.value || loading.value || pasting.value) return;
  const current = ++pasteGeneration;
  pasting.value = true;
  try {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length) {
      const file = singlePastedImage(files);
      const png = await pastedImagePng(file);
      if (current === pasteGeneration) state.acceptPng(png);
    } else await state.pasteClipboard();
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "无法粘贴图片。");
  } finally {
    if (current === pasteGeneration) pasting.value = false;
  }
}
async function paste() {
  if (pasting.value) return;
  pasting.value = true;
  const current = ++pasteGeneration;
  await perform(() => state.pasteClipboard());
  if (current === pasteGeneration) pasting.value = false;
}
function close() {
  if (!pasting.value) state.closeDialog();
}
onMounted(() => document.addEventListener("paste", onPaste, true));
onBeforeUnmount(() => {
  pasteGeneration++;
  document.removeEventListener("paste", onPaste, true);
});
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
    <ImageDialog
      v-if="dialog"
      title="替换图片"
      :busy="busy || pasting"
      @close="close"
    >
      <div class="chapter-image-replacement">
        <p>粘贴一张图片，确认后替换当前图片。</p>
        <div
          class="chapter-image-paste-area"
          tabindex="0"
          aria-label="粘贴替换图片"
        >
          <img
            v-if="dialog.pastedImage"
            :src="dialog.pastedImage"
            alt="待替换图片"
          />
          <span v-else>{{
            loading
              ? "正在读取原图…"
              : pasting
                ? "正在读取粘贴图片…"
                : "按 Command / Ctrl + V 粘贴图片"
          }}</span>
        </div>
        <button
          type="button"
          :disabled="loading || busy || pasting"
          @click="paste"
        >
          粘贴图片
        </button>
      </div>
      <template #actions>
        <button type="button" :disabled="busy || pasting" @click="close">
          取消
        </button>
        <button
          type="button"
          class="chapter-image-confirm"
          :disabled="!dialog.pastedImage || !dialog.revision || busy || pasting"
          @click="perform(state.confirm, '图片已替换并保存')"
        >
          {{ busy ? "正在替换…" : "确认替换" }}
        </button>
      </template>
    </ImageDialog>
  </div>
</template>

<style scoped src="./chapter-image-actions.css" />
