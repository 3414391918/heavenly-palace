import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEnvelope, DEFAULT_REVISION_METHOD } from "@deepwrite/contracts";
import { RevisionAnalysisConfigStore } from "./config-store";
describe("revision settings persistence", () => {
  it("persists only the validated method and routes envelope commands", async () => {
    const directory = await mkdtemp(join(tmpdir(), "revision-settings-"));
    try {
      const store = new RevisionAnalysisConfigStore(directory);
      expect((await store.list()).systemPrompt).toBe(DEFAULT_REVISION_METHOD);
      const saved = await store.handle(
        createEnvelope(
          "revisionAnalysisSettings.save",
          {
            systemPrompt: "测试分析方法"
          },
          { id: "save-settings" }
        )
      );
      expect(saved?.status).toBe("accepted");
      expect(
        (await new RevisionAnalysisConfigStore(directory).list()).systemPrompt
      ).toBe("测试分析方法");
      expect(
        JSON.parse(
          await readFile(
            join(directory, "revision-analysis-settings.json"),
            "utf8"
          )
        )
      ).toEqual({ systemPrompt: "测试分析方法" });
      await expect(store.save({ systemPrompt: " " })).rejects.toThrow();
      await store.handle(
        createEnvelope(
          "revisionAnalysisSettings.reset",
          {},
          { id: "reset-settings" }
        )
      );
      expect((await store.list()).systemPrompt).toBe(DEFAULT_REVISION_METHOD);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
