import { AgentTeamConfigStore } from "./agent-team-config-store";
import { AppAlertStore } from "./app-alert-store";
import { AppearanceService } from "./appearance-service";
import { ChatAssistantProjectConfigStore } from "./chat-assistant-project-config-store";
import { RevisionAnalysisConfigStore } from "./extras/revision-analysis/config-store";
import { GeneralSettingsStore } from "./general-settings-store";
import { LibraryAgentConfigStore } from "./library-agent-config-store";
import { LongAgentConfigStore } from "./long-agent-config-store";
import { ModelConfigStore } from "./model-config-store";
import { ModelUsageStore } from "./model-usage-store";
import { SoftwareTokenUsageReporter } from "./software-token-usage-reporter";
import type { StartupLog } from "./startup-log";
import { UpdateService } from "./update-service";
import { WorkspaceDirectoryStore } from "./workspace-directory-store";
interface DesktopServiceOptions {
  userDataPath: string;
  appVersion: string;
  installUpdate: () => void;
}
/** Construction has no network dependency; optional refreshes start separately. */
export function createDesktopServices(options: DesktopServiceOptions) {
  const { userDataPath } = options;
  const modelConfigStore = new ModelConfigStore(userDataPath, {
    appVersion: options.appVersion
  });
  const modelUsageStore = new ModelUsageStore(userDataPath);
  const workspaceDirectoryStore = new WorkspaceDirectoryStore(userDataPath);
  return {
    modelConfigStore,
    modelUsageStore,
    softwareTokenUsageReporter: new SoftwareTokenUsageReporter(
      userDataPath,
      modelUsageStore
    ),
    agentTeamConfigStore: new AgentTeamConfigStore(userDataPath),
    libraryAgentConfigStore: new LibraryAgentConfigStore(userDataPath),
    longAgentConfigStore: new LongAgentConfigStore(userDataPath),
    revisionAnalysisConfigStore: new RevisionAnalysisConfigStore(userDataPath),
    workspaceDirectoryStore,
    appearanceService: new AppearanceService(userDataPath),
    generalSettingsStore: new GeneralSettingsStore(userDataPath),
    chatAssistantProjectConfigStore: new ChatAssistantProjectConfigStore(
      userDataPath
    ),
    updateService: new UpdateService(options.installUpdate),
    appAlertStore: new AppAlertStore(userDataPath)
  };
}
export function refreshDesktopServices(
  services: ReturnType<typeof createDesktopServices>,
  log: StartupLog
): void {
  void services.softwareTokenUsageReporter
    .reportAtStartup()
    .catch((error: unknown) => {
      log.write("usage-report.failed", { error });
    });
  void services.modelConfigStore.initialize().catch((error: unknown) => {
    log.write("model-config.failed", { error });
  });
  void services.modelConfigStore
    .list()
    .then((settings) =>
      services.modelUsageStore.syncConfiguredModels(settings.models)
    )
    .catch((error: unknown) => {
      log.write("model-usage.failed", { error });
    });
}
