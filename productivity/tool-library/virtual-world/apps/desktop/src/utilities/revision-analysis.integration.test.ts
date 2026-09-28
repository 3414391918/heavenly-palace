import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import {
  SystemEventEnvelopeSchema,
  parseSkillMarkdown,
  type DeepWriteApi,
  type ModelConfig,
  type SessionPromptCommandPayload
} from "@deepwrite/contracts";
import { PiAgentRuntimeAdapter } from "@deepwrite/pi-runtime-adapter";
import { FolderCatalogStore } from "./folder-catalog-store";
import { toEventEnvelope } from "./agent-event-envelope";
import { RevisionAnalysisConfigStore } from "../main/extras/revision-analysis/config-store";
import { createBookAnalysisServices } from "../main/extras/book-analysis-services";
import { useRevisionAnalysis } from "../renderer/src/extras/revision-analysis/useRevisionAnalysis";

describe("revision analysis runtime to persisted skill", () => {
  it("validates runtime events, keeps analysis in memory and persists a reusable skill through Core", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "deepwrite-revision-integration-")
    );
    const store = new FolderCatalogStore({ userDataPath: root });
    const settings = new RevisionAnalysisConfigStore(root);
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });
    let request: SessionPromptCommandPayload | undefined;
    const api = {
      revisionAnalysis: {
        list: () => settings.list(),
        save: settings.save.bind(settings),
        reset: async () => settings.list()
      },
      session: {
        prompt: async (input: SessionPromptCommandPayload) => {
          request = input;
          return {
            sessionId: input.sessionId,
            runId: "integration-run",
            acceptedAt: new Date().toISOString()
          };
        },
        abort: async () => ({})
      },
      catalog: { createLibraryEntry: store.createLibraryEntry.bind(store) }
    } as unknown as DeepWriteApi;
    const c = useRevisionAnalysis({ api: () => api });
    try {
      const created = await store.createLibrary({
        domain: "skill",
        name: "修改方向技能",
        skillKind: "general"
      });
      const library = (await store.snapshot()).skills.find(
        (l) => l.id === created.resource.id
      )!;
      c.setConfiguredModels([
        {
          id: "test",
          contextWindow: 200000,
          maxTokens: 16000,
          defaultThinkingLevel: "off",
          thinkingLevelOptions: ["off"]
        } as ModelConfig
      ]);
      await c.loadSettings();
      c.beforeText.value = "她十分悲伤。\n她走出房间。";
      c.afterText.value = "她攥紧衣角，走出房间。";
      c.compare();
      c.changes.value[0]!.reason = "用动作承载情绪";
      await nextTick();
      c.start();
      await nextTick();
      expect(request).toBeDefined();
      // Main rejects missing models before dispatching; the adapter also checks its effective model.
      await expect(
        createBookAnalysisServices(root).resolve(
          request!.workspaceContext,
          undefined
        )
      ).rejects.toThrow("可用模型");
      for await (const event of runtime.start({
        runId: "integration-run",
        sessionId: request!.sessionId,
        prompt: request!.message,
        workspaceContext: request!.workspaceContext!
      })) {
        c.handleEvent(
          SystemEventEnvelopeSchema.parse(toEventEnvelope(event, "integration"))
        );
      }
      expect(c.status.value).toBe("completed");
      expect(c.result.value?.report).toContain("用动作承载情绪");
      expect(
        (await store.snapshot()).skills.find((l) => l.id === library.id)!
          .entries
      ).toHaveLength(0);
      c.result.value!.body += "\n用户确认：避免用动作替代所有必要说明。";
      await c.persistSkill(library);
      const reopened = new FolderCatalogStore({ userDataPath: root });
      const saved = (await reopened.snapshot()).skills.find(
        (l) => l.id === library.id
      )!;
      expect(saved.entries).toHaveLength(1);
      expect(saved.entries[0]).toMatchObject({
        stageId: "draft",
        title: c.result.value!.title
      });
      expect(parseSkillMarkdown(saved.entries[0]!.body)).toEqual({
        valid: true,
        name: c.result.value!.title,
        description: c.result.value!.description,
        body: c.result.value!.body
      });
      const book = await reopened.createShortBook({
        title: "技能复用验证",
        genre: "其他",
        linkedSkillIdsByKind: { general: [saved.id] }
      });
      expect(book.resource.linkedSkillIdsByKind.general).toContain(saved.id);
    } finally {
      c.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });
});
