import { computed, ref } from "vue";
import type { ChatAssistantRoleplayConfig } from "@deepwrite/contracts";
import { uiMessage } from "../../ui-feedback";
const SELECTION_KEY = "deepwrite:chat-assistant-roleplay:v1";
function readSelection(): string {
  try {
    return window.localStorage.getItem(SELECTION_KEY) ?? "";
  } catch {
    return "";
  }
}
export function useChatAssistantRoleplays() {
  const roleplays = ref<ChatAssistantRoleplayConfig[]>([]);
  const selectedRoleId = ref(readSelection());
  const selectedRole = computed(() =>
    roleplays.value.find((role) => role.id === selectedRoleId.value)
  );
  function select(id: string): boolean {
    if (!roleplays.value.some((role) => role.id === id)) return false;
    selectedRoleId.value = id;
    try {
      window.localStorage.setItem(SELECTION_KEY, id);
    } catch {
      /* Selection remains usable in memory. */
    }
    return true;
  }
  async function refresh(): Promise<void> {
    const api = window.deepwrite?.chatAssistantRoleplay;
    if (!api) return;
    try {
      roleplays.value = await api.list();
    } catch {
      uiMessage.error("读取人物配置失败，请重新打开聊天后重试");
    }
  }
  async function save(
    config: ChatAssistantRoleplayConfig
  ): Promise<ChatAssistantRoleplayConfig> {
    const api = window.deepwrite?.chatAssistantRoleplay;
    if (!api) throw new Error("桌面桥接尚未就绪，请稍后重试。");
    const saved = await api.save(config);
    roleplays.value = [
      ...roleplays.value.filter((role) => role.id !== saved.id),
      saved
    ];
    return saved;
  }
  void refresh();
  return { roleplays, selectedRoleId, selectedRole, select, save };
}
