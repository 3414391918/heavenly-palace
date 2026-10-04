import { computed, type ComputedRef, type Ref } from "vue";
import type {
  LongAddChapterImageResult,
  LongWriteDocumentResult
} from "@deepwrite/contracts";
import type { LongDocumentState } from "../../composables/useLongEditorDocumentSession";
import type {
  LongWorkspaceSelection,
  LongWorkspaceSelectionFile
} from "../../types/longWorkspace";
import { uiMessage } from "../../ui-feedback";

/** Adopts the Core transaction without bypassing editor history or recovery state. */
export function useLongEditorIllustrationCommit(options: {
  bookId(): string;
  selection(): LongWorkspaceSelection | null;
  selectedFile: ComputedRef<LongWorkspaceSelectionFile | undefined>;
  currentState: ComputedRef<LongDocumentState | undefined>;
  documentStates: Ref<Record<string, LongDocumentState>>;
  pending: Ref<boolean>;
  recordChange(
    content: string,
    selection: { start: number; end: number }
  ): unknown;
  clearRecovery(key: string, bookId: string, fileId: string): void;
  persistRecovery(key: string): void;
  saved(result: LongWriteDocumentResult): void;
}) {
  const imageContext = computed(() => {
    const chapterCardId = options.selection()?.chapterCardId;
    const path = options.selectedFile.value?.file.path ?? "";
    return chapterCardId &&
      /^long\/chapters\/[a-f0-9]{32}\/body\.md$/u.test(path)
      ? { bookId: options.bookId(), chapterCardId }
      : undefined;
  });
  function accept(result: LongAddChapterImageResult, previousContent: string) {
    const { document, content, selectionOffset } = result;
    const key = `${document.bookId}\u0000${document.file.id}`;
    const state = options.documentStates.value[key];
    if (state) {
      if (state.content === previousContent) {
        if (options.currentState.value === state)
          options.recordChange(content, {
            start: selectionOffset,
            end: selectionOffset
          });
        state.content = content;
      }
      state.savedContent = content;
      state.file = document.file;
      state.loaded = true;
      state.loadError = null;
      if (state.content === content)
        options.clearRecovery(key, document.bookId, document.file.id);
      else options.persistRecovery(key);
    }
    options.saved(document);
    uiMessage.success("插画已添加并保存");
  }
  function canLeave() {
    if (!options.pending.value) return true;
    uiMessage.info("插画正在保存，请稍候再切换。");
    return false;
  }
  return { imageContext, accept, canLeave };
}
