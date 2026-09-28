import { describe, expect, it } from "vitest";
import {
  LEARNING_DOCUMENT_ACCEPT,
  readLearningDocumentFile
} from "./learningDocumentFiles";

import { documentZipEntry } from "./documentZip.test-support";

function utf16Le(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes[index * 2] = code & 0xff;
    bytes[index * 2 + 1] = code >> 8;
  }
  return bytes;
}

describe("learning document files", () => {
  it("keeps novel-sized plain text beyond the ordinary chat preview limit", async () => {
    const content = `第一章\n${"雨".repeat(120_000)}`;
    const result = await readLearningDocumentFile(
      new File([content], "长篇.md", { type: "text/markdown" })
    );

    expect(result.document.text).toBe(content);
    expect(result.document.truncated).toBeUndefined();
    expect(result.document.charCount).toBeGreaterThan(100_000);
  });

  it("extracts paragraphs, tabs, line breaks, and entities from docx", async () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<w:document xmlns:w="urn:test"><w:body>',
      "<w:p><w:r><w:t>雾港 &amp; 回声</w:t></w:r></w:p>",
      "<w:p><w:r><w:t>第一行</w:t><w:br/><w:t>第二行</w:t><w:tab/><w:t>尾声</w:t></w:r></w:p>",
      "</w:body></w:document>"
    ].join("");
    const file = new File(
      [documentZipEntry("word/document.xml", xml).buffer as ArrayBuffer],
      "雾港.docx",
      {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
    );

    const result = await readLearningDocumentFile(file);

    expect(result.document.text).toContain("雾港 & 回声\n第一行\n第二行\t尾声");
    expect(result.document.mediaType).toContain("wordprocessingml");
  });

  it("recovers readable UTF-16 text from legacy doc files", async () => {
    const result = await readLearningDocumentFile(
      new File(
        [utf16Le("第一章\n雨夜归来，旧案重启。").buffer as ArrayBuffer],
        "旧稿.doc",
        {
          type: "application/msword"
        }
      )
    );

    expect(result.document.text).toContain("雨夜归来，旧案重启");
  });

  it("advertises Word support and rejects unrelated binary formats", async () => {
    expect(LEARNING_DOCUMENT_ACCEPT).toContain(".docx");
    await expect(
      readLearningDocumentFile(
        new File(["{}"], "data.json", { type: "application/json" })
      )
    ).rejects.toThrow("Word（.doc/.docx）");
  });
});
