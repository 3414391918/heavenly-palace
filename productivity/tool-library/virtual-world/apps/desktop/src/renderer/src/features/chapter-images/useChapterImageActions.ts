import { onScopeDispose, ref, watch } from "vue";
import type {
  DeepWriteApi,
  LongReadChapterImageInput
} from "@deepwrite/contracts";
export type ChapterImageContext = Pick<
  LongReadChapterImageInput,
  "bookId" | "chapterCardId"
>;
export type ChapterImageApi = Pick<
  DeepWriteApi["long"],
  | "readChapterImage"
  | "replaceChapterImage"
  | "copyChapterImage"
  | "readClipboardImage"
>;
interface Replacement {
  target: LongReadChapterImageInput;
  revision?: string;
  pastedImage?: string;
}
function freshPreviewVersion(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}
export function useChapterImageActions(
  context: () => ChapterImageContext | undefined,
  api: () => ChapterImageApi
) {
  const menu = ref<{
    target: LongReadChapterImageInput;
    x: number;
    y: number;
  } | null>(null);
  const dialog = ref<Replacement | null>(null);
  const busy = ref(false);
  const loading = ref(false);
  const versions = ref<Record<string, string>>({});
  // A previous view may retain decoded images even with Cache-Control: no-store.
  // A fresh URL for each preview makes Chromium read the current file again.
  const previewVersion = ref(freshPreviewVersion());
  let generation = 0;
  function reset() {
    generation++;
    menu.value = null;
    dialog.value = null;
    busy.value = false;
    loading.value = false;
    versions.value = {};
    previewVersion.value = freshPreviewVersion();
  }
  watch(
    () => `${context()?.bookId ?? ""}:${context()?.chapterCardId ?? ""}`,
    reset,
    { flush: "sync" }
  );
  onScopeDispose(reset);
  function openMenu(target: LongReadChapterImageInput, x: number, y: number) {
    if (
      busy.value ||
      dialog.value ||
      target.bookId !== context()?.bookId ||
      target.chapterCardId !== context()?.chapterCardId
    )
      return;
    menu.value = { target, x, y };
  }
  async function copy() {
    const target = menu.value ? { ...menu.value.target } : undefined;
    menu.value = null;
    if (target) await api().copyChapterImage(target);
  }
  async function beginReplacement() {
    const target = menu.value ? { ...menu.value.target } : undefined;
    menu.value = null;
    if (!target) return;
    const current = ++generation;
    dialog.value = { target };
    loading.value = true;
    try {
      const snapshot = await api().readChapterImage(target);
      if (current === generation && dialog.value)
        dialog.value.revision = snapshot.revision;
    } catch (error) {
      if (current === generation) dialog.value = null;
      throw error;
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  function closeDialog() {
    if (busy.value) return;
    generation++;
    loading.value = false;
    dialog.value = null;
  }
  function acceptPng(pngDataUrl: string) {
    if (dialog.value && !busy.value && !loading.value)
      dialog.value.pastedImage = pngDataUrl;
  }
  async function pasteClipboard() {
    if (!dialog.value || busy.value || loading.value) return;
    const current = generation;
    const snapshot = await api().readClipboardImage();
    if (current !== generation) return;
    if (!snapshot) throw new Error("剪贴板中没有图片，请先复制一张图片。");
    acceptPng(snapshot.pngDataUrl);
  }
  async function confirm() {
    const state = dialog.value;
    if (!state?.revision || !state.pastedImage || busy.value) return;
    const current = generation;
    busy.value = true;
    try {
      const result = await api().replaceChapterImage({
        ...state.target,
        pngDataUrl: state.pastedImage,
        expectedRevision: state.revision
      });
      if (current !== generation) return;
      versions.value = {
        ...versions.value,
        [state.target.filename]: result.revision
      };
      dialog.value = null;
      busy.value = false;
      generation++;
    } finally {
      if (current === generation) busy.value = false;
    }
  }
  function versionedUrl(url: string | undefined) {
    if (!url?.startsWith("deepwrite-image://book/") || !context()) return url;
    const filename = url.split("/").at(-1)?.split("?")[0] ?? "";
    const revision = versions.value[filename] ?? previewVersion.value;
    return `${url.split("?")[0]}?v=${revision}`;
  }
  return {
    menu,
    dialog,
    busy,
    loading,
    openMenu,
    copy,
    beginReplacement,
    closeDialog,
    acceptPng,
    pasteClipboard,
    confirm,
    versionedUrl
  };
}
