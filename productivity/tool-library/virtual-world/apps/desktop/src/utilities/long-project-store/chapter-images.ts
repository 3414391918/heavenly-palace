import { dirname, extname, posix, resolve } from "node:path";
import {
  LONG_CHAPTER_IMAGE_MAX_BYTES,
  LONG_WORKSPACE_INDEX_PATH,
  LongReadChapterImageInputSchema,
  LongReadChapterImageResultSchema,
  LongReplaceChapterImageInputSchema,
  LongReplaceChapterImageResultSchema,
  type LongReadChapterImageInput,
  type LongReplaceChapterImageInput
} from "@deepwrite/contracts";
import {
  commitProjectTransaction,
  projectTransactionContentSha256,
  ProjectTransactionConflictError
} from "../project-transaction";
import {
  encodeChapterImageReplacement,
  readChapterImageAsPng
} from "./chapter-image-codec";
import { validateRelativeProjectPath } from "../project-transaction/validation";
import {
  assertContained,
  readNoFollowFile,
  readSecureTextFile,
  secureDirectory,
  validateParentDirectories
} from "./io";
import { loadProject } from "./load-project";
import type { LongProjectStoreContext } from "./store-context";
import { MAX_DOCUMENT_BYTES, MAX_LEDGER_RECORD_BYTES } from "./types";

async function loadChapterImage(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongReadChapterImageInput
) {
  const loaded = await loadProject(ctx, directory);
  if (loaded.book.id !== input.bookId)
    throw new Error("正文图片所属作品不一致。");
  const chapter = loaded.index.chapters.find(
    ({ chapterCardId }) => chapterCardId === input.chapterCardId
  );
  if (!chapter) throw new Error("正文图片对应的章节正文不存在。");
  if (!/^long\/chapters\/[a-f0-9]{32}\/body\.md$/u.test(chapter.body.path))
    throw new Error("正文图片只能位于规范章节正文的 images 目录。");
  const body = await readSecureTextFile(
    loaded.projectDirectory,
    chapter.body.path,
    MAX_DOCUMENT_BYTES
  );
  const referenced = [...body.content.matchAll(/!\[(.*?)\]\((.*?)\)/gu)].some(
    (match) => match[2] === `images/${input.filename}`
  );
  if (!referenced) throw new Error("当前章节正文未引用这张图片。");
  const relativePath = posix.join(
    posix.dirname(chapter.body.path),
    "images",
    input.filename
  );
  if (
    validateRelativeProjectPath(relativePath) !== relativePath ||
    relativePath.normalize("NFC") !== relativePath ||
    !relativePath.startsWith("long/")
  )
    throw new Error("正文图片必须使用 long/ 下的规范路径。");
  const target = resolve(loaded.projectDirectory, relativePath);
  assertContained(loaded.projectDirectory, target);
  await validateParentDirectories(loaded.projectDirectory, dirname(target));
  const { bytes } = await readNoFollowFile(
    target,
    LONG_CHAPTER_IMAGE_MAX_BYTES,
    "正文图片",
    loaded.projectDirectory
  );
  return {
    loaded,
    chapter,
    body,
    relativePath,
    bytes,
    revision: projectTransactionContentSha256(bytes),
    extension: extname(input.filename).slice(1).toLowerCase()
  };
}

export async function readChapterImage(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongReadChapterImageInput
) {
  const parsed = LongReadChapterImageInputSchema.parse(input);
  const canonical = await secureDirectory(directory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () => {
    const state = await loadChapterImage(ctx, canonical, parsed);
    return LongReadChapterImageResultSchema.parse({
      pngDataUrl: await readChapterImageAsPng(state.bytes, state.extension),
      revision: state.revision
    });
  });
}

export async function replaceChapterImage(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongReplaceChapterImageInput
) {
  const parsed = LongReplaceChapterImageInputSchema.parse(input);
  const canonical = await secureDirectory(directory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () => {
    const state = await loadChapterImage(ctx, canonical, parsed);
    if (state.revision !== parsed.expectedRevision)
      throw new ProjectTransactionConflictError(
        state.relativePath,
        parsed.expectedRevision,
        state.revision
      );
    const bytes = await encodeChapterImageReplacement(
      parsed.pngDataUrl,
      state.extension
    );
    await commitProjectTransaction({
      projectRoot: state.loaded.projectDirectory,
      maxFileBytes: MAX_LEDGER_RECORD_BYTES,
      operations: [
        {
          action: "check",
          path: state.chapter.body.path,
          expectedSha256: state.body.sha256
        },
        {
          action: "check",
          path: LONG_WORKSPACE_INDEX_PATH,
          expectedSha256: state.loaded.indexDisk.sha256
        },
        {
          path: state.relativePath,
          content: bytes,
          expectedSha256: parsed.expectedRevision
        }
      ]
    });
    return LongReplaceChapterImageResultSchema.parse({
      revision: projectTransactionContentSha256(bytes)
    });
  });
}
