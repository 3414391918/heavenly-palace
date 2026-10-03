import type { SettingsFeatureModule } from "../components/WorkspaceFeatureModules.types";
import type { WorkspaceFeatureHostCoordinatorOptions } from "./workspaceFeatureHostTypes";

export function buildSettingsFeatureModule(
  options: WorkspaceFeatureHostCoordinatorOptions
): SettingsFeatureModule {
  const { settingsStore } = options;
  return {
    kind: "settings",
    initialCategory: options.view.settingsInitialCategory.value,
    permissionMode: settingsStore.generalSettings.permissionMode,
    autoApproveCrossStageOperations:
      settingsStore.generalSettings.autoApproveCrossStageOperations,
    autoSaveEnabled: settingsStore.editorAutoSaveEnabled,
    language: settingsStore.generalSettings.language,
    showContextUsage: settingsStore.generalSettings.showContextUsage,
    showInMenuBar: settingsStore.generalSettings.showInMenuBar,
    workspacePaneLayout: settingsStore.generalSettings.workspacePaneLayout,
    defaultTextViewMode: settingsStore.generalSettings.defaultTextViewMode,
    bodyTextFormats: settingsStore.generalSettings.bodyTextFormats,
    longAgentSettings: settingsStore.longAgentSettings,
    longAgentLoading: settingsStore.longAgentLoading,
    longAgentSaving: settingsStore.longAgentSaving,
    longAgentError: settingsStore.longAgentLoadError,
    libraryAgentSettings: settingsStore.libraryAgentSettings,
    libraryAgentLoading: settingsStore.libraryAgentLoading,
    libraryAgentSaving: settingsStore.libraryAgentSaving,
    modelUsageDashboard: settingsStore.modelUsageDashboard,
    modelUsageLoading: settingsStore.modelUsageLoading,
    modelSettings: settingsStore.modelSettings,
    modelLoading: settingsStore.modelLoading,
    modelSaving: settingsStore.modelSaving,
    modelError: settingsStore.modelError,
    modelTestMessage: settingsStore.modelTestMessage,
    testingModelId: settingsStore.testingModelId,
    runtimeAvailable: Boolean(options.api())
  };
}
