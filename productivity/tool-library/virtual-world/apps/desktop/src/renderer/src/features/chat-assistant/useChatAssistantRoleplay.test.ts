import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useChatAssistantMode } from "./useChatAssistantMode";
import type { AgentConversationController } from "../../composables/useAgentConversation";
import { normalizeChatAssistantRequestContext } from "../../composables/agent-conversation/chat-assistant-request";
afterEach(() => vi.unstubAllGlobals());
describe("roleplay chat selection", () => {
  it("sends only character identity, isolates controllers and restores the selected character", async () => {
    const saved = [
      { id: "a", name: "守望者", systemPrompt: "你是守望者。" },
      { id: "b", name: "旅人", systemPrompt: "你是旅人。" }
    ];
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value)
      },
      deepwrite: {
        chatAssistantRoleplay: {
          list: vi.fn(async () => saved),
          save: vi.fn(async (value) => value)
        }
      }
    });
    const busy = ref(false);
    const send = vi.fn(async () => undefined);
    const conversationForKey = vi.fn(
      () =>
        ({
          isBusy: busy,
          sendAssistantMessage: send
        }) as unknown as AgentConversationController
    );
    const options = {
      conversationForKey,
      catalogSnapshot: ref(null),
      longBooks: ref([])
    };
    const mode = useChatAssistantMode(options);
    await Promise.resolve();
    expect(mode.selectRole("a")).toBe(true);
    expect(conversationForKey).toHaveBeenLastCalledWith(
      "chat-assistant:roleplay:a",
      "assistant-chat:roleplay:a"
    );
    await mode.sendAssistantMessage(true);
    expect(send).toHaveBeenLastCalledWith({ mode: "roleplay", roleId: "a" });
    expect(
      normalizeChatAssistantRequestContext(mode.requestContext.value!)
    ).toEqual({ mode: "roleplay", roleId: "a" });
    busy.value = true;
    expect(mode.selectRole("b")).toBe(false);
    expect(mode.setMode("normal")).toBe(false);
    busy.value = false;
    mode.selectRole("b");
    expect(conversationForKey).toHaveBeenLastCalledWith(
      "chat-assistant:roleplay:b",
      "assistant-chat:roleplay:b"
    );
    const restored = useChatAssistantMode(options);
    await Promise.resolve();
    expect(restored.requestContext.value).toEqual({
      mode: "roleplay",
      roleId: "b"
    });
    restored.setMode("normal");
    expect(conversationForKey).toHaveBeenLastCalledWith(
      "chat-assistant:normal",
      "assistant-chat:normal"
    );
  });
});
