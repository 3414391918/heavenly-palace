import { createApp, h, nextTick } from "vue";
import { createPinia } from "pinia";
import type {
  LongBookSummary,
  LongWorkspaceIndexSnapshot,
  TextContextMenuEvent,
  TextContextMenuCommand
} from "@deepwrite/contracts";
import LongWorkspaceEditor from "../../components/LongWorkspaceEditor.vue";
import { createLongChapterSelection } from "../../types/longWorkspace";
import { installNativeTextContextMenu } from "../../composables/nativeTextContextMenu";

/** Runs inside a disposable Electron profile with the real image/save IPC. */
export async function runChapterIllustrationRendererSmoke(
  summary: LongBookSummary,
  index: LongWorkspaceIndexSnapshot
) {
  const started = performance.now();
  const mark = (step: string) =>
    console.info(
      `ILLUSTRATION_SMOKE ${Math.round(performance.now() - started)}ms ${step}`
    );
  const api = window.deepwrite?.long;
  if (!api) throw new Error("Illustration smoke Preload unavailable");
  const chapter = index.chapters[0]!;
  const selection = createLongChapterSelection(
    summary,
    index,
    chapter.chapterCardId
  )!;
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;inset:0;z-index:99999;width:1000px;height:700px";
  document.body.append(host);
  let dispatch!: (event: TextContextMenuEvent) => void;
  let prepared: TextContextMenuCommand | undefined;
  const disposeMenu = installNativeTextContextMenu({
    subscribe(listener) {
      dispatch = listener;
      return () => {};
    },
    reply(command) {
      if (command.payload.phase === "prepared") prepared = command;
    }
  });
  const createEditor = () =>
    createApp({
      render: () =>
        h(LongWorkspaceEditor, {
          bookId: summary.id,
          selection,
          workspaceIndex: index,
          defaultViewMode: "edit"
        })
    }).use(createPinia());
  let application = createEditor();
  const wait = async (predicate: () => boolean, step: string) => {
    const deadline = Date.now() + 15_000;
    while (!predicate()) {
      if (Date.now() > deadline)
        throw new Error(`Illustration UI smoke timed out: ${step}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await nextTick();
  };
  const editor = () =>
    host.querySelector<HTMLTextAreaElement>(".long-document-editor")!;
  const dialog = () =>
    [...document.querySelectorAll<HTMLElement>(".character-dialog")].find(
      (item) => item.querySelector("h3")?.textContent === "新增图片"
    );
  const button = (label: string, root: ParentNode = host) => {
    const control = [
      ...root.querySelectorAll<HTMLButtonElement>("button")
    ].find((item) => item.textContent?.trim() === label);
    if (!control || control.disabled)
      throw new Error(`Illustration button unavailable: ${label}`);
    return control;
  };
  let menuId = 0;
  async function open(offset: number) {
    mark("open menu");
    const input = editor();
    input.focus();
    input.setSelectionRange(offset, offset);
    input.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, button: 2 })
    );
    const id = `illustration_smoke_${++menuId}`;
    const send = (payload: TextContextMenuEvent["payload"]) =>
      dispatch({
        protocolVersion: 1,
        id,
        type: "textContextMenu.event",
        timestamp: new Date().toISOString(),
        context: { correlationId: id },
        payload
      });
    send({ phase: "prepare" });
    if (
      prepared?.payload.phase !== "prepared" ||
      !prepared.payload.context.canAddIllustration
    )
      throw new Error("Chapter editor omitted the illustration menu action");
    send({ phase: "action", action: "addIllustration" });
    await wait(() => Boolean(dialog()), "open paste dialog");
  }
  try {
    mark("mount editor");
    application.mount(host);
    // A previous preview smoke remembers this same chapter's preview mode.
    // Enter editing explicitly while preserving the production view memory.
    await wait(
      () =>
        [...host.querySelectorAll<HTMLButtonElement>("button")].some(
          (item) => item.textContent?.trim() === "编辑" && !item.disabled
        ),
      "load text view controls"
    );
    button("编辑").click();
    await wait(
      () => Boolean(editor() && !editor().readOnly && editor().value),
      "load editable manuscript"
    );
    mark("editor ready");
    const original = editor().value;
    const offset = original.indexOf("\n");
    if (offset < 0) throw new Error("Illustration fixture needs paragraphs");
    await open(offset);
    button("取消", dialog()!).click();
    await wait(() => !dialog(), "cancel paste dialog");
    if (editor().value !== original)
      throw new Error("Cancel changed the draft");
    mark("cancel verified");
    for (const filename of ["001.png", "002.png"]) {
      const before = editor().value;
      await open(offset);
      const confirm = button(
        "取消",
        dialog()!
      ).parentElement!.querySelector<HTMLButtonElement>(
        ".chapter-image-confirm"
      )!;
      if (!confirm.disabled)
        throw new Error("Empty image confirmation was enabled");
      mark(`paste ${filename}`);
      if (filename === "001.png") {
        const snapshot = await api.readClipboardImage();
        if (!snapshot) throw new Error("Illustration clipboard is empty");
        const bytes = Uint8Array.from(
          atob(snapshot.pngDataUrl.split(",")[1]!),
          (character) => character.charCodeAt(0)
        );
        const clipboardData = new DataTransfer();
        clipboardData.items.add(
          new File([bytes], "clipboard.png", { type: "image/png" })
        );
        // Exercise the same paste event path as Command/Ctrl+V, including decode.
        dialog()!.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData,
            bubbles: true,
            cancelable: true
          })
        );
      } else button("粘贴图片", dialog()!).click();
      await wait(() => !confirm.disabled, `paste ${filename}`);
      mark(`confirm ${filename}`);
      confirm.click();
      await wait(
        () => !dialog() && editor().value.includes(`![](images/${filename})`),
        `save ${filename}`
      );
      const saved = await api.readDocument({
        bookId: summary.id,
        fileId: chapter.body.id,
        offset: 0,
        maxCharacters: 256 * 1024
      });
      if (saved.content !== editor().value)
        throw new Error("Inserted Markdown was not saved");
      mark(`saved ${filename}`);
      if (filename === "001.png") {
        const undo = host.querySelector<HTMLButtonElement>(
          'button[aria-label="撤销"],button[title="撤销"]'
        )!;
        if (!undo || undo.disabled)
          throw new Error(
            "Illustration insertion was missing from undo history"
          );
        undo.click();
        await nextTick();
        if (editor().value !== before)
          throw new Error("Undo lost the original manuscript");
        const redo = host.querySelector<HTMLButtonElement>(
          'button[aria-label="还原"]'
        )!;
        redo.click();
        await nextTick();
        if (editor().value !== saved.content)
          throw new Error("Redo lost the image reference");
      }
    }
    const expected = editor().value;
    mark("preview");
    button("预览").click();
    await wait(
      () =>
        host.querySelectorAll('img[src*="/001.png"],img[src*="/002.png"]')
          .length === 2,
      "preview both illustrations"
    );
    for (const image of host.querySelectorAll<HTMLImageElement>(
      'img[src*="/001.png"],img[src*="/002.png"]'
    )) {
      image.loading = "eager";
      await image.decode();
    }
    application.unmount();
    mark("reopen preview");
    application = createEditor();
    application.mount(host);
    await wait(
      () =>
        host.querySelectorAll('img[src*="/001.png"],img[src*="/002.png"]')
          .length === 2,
      "reopen illustration preview"
    );
    mark("reopened image elements ready");
    for (const image of host.querySelectorAll<HTMLImageElement>(
      'img[src*="/001.png"],img[src*="/002.png"]'
    )) {
      // Offscreen lazy images defer decoding until visible. Match the existing
      // preview smoke while verifying the same persisted image URLs.
      image.loading = "eager";
      await Promise.race([
        image.decode(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Reopened illustration decode timed out")),
            10_000
          )
        )
      ]);
    }
    mark("reopened images decoded");
    button("编辑").click();
    await wait(
      () => Boolean(editor() && editor().value === expected),
      "reload saved manuscript"
    );
    if (host.querySelector(".long-editor-save-state.is-dirty"))
      throw new Error("Inserted image was shown as unsaved");
    mark("complete");
    return {
      status: "ok",
      cancel: true,
      added: true,
      keyboardPaste: true,
      sequence: true,
      undoRedo: true,
      preview: true,
      reopened: true
    };
  } finally {
    application.unmount();
    disposeMenu();
    host.remove();
  }
}
