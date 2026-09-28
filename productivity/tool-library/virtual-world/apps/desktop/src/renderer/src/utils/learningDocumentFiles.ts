import {
  LEARNING_IMITATION_DOCUMENT_MAX_CHARACTERS,
  type LearningImitationDocument
} from "@deepwrite/contracts/renderer";
import { createId } from "@deepwrite/shared";
import { DOCX_MEDIA_TYPE, extractDocxText } from "./docxDocumentText";
import { readPromptAttachment } from "./promptAttachments";

export const LEARNING_DOCUMENT_ACCEPT = [
  ".txt",
  ".md",
  ".markdown",
  ".pdf",
  ".doc",
  ".docx",
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/msword",
  DOCX_MEDIA_TYPE
].join(",");

export const LEARNING_DOCUMENT_SUPPORTED_LABEL =
  "TXT、Markdown、PDF、Word（.doc/.docx）";

const LEARNING_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;
export interface LearningDocumentReadResult {
  document: LearningImitationDocument;
  warning?: string;
}

function extensionOf(name: string): string {
  return name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
}

function learningDocumentId(): string {
  return createId("learning_document");
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function toLearningDocument(
  file: File,
  mediaType: string,
  extractedText: string
): LearningDocumentReadResult {
  const normalized = normalizeExtractedText(extractedText);
  if (!normalized) {
    throw new Error(`无法从“${file.name}”中提取可读正文。`);
  }
  const text = normalized.slice(0, LEARNING_IMITATION_DOCUMENT_MAX_CHARACTERS);
  const truncated = text.length < normalized.length;
  return {
    document: {
      id: learningDocumentId(),
      name: file.name,
      extension: extensionOf(file.name),
      mediaType,
      size: file.size,
      text,
      charCount: normalized.replace(/\p{White_Space}/gu, "").length,
      ...(truncated
        ? { truncated: true, originalLength: normalized.length }
        : {})
    },
    ...(truncated
      ? {
          warning: `“${file.name}”正文较长，仅保留前 ${LEARNING_IMITATION_DOCUMENT_MAX_CHARACTERS.toLocaleString("zh-CN")} 个字符用于学习。`
        }
      : {})
  };
}

function isReadableLegacyWordCodePoint(code: number): boolean {
  return (
    code === 9 ||
    code === 10 ||
    code === 13 ||
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0x3400 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xffef)
  );
}

function collectReadableRuns(text: string, minimumLength: number): string[] {
  const runs: string[] = [];
  let current = "";
  for (const character of text) {
    if (isReadableLegacyWordCodePoint(character.codePointAt(0) ?? 0)) {
      current += character;
    } else {
      if (current.trim().length >= minimumLength) runs.push(current);
      current = "";
    }
  }
  if (current.trim().length >= minimumLength) runs.push(current);
  return runs;
}

function collectUtf16ReadableRuns(bytes: Uint8Array, offset: number): string[] {
  let text = "";
  for (let index = offset; index + 1 < bytes.length; index += 2) {
    text += String.fromCharCode(bytes[index]! | (bytes[index + 1]! << 8));
  }
  return collectReadableRuns(text, 4);
}

function normalizeLegacyWordRuns(runs: readonly string[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const run of runs) {
    for (const line of run
      .split("\u0000")
      .join("")
      .replace(/\u00a0/gu, " ")
      .replace(/[ \t]+/gu, " ")
      .split(/\r?\n+/gu)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2)) {
      if (seen.has(line)) continue;
      seen.add(line);
      lines.push(line);
    }
  }
  return lines.join("\n");
}

function extractLegacyWordText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const runs = [
    ...collectUtf16ReadableRuns(bytes, 0),
    ...collectUtf16ReadableRuns(bytes, 1)
  ];
  try {
    runs.push(
      ...collectReadableRuns(new TextDecoder("gb18030").decode(bytes), 6)
    );
  } catch {
    runs.push(...collectReadableRuns(new TextDecoder().decode(bytes), 6));
  }
  return normalizeLegacyWordRuns(runs);
}

export async function readLearningDocumentFile(
  file: File
): Promise<LearningDocumentReadResult> {
  if (file.size > LEARNING_DOCUMENT_MAX_BYTES) {
    throw new Error(`“${file.name}”超过 25 MB，请拆分或压缩后再上传。`);
  }
  const extension = extensionOf(file.name);
  if (extension === "doc" || file.type === "application/msword") {
    const text = extractLegacyWordText(await file.arrayBuffer());
    if (!text.trim()) {
      throw new Error(
        `无法从“${file.name}”中提取可读文字，请另存为 .docx 后再上传。`
      );
    }
    return toLearningDocument(file, "application/msword", text);
  }
  if (extension === "docx" || file.type === DOCX_MEDIA_TYPE) {
    return toLearningDocument(
      file,
      DOCX_MEDIA_TYPE,
      await extractDocxText(await file.arrayBuffer())
    );
  }
  if (
    ["txt", "md", "markdown"].includes(extension) ||
    file.type.startsWith("text/")
  ) {
    return toLearningDocument(
      file,
      file.type || (extension === "txt" ? "text/plain" : "text/markdown"),
      await file.text()
    );
  }
  try {
    const result = await readPromptAttachment(file);
    if (result.attachment.kind !== "text") {
      throw new Error("学习仿写只接受可提取正文的文档。");
    }
    const document = toLearningDocument(
      file,
      result.attachment.mediaType,
      result.attachment.content
    );
    if (result.attachment.truncated && result.attachment.originalLength) {
      document.document.truncated = true;
      document.document.originalLength = result.attachment.originalLength;
      document.document.charCount = result.attachment.originalLength;
    }
    return {
      ...document,
      ...(result.warning ? { warning: result.warning } : {})
    };
  } catch (error: unknown) {
    if (
      !["txt", "md", "markdown", "pdf"].includes(extension) &&
      !file.type.startsWith("text/") &&
      file.type !== "application/pdf"
    ) {
      throw new Error(
        `不支持“${file.name}”的文件类型；请选择${LEARNING_DOCUMENT_SUPPORTED_LABEL}。`
      );
    }
    throw error;
  }
}
