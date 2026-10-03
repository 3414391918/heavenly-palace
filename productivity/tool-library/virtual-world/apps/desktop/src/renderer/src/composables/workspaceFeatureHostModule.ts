import type { WorkspaceFeatureModule } from "../components/WorkspaceFeatureModules.types";
import type {
  ActiveFeature,
  WorkspaceFeatureHostCoordinatorOptions
} from "./workspaceFeatureHostTypes";
import type { buildSettingsFeatureModule } from "./settingsFeatureModule";
import { selectableModelSettings } from "../utils/selectableModelSettings";

export function buildWorkspaceFeatureModule(
  feature: ActiveFeature,
  options: WorkspaceFeatureHostCoordinatorOptions,
  agentTeamNavigationEpoch: number,
  buildSettingsModule?: typeof buildSettingsFeatureModule
): WorkspaceFeatureModule | null {
  const { settingsStore } = options;
  const modelSelectionSettings = settingsStore.modelSettings
    ? selectableModelSettings(settingsStore.modelSettings)
    : null;
  switch (feature) {
    case "settings":
      return buildSettingsModule?.(options) ?? null;
    case "agent-team":
      return {
        kind: "agent-team",
        navigationEpoch: agentTeamNavigationEpoch,
        catalog: settingsStore.agentTeamCatalog,
        models: modelSelectionSettings?.models ?? [],
        skills: options.catalogSnapshot.value?.skills ?? [],
        preferredModelId: modelSelectionSettings?.defaultModelId ?? null,
        loading: settingsStore.agentTeamLoading,
        saving: settingsStore.agentTeamSaving,
        loadError: settingsStore.agentTeamLoadError,
        runtimeAvailable: Boolean(options.api()),
        authoring: options.features.subagentAuthoring.controller.value
      };
    case "directory":
      return {
        kind: "directory",
        path: settingsStore.workspaceDirectoryPath,
        loading: settingsStore.workspaceDirectoryLoading
      };
    case "models":
      return {
        kind: "models",
        settings: settingsStore.modelSettings,
        loading: settingsStore.modelLoading,
        saving: settingsStore.modelSaving,
        error: settingsStore.modelError,
        testMessage: settingsStore.modelTestMessage,
        testingModelId: settingsStore.testingModelId,
        alertMessages: settingsStore.modelAlertMessages
      };
    case "revision-analysis":
      return {
        kind: "revision-analysis",
        controller: options.features.revisionAnalysis.controller.value ?? null,
        models: modelSelectionSettings?.models ?? [],
        catalogSnapshot: options.catalogSnapshot.value
      };
    case "conversation":
    case "long-workspace":
      return null;
  }
}
