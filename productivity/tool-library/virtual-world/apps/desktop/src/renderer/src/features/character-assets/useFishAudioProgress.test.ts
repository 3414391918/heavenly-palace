import { describe, expect, it } from "vitest";
import { useFishAudioProgress } from "./useFishAudioProgress";

describe("useFishAudioProgress", () => {
  it("tracks model output and platform steps while ignoring unrelated operations", () => {
    const progress = useFishAudioProgress();
    progress.start("model", "生成提示词");
    progress.append("model", "thinking", "核对人物资料");
    progress.append("model", "content", "一段提示词");
    progress.complete("model", "生成完成");
    progress.acceptPlatform("operation-1", {
      operationId: "operation-2",
      stage: "voice.create",
      status: "running"
    });
    expect(progress.nodes.value).toHaveLength(1);
    progress.acceptPlatform("operation-1", {
      operationId: "operation-1",
      stage: "voice.create",
      status: "running"
    });
    progress.acceptPlatform("operation-1", {
      operationId: "operation-1",
      stage: "voice.create",
      status: "completed",
      detail: "声音 ID：test"
    });
    expect(progress.nodes.value).toEqual([
      expect.objectContaining({
        status: "completed",
        thinking: "核对人物资料",
        output: "一段提示词"
      }),
      expect.objectContaining({ status: "completed", detail: "声音 ID：test" })
    ]);
  });

  it("keeps the failed step and its actionable error visible", () => {
    const progress = useFishAudioProgress();
    progress.start("model", "生成提示词");
    progress.fail(new Error("模型需要补充输入"));
    expect(progress.nodes.value[0]).toMatchObject({
      status: "error",
      detail: "模型需要补充输入"
    });
  });

  it("marks the active step cancelled without losing streamed details", () => {
    const progress = useFishAudioProgress();
    progress.start("model", "生成提示词");
    progress.append("model", "thinking", "核对人物资料");
    progress.cancel();
    expect(progress.nodes.value[0]).toMatchObject({
      status: "cancelled",
      detail: "任务已取消",
      thinking: "核对人物资料"
    });
  });
});
