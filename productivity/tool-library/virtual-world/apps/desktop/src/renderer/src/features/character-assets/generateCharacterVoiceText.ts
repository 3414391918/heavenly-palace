import { createId } from "@deepwrite/shared";

export interface CharacterVoiceProfile {
  name: string;
  keywords: string;
  faceDescription: string;
  settingDescription: string;
  relationships: string;
  currentState: string;
  history: string;
}

export interface CharacterVoiceGenerationProgress {
  kind: "thinking" | "content" | "retry";
  text: string;
}

function compact(value: string, maximum: number): string {
  const characters = Array.from(value.trim());
  return characters.length > maximum
    ? `${characters.slice(0, maximum).join("")}…（后文省略）`
    : characters.join("");
}

export function buildCharacterVoiceMessage(
  profile: CharacterVoiceProfile
): string {
  const context = [
    `角色名称：${compact(profile.name, 128)}`,
    `关键词：${compact(profile.keywords, 500)}`,
    `脸部身材：${compact(profile.faceDescription, 1_500)}`,
    `角色设定：${compact(profile.settingDescription, 2_500)}`,
    `人物关系：${profile.relationships.trim() || "暂无记录"}`,
    `当前状态：${profile.currentState.trim() || "暂无已提交记录"}`,
    `历史轨迹：${profile.history.trim() || "暂无已提交记录"}`
  ].join("\n");
  const instruction =
    "请为这个小说角色设计中文声音，输出一段不超过 1800 字的声音生成提示词，明确年龄感、性别表现、口音、音色、语气、节奏和情绪变化。不要加标题、解释或 Markdown。不要凭空增加与设定冲突的事实。";
  return `${instruction}\n\n${context}`;
}

export async function generateCharacterVoiceText(
  profile: CharacterVoiceProfile,
  onProgress?: (progress: CharacterVoiceGenerationProgress) => void,
  signal?: AbortSignal
): Promise<string> {
  const sessionId = createId("character_voice_session");
  const message = buildCharacterVoiceMessage(profile);
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let streamedThinking = false;
    let streamedContent = false;
    let runId = "";
    let cancelled = false;
    const abortRun = () => {
      if (!runId) return;
      void window
        .deepwrite!.session.abort({ sessionId, runId })
        .catch(() => undefined);
    };
    const finish = (value?: string, error?: Error) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve(value?.trim() ?? "");
    };
    const unsubscribe = window.deepwrite!.events.subscribe((event) => {
      if (
        !("payload" in event) ||
        !event.payload ||
        !("sessionId" in event.payload) ||
        event.payload.sessionId !== sessionId
      )
        return;
      if ("runId" in event.payload && typeof event.payload.runId === "string")
        runId = event.payload.runId;
      if (event.type === "agent.message_completed") {
        if (!streamedThinking && event.payload.thinking)
          onProgress?.({ kind: "thinking", text: event.payload.thinking });
        if (!streamedContent && event.payload.content)
          onProgress?.({ kind: "content", text: event.payload.content });
        if (!event.payload.content.trim())
          finish(undefined, new Error("智能体没有生成内容，请重试。"));
        else finish(event.payload.content);
      } else if (event.type === "agent.thinking_delta") {
        streamedThinking = true;
        onProgress?.({ kind: "thinking", text: event.payload.delta });
      } else if (event.type === "agent.message_delta") {
        streamedContent = true;
        onProgress?.({ kind: "content", text: event.payload.delta });
      } else if (event.type === "agent.retry_scheduled") {
        onProgress?.({ kind: "retry", text: event.payload.reason });
      } else if (event.type === "agent.user_input_requested") {
        finish(
          undefined,
          new Error(
            "模型需要补充输入，当前流程无法代答。请调整角色资料或特殊说明后重试。"
          )
        );
        abortRun();
      } else if (event.type === "agent.error") {
        finish(
          undefined,
          new Error(event.payload.message || "智能体生成失败。")
        );
      }
    });
    const onAbort = () => {
      cancelled = true;
      finish(undefined, new DOMException("任务已取消", "AbortError"));
      abortRun();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    void window
      .deepwrite!.session.prompt({ sessionId, message })
      .then((accepted) => {
        runId = accepted.runId;
        if (cancelled) abortRun();
      })
      .catch((error: unknown) => {
        finish(
          undefined,
          error instanceof Error ? error : new Error("智能体启动失败。")
        );
      });
  });
}
