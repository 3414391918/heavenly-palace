import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import {
  DEFAULT_REVISION_METHOD,
  type DeepWriteApi,
  type ModelConfig,
  type SessionPromptCommandPayload,
  type SystemEventEnvelope,
  type SkillLibrary
} from "@deepwrite/contracts/renderer";
import { useRevisionAnalysis } from "./useRevisionAnalysis";
const model = {
  id: "model",
  defaultThinkingLevel: "off",
  thinkingLevelOptions: ["off"],
  contextWindow: 200000,
  maxTokens: 16000
} as ModelConfig;
const result = {
  report: "修改报告",
  title: "修改方向",
  description: "根据修改前后的差异学习可复用的修改规则。",
  body: "适用场景与执行规则"
};
const library = {
  id: "skills",
  isBuiltin: false,
  projectRevision: 3
} as SkillLibrary;
function fixture() {
  const prompt = vi.fn(async (input: SessionPromptCommandPayload) => ({
    sessionId: input.sessionId,
    runId: `${input.sessionId}-run`,
    acceptedAt: new Date().toISOString()
  }));
  const abort = vi.fn(async () => ({})),
    createLibraryEntry = vi.fn(async () => ({}));
  const api = {
    session: { prompt, abort },
    revisionAnalysis: {
      list: async () => ({ systemPrompt: DEFAULT_REVISION_METHOD }),
      save: async (s: unknown) => s,
      reset: async () => ({ systemPrompt: DEFAULT_REVISION_METHOD })
    },
    catalog: { createLibraryEntry }
  } as unknown as DeepWriteApi;
  const c = useRevisionAnalysis({ api: () => api });
  c.setConfiguredModels([model]);
  c.beforeText.value = "开头\n原句\n结尾";
  c.afterText.value = "开头\n改句\n结尾";
  c.compare();
  return { c, prompt, abort, createLibraryEntry };
}
function event(
  type: string,
  request: SessionPromptCommandPayload,
  payload: Record<string, unknown> = {}
): SystemEventEnvelope {
  return {
    type,
    payload: {
      sessionId: request.sessionId,
      runId: `${request.sessionId}-run`,
      ...payload
    }
  } as SystemEventEnvelope;
}
function finish(
  f: ReturnType<typeof fixture>,
  request = f.prompt.mock.calls.at(-1)![0]
) {
  f.c.handleEvent(
    event("revision_analysis.result_updated", request, {
      jobId: request.workspaceContext!.revisionAnalysis!.jobId,
      result
    })
  );
  f.c.handleEvent(event("agent.message_completed", request));
}
describe("revision analysis controller", () => {
  it.each(["before", "after", "none"])(
    "accepts a three-field draft with report text %s the tool call",
    async (order) => {
      const f = fixture();
      await nextTick();
      f.c.start();
      await nextTick();
      const request = f.prompt.mock.calls[0]![0];
      const report = "# 修改报告\n\n差异 1：删去重复解释。";
      if (order === "before") {
        f.c.handleEvent(
          event("agent.message_delta", request, { delta: report })
        );
      }
      f.c.handleEvent(
        event("revision_analysis.result_updated", request, {
          jobId: "obsolete-job",
          result: { ...result, report: "错误报告" }
        })
      );
      f.c.handleEvent(
        event("revision_analysis.result_updated", request, {
          jobId: request.workspaceContext!.revisionAnalysis!.jobId,
          result: { ...result, report: "" }
        })
      );
      if (order === "before") {
        f.c.handleEvent(
          event("agent.message_delta", request, { delta: "草稿已生成。" })
        );
      }
      f.c.handleEvent(
        event("agent.message_completed", request, {
          content:
            order === "after"
              ? report
              : order === "before"
                ? "草稿已生成。"
                : ""
        })
      );
      expect(f.c.status.value).toBe("completed");
      expect(f.c.error.value).toBeNull();
      expect(f.c.result.value).toEqual({
        ...result,
        report: order === "none" ? "" : report
      });
      expect(f.createLibraryEntry).not.toHaveBeenCalled();
      await f.c.persistSkill(library);
      expect(f.createLibraryEntry).toHaveBeenCalledOnce();
      f.c.dispose();
    }
  );
  it("freezes evidence, permits empty reasons and retains result until next success", async () => {
    const f = fixture();
    await nextTick();
    f.c.start();
    const first = f.prompt.mock.calls[0]![0];
    expect(first.workspaceContext?.revisionAnalysis?.overallReason).toBe("");
    expect(() => f.c.compare()).toThrow("正在处理");
    await nextTick();
    finish(f);
    expect(f.c.result.value).toEqual(result);
    expect(f.c.isStale.value).toBe(false);
    f.c.changes.value[0]!.reason = "更凝练";
    expect(f.c.isStale.value).toBe(true);
    expect(first.workspaceContext?.revisionAnalysis?.changes[0]!.reason).toBe(
      ""
    );
    f.c.start();
    expect(f.c.result.value).toEqual(result);
    await nextTick();
    f.c.handleEvent(
      event("agent.error", f.prompt.mock.calls[1]![0], { message: "测试失败" })
    );
    expect(f.c.result.value).toEqual(result);
    expect(f.c.status.value).toBe("error");
    f.c.dispose();
  });
  it("requires another comparison after editing text, and ignores obsolete events after stop/retry", async () => {
    const f = fixture();
    f.c.beforeText.value += "\n新增";
    expect(f.c.canStart.value).toBe(false);
    expect(() => f.c.start()).toThrow("先比较");
    f.c.compare();
    await nextTick();
    f.c.start();
    await nextTick();
    const old = f.prompt.mock.calls[0]![0];
    await f.c.stop();
    expect(f.c.status.value).toBe("stopped");
    f.c.retry();
    await nextTick();
    finish(f, old);
    expect(f.c.status.value).toBe("running");
    finish(f);
    expect(f.c.status.value).toBe("completed");
    expect(f.abort).toHaveBeenCalledOnce();
    f.c.dispose();
  });
  it("fails cleanly for missing structured output and worker restarts", async () => {
    const f = fixture();
    await nextTick();
    f.c.start();
    await nextTick();
    f.c.handleEvent(
      event("agent.message_completed", f.prompt.mock.calls[0]![0])
    );
    expect(f.c.error.value).toContain("新建技能草稿");
    f.c.retry();
    await nextTick();
    f.c.handleEvent({
      type: "system.worker_restarted",
      payload: { worker: "agent" }
    } as SystemEventEnvelope);
    expect(f.c.status.value).toBe("error");
    expect(f.c.error.value).toContain("重启");
    f.c.dispose();
  });
  it("preserves editable drafts on save failure and blocks duplicate saves", async () => {
    const f = fixture();
    await nextTick();
    f.c.start();
    await nextTick();
    finish(f);
    f.c.result.value!.body = "编辑后的技能";
    f.createLibraryEntry.mockRejectedValueOnce(new Error("版本冲突"));
    await expect(f.c.persistSkill(library)).rejects.toThrow("版本冲突");
    expect(f.c.result.value!.body).toBe("编辑后的技能");
    expect(f.c.savedKey.value).toBe("");
    await f.c.persistSkill(library);
    await f.c.persistSkill(library);
    expect(f.createLibraryEntry).toHaveBeenCalledTimes(2);
    expect(f.createLibraryEntry.mock.calls[1]).toEqual([
      {
        domain: "skill",
        libraryId: "skills",
        title: "修改方向",
        content: `---\nname: 修改方向\ndescription: ${result.description}\n---\n\n编辑后的技能`,
        baseProjectRevision: 3
      }
    ]);
    await expect(
      f.c.persistSkill({ ...library, isBuiltin: true })
    ).rejects.toThrow("非内置");
    f.c.result.value!.description = "用于修订时检查人物动作与情绪表达。";
    expect(f.c.savedKey.value).not.toBe(f.c.skillKey());
    await f.c.persistSkill(library);
    expect(f.createLibraryEntry).toHaveBeenCalledTimes(3);
    expect(f.createLibraryEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: `---\nname: 修改方向\ndescription: ${f.c.result.value!.description}\n---\n\n编辑后的技能`
      })
    );
    f.c.dispose();
  });
  it("updates existing skill metadata without duplicating its header or changing the draft", async () => {
    const f = fixture();
    const body =
      "---\nname: 旧标题\ndescription: 旧描述\n---\n\n# 执行规则\n保持事实。";
    f.c.result.value = {
      ...result,
      body,
      description: "适用于修订。\n保留事实。"
    };
    await f.c.persistSkill(library);
    expect(f.createLibraryEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        content:
          "---\nname: 修改方向\ndescription: 适用于修订。 保留事实。\n---\n\n# 执行规则\n保持事实。"
      })
    );
    expect(f.c.result.value.body).toBe(body);
    f.c.dispose();
  });
  it("does not save incomplete descriptions or malformed skill headers", async () => {
    const f = fixture();
    f.c.result.value = { ...result, description: " " };
    await expect(f.c.persistSkill(library)).rejects.toThrow();
    f.c.result.value = { ...result, body: "---\nname: 未闭合头部" };
    await expect(f.c.persistSkill(library)).rejects.toThrow("结束分隔符");
    expect(f.createLibraryEntry).not.toHaveBeenCalled();
    expect(f.c.saving.value).toBe(false);
    expect(f.c.savedKey.value).toBe("");
    f.c.dispose();
  });
  it("loads, saves and restores the method without persisting source documents", async () => {
    const f = fixture();
    await f.c.loadSettings();
    f.c.systemPrompt.value = "只分析对白";
    await f.c.saveSettings();
    expect(f.c.systemPrompt.value).toBe("只分析对白");
    await f.c.saveSettings(true);
    expect(f.c.systemPrompt.value).toBe(DEFAULT_REVISION_METHOD);
    expect(f.c.beforeText.value).toContain("原句");
    f.c.dispose();
  });
});
