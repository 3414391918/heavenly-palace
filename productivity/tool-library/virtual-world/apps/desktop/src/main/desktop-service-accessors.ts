import type { createDesktopServices } from "./desktop-services";
import type { ModelConfigStore } from "./model-config-store";
import type { ModelUsageStore } from "./model-usage-store";
import type { ChatAssistantProjectConfigStore } from "./chat-assistant-project-config-store";
import type { RevisionAnalysisConfigStore } from "./extras/revision-analysis/config-store";
import type { AgentTeamConfigStore } from "./agent-team-config-store";
import type { LibraryAgentConfigStore } from "./library-agent-config-store";
import type { LongAgentConfigStore } from "./long-agent-config-store";
import type { WorkspaceDirectoryStore } from "./workspace-directory-store";
import type { AppearanceService } from "./appearance-service";
import type { GeneralSettingsStore } from "./general-settings-store";
type DesktopServices = ReturnType<typeof createDesktopServices>;
export function createDesktopServiceAccessors(
  getServices: () => Partial<DesktopServices>
) {
  function requireModelConfigStore(): ModelConfigStore {
    const modelConfigStore = getServices().modelConfigStore;
    if (!modelConfigStore) {
      throw new Error("模型配置存储尚未初始化。");
    }
    return modelConfigStore;
  }
  function requireModelUsageStore(): ModelUsageStore {
    const modelUsageStore = getServices().modelUsageStore;
    if (!modelUsageStore) {
      throw new Error("模型用量存储尚未初始化。");
    }
    return modelUsageStore;
  }
  function requireChatAssistantProjectConfigStore(): ChatAssistantProjectConfigStore {
    const chatAssistantProjectConfigStore =
      getServices().chatAssistantProjectConfigStore;
    if (!chatAssistantProjectConfigStore) {
      throw new Error("聊天助手项目配置存储尚未初始化。");
    }
    return chatAssistantProjectConfigStore;
  }
  function requireRevisionAnalysisConfigStore(): RevisionAnalysisConfigStore {
    const revisionAnalysisConfigStore =
      getServices().revisionAnalysisConfigStore;
    if (!revisionAnalysisConfigStore)
      throw new Error("修改分析设置存储尚未初始化。");
    return revisionAnalysisConfigStore;
  }
  function requireAgentTeamConfigStore(): AgentTeamConfigStore {
    const agentTeamConfigStore = getServices().agentTeamConfigStore;
    if (!agentTeamConfigStore) {
      throw new Error("智能体团队设置存储尚未初始化。");
    }
    return agentTeamConfigStore;
  }
  function requireLibraryAgentConfigStore(): LibraryAgentConfigStore {
    const libraryAgentConfigStore = getServices().libraryAgentConfigStore;
    if (!libraryAgentConfigStore) {
      throw new Error("资料库智能体设置存储尚未初始化。");
    }
    return libraryAgentConfigStore;
  }
  function requireLongAgentConfigStore(): LongAgentConfigStore {
    const longAgentConfigStore = getServices().longAgentConfigStore;
    if (!longAgentConfigStore) {
      throw new Error("创作智能体设置存储尚未初始化。");
    }
    return longAgentConfigStore;
  }
  function requireWorkspaceDirectoryStore(): WorkspaceDirectoryStore {
    const workspaceDirectoryStore = getServices().workspaceDirectoryStore;
    if (!workspaceDirectoryStore) {
      throw new Error("工作目录配置存储尚未初始化。");
    }
    return workspaceDirectoryStore;
  }
  function requireAppearanceService(): AppearanceService {
    const appearanceService = getServices().appearanceService;
    if (!appearanceService) {
      throw new Error("外观设置服务尚未初始化。");
    }
    return appearanceService;
  }
  function requireGeneralSettingsStore(): GeneralSettingsStore {
    const generalSettingsStore = getServices().generalSettingsStore;
    if (!generalSettingsStore) {
      throw new Error("常规设置存储尚未初始化。");
    }
    return generalSettingsStore;
  }
  return {
    requireModelConfigStore,
    requireModelUsageStore,
    requireChatAssistantProjectConfigStore,
    requireRevisionAnalysisConfigStore,
    requireAgentTeamConfigStore,
    requireLibraryAgentConfigStore,
    requireLongAgentConfigStore,
    requireWorkspaceDirectoryStore,
    requireAppearanceService,
    requireGeneralSettingsStore
  };
}
