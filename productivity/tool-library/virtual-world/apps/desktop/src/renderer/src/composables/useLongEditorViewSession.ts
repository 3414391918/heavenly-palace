import { onScopeDispose, watch, type Ref } from "vue";
import type { TextViewMode } from "@deepwrite/contracts";

const MAX_REMEMBERED_DOCUMENTS = 500;
const modes = new Map<string, TextViewMode>();

export function clearLongEditorViewMemory(): void {
  modes.clear();
}

function remember(key: string, mode: TextViewMode): void {
  modes.delete(key);
  modes.set(key, mode);
  if (modes.size > MAX_REMEMBERED_DOCUMENTS) {
    const oldest = modes.keys().next().value;
    if (oldest !== undefined) modes.delete(oldest);
  }
}

/** Keep a document's view across passive refreshes and workspace navigation. */
export function useLongEditorViewSession(options: {
  documentKey(): string;
  defaultMode(): TextViewMode;
  readOnly(): boolean;
  viewMode: Ref<TextViewMode>;
  setViewMode(mode: TextViewMode): void;
  resetToDefault(forcePreview?: boolean): unknown;
  onDocumentChange(): void;
}): void {
  watch(
    options.documentKey,
    (key, previous) => {
      if (previous !== undefined) remember(previous, options.viewMode.value);
      options.setViewMode(
        options.readOnly()
          ? "preview"
          : (modes.get(key) ?? options.defaultMode())
      );
      options.onDocumentChange();
    },
    { immediate: true, flush: "sync" }
  );
  watch(options.viewMode, (mode) => remember(options.documentKey(), mode), {
    flush: "sync"
  });
  watch(options.defaultMode, () => options.resetToDefault(options.readOnly()), {
    flush: "sync"
  });
  watch(
    options.readOnly,
    (readOnly) => {
      if (readOnly) options.setViewMode("preview");
    },
    { flush: "sync" }
  );
  onScopeDispose(() => remember(options.documentKey(), options.viewMode.value));
}
