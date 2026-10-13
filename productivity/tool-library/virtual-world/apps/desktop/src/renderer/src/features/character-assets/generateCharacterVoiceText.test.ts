import { afterEach, describe, expect, it, vi } from "vitest";
import type { SystemEventEnvelope } from "@deepwrite/contracts";
import {
  buildCharacterVoiceMessage,
  generateCharacterVoiceText
} from "./generateCharacterVoiceText";

const profile = {
  name: "星离",
  keywords: "少主",
  faceDescription: "红瞳",
  settingDescription: "谨慎",
  relationships: "与阿青结盟",
  currentState: "已经受伤",
  history: "昨夜获救"
};

describe("buildCharacterVoiceMessage", () => {
  it("passes relationships and continuity but no appearance", () => {
    const message = buildCharacterVoiceMessage(profile);
    expect(message).toContain("人物关系：与阿青结盟");
    expect(message).toContain("当前状态：已经受伤");
    expect(message).toContain("历史轨迹：昨夜获救");
    expect(message).not.toContain("形象：");
  });

  it("keeps complete relationships and continuity", () => {
    const relationships = "关".repeat(4_000);
    const currentState = "现".repeat(4_000);
    const history = "史".repeat(4_000);
    const message = buildCharacterVoiceMessage({
      ...profile,
      relationships,
      currentState,
      history
    });
    expect(message).toContain(`人物关系：${relationships}\n`);
    expect(message).toContain(`当前状态：${currentState}\n`);
    expect(message).toContain(`历史轨迹：${history}`);
    expect(message).not.toContain("后文省略");
  });
});

describe("generateCharacterVoiceText", () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    let listener: (event: SystemEventEnvelope) => void = () => undefined;
    const unsubscribe = vi.fn();
    const abort = vi.fn(async () => ({}));
    vi.stubGlobal("window", {
      deepwrite: {
        events: {
          subscribe: vi.fn((next: typeof listener) => {
            listener = next;
            return unsubscribe;
          })
        },
        session: { prompt: vi.fn(async () => ({})), abort }
      }
    });
    const send = (type: string, payload: Record<string, unknown>) => {
      const prompt = vi.mocked(window.deepwrite!.session.prompt);
      const sessionId = prompt.mock.calls[0]?.[0].sessionId;
      listener({
        type,
        payload: { sessionId, runId: "run-1", ...payload }
      } as SystemEventEnvelope);
    };
    return { abort, send, unsubscribe };
  }

  it("stops a model run that requests input instead of leaving the dialog waiting", async () => {
    const { send, abort, unsubscribe } = setup();
    const result = generateCharacterVoiceText(profile);
    send("agent.user_input_requested", { requestId: "question-1" });
    await expect(result).rejects.toThrow("需要补充输入");
    expect(abort).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1" })
    );
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("reports streamed thinking and answer content only when the model sends them", async () => {
    const { send } = setup();
    const progress = vi.fn();
    const result = generateCharacterVoiceText(profile, progress);
    send("agent.thinking_delta", { delta: "核对设定" });
    send("agent.message_delta", { delta: "柔和嗓音" });
    send("agent.message_completed", { content: "柔和嗓音" });
    await expect(result).resolves.toBe("柔和嗓音");
    expect(progress).toHaveBeenCalledWith({
      kind: "thinking",
      text: "核对设定"
    });
    expect(progress).toHaveBeenCalledWith({
      kind: "content",
      text: "柔和嗓音"
    });
  });

  it("does not time out a model run while waiting for a result", async () => {
    const { abort, send } = setup();
    vi.useFakeTimers();
    try {
      const result = generateCharacterVoiceText(profile);
      const assertion = expect(result).resolves.toBe("温和的声音");
      await vi.advanceTimersByTimeAsync(360_000);
      expect(abort).not.toHaveBeenCalled();
      send("agent.message_completed", { content: "温和的声音" });
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts the model request when the user cancels", async () => {
    const { abort, send, unsubscribe } = setup();
    const controller = new AbortController();
    const result = generateCharacterVoiceText(
      profile,
      undefined,
      controller.signal
    );
    await Promise.resolve();
    send("agent.thinking_delta", { delta: "核对设定" });
    controller.abort();
    await expect(result).rejects.toThrow("已取消");
    expect(abort).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1" })
    );
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
