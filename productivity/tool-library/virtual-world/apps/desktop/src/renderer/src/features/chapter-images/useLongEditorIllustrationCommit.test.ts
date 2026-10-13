import { computed, ref } from "vue";
import { expect, it, vi } from "vitest";
import type { LongWorkspaceFileReference } from "@deepwrite/contracts";
import type { LongWorkspaceSelection } from "../../types/longWorkspace";
import { useLongEditorIllustrationCommit } from "./useLongEditorIllustrationCommit";

it("offers insertion for a chapter body stored under its chapter id", () => {
  const chapterCardId = "chapter_071894ed";
  const imageContext = useLongEditorIllustrationCommit({
    bookId: () => "longbook_example",
    selection: () => ({ chapterCardId }) as LongWorkspaceSelection,
    selectedFile: computed(() => ({
      role: "body" as const,
      label: "正文",
      file: {
        path: `long/chapters/${chapterCardId}/body.md`
      } as LongWorkspaceFileReference
    })),
    currentState: computed(() => undefined),
    documentStates: ref({}),
    pending: ref(false),
    recordChange: vi.fn(),
    clearRecovery: vi.fn(),
    persistRecovery: vi.fn(),
    saved: vi.fn()
  }).imageContext;

  expect(imageContext.value).toEqual({
    bookId: "longbook_example",
    chapterCardId
  });
});
