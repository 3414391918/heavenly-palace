<script setup lang="ts">
import type {
  AgentTeamProfileCreateInput,
  AgentTeamProfileRenameInput,
  AgentTeamProfileSaveInput,
  AgentTeamProfileSetEnabledInput,
  AgentTeamProfileTargetInput,
  AppLanguage,
  BodyTextFormatChange,
  GeneralPermissionMode,
  LibraryAgentDomain,
  LibraryAgentSettingsInput,
  LongAgentSettingsInput,
  ModelConfigInput,
  ModelSettingsInput,
  ModelUsageQueryInput,
  TextViewMode,
  WorkspacePaneLayout
} from "@deepwrite/contracts";
import {
  AgentTeamCatalogFeature,
  RevisionAnalysisPage,
  ModelSettingsFeature,
  SettingsPage,
  WorkspaceDirectoryFeature
} from "./lazyAppComponents";
import type { WorkspaceFeatureModule } from "./WorkspaceFeatureModules.types";
import WorkspaceFeatureFrame from "./WorkspaceFeatureFrame.vue";
import {
  generateWorkspaceFeatureSubagent,
  resetWorkspaceFeatureSubagent,
  stopWorkspaceFeatureSubagent
} from "./workspaceFeatureModuleAuthoring";

defineProps<{
  module: WorkspaceFeatureModule;
  leftCollapsed: boolean;
}>();

const emit = defineEmits<{
  expandLeft: [];
  back: [];
  updatePermissionMode: [mode: GeneralPermissionMode];
  updateAutoApproveCrossStageOperations: [enabled: boolean];
  updateAutoSave: [enabled: boolean];
  updateLanguage: [language: AppLanguage];
  updateShowContextUsage: [enabled: boolean];
  updateShowInMenuBar: [enabled: boolean];
  updateUseNetworkProxy: [enabled: boolean];
  updateWorkspacePaneLayout: [layout: WorkspacePaneLayout];
  updateDefaultTextViewMode: [mode: TextViewMode];
  updateBodyTextFormat: [change: BodyTextFormatChange];
  retryLongAgents: [];
  saveLongAgents: [settings: LongAgentSettingsInput];
  saveLibraryAgents: [settings: LibraryAgentSettingsInput];
  resetLibraryAgent: [domain: LibraryAgentDomain];
  loadModelUsage: [input?: ModelUsageQueryInput];
  loadModels: [];
  saveModels: [settings: ModelSettingsInput];
  testModel: [model: ModelConfigInput];
  loadOfficialModels: [];
  loadSiteOfficialModels: [];
  saveOfficialToken: [apiKey: string];
  clearOfficialToken: [];
  saveSiteOfficialToken: [apiKey: string];
  clearSiteOfficialToken: [];
  refreshSiteOfficialModels: [];
  setSiteOfficialModelEnabled: [modelId: string, enabled: boolean];
  setOfficialModelEnabled: [modelId: string, enabled: boolean];
  setFreeModelEnabled: [modelId: string, enabled: boolean];
  retryAgentTeam: [];
  createAgentTeam: [input: AgentTeamProfileCreateInput];
  renameAgentTeam: [input: AgentTeamProfileRenameInput];
  deleteAgentTeam: [input: AgentTeamProfileTargetInput];
  downloadAgentTeam: [input: AgentTeamProfileTargetInput];
  installAgentTeam: [];
  setAgentTeamEnabled: [input: AgentTeamProfileSetEnabledInput];
  saveAgentTeam: [input: AgentTeamProfileSaveInput];
  chooseWorkspaceDirectory: [];
  refreshFreeModels: [];
  openOfficialModels: [];
  refreshCatalog: [];
}>();
</script>

<template>
  <SettingsPage
    v-if="module.kind === 'settings'"
    :initial-category="module.initialCategory"
    :permission-mode="module.permissionMode"
    :auto-approve-cross-stage-operations="
      module.autoApproveCrossStageOperations
    "
    :auto-save-enabled="module.autoSaveEnabled"
    :language="module.language"
    :show-context-usage="module.showContextUsage"
    :show-in-menu-bar="module.showInMenuBar"
    :workspace-pane-layout="module.workspacePaneLayout"
    :default-text-view-mode="module.defaultTextViewMode"
    :body-text-formats="module.bodyTextFormats"
    :long-agent-settings="module.longAgentSettings"
    :long-agent-loading="module.longAgentLoading"
    :long-agent-saving="module.longAgentSaving"
    :long-agent-error="module.longAgentError"
    :library-agent-settings="module.libraryAgentSettings"
    :library-agent-loading="module.libraryAgentLoading"
    :library-agent-saving="module.libraryAgentSaving"
    :model-usage-dashboard="module.modelUsageDashboard"
    :model-usage-loading="module.modelUsageLoading"
    :model-settings="module.modelSettings"
    :model-loading="module.modelLoading"
    :model-saving="module.modelSaving"
    :model-error="module.modelError"
    :model-test-message="module.modelTestMessage"
    :testing-model-id="module.testingModelId"
    :runtime-available="module.runtimeAvailable"
    @back="emit('back')"
    @update-permission-mode="emit('updatePermissionMode', $event)"
    @update-auto-approve-cross-stage-operations="
      emit('updateAutoApproveCrossStageOperations', $event)
    "
    @update-auto-save="emit('updateAutoSave', $event)"
    @update-language="emit('updateLanguage', $event)"
    @update-show-context-usage="emit('updateShowContextUsage', $event)"
    @update-show-in-menu-bar="emit('updateShowInMenuBar', $event)"
    @update-workspace-pane-layout="emit('updateWorkspacePaneLayout', $event)"
    @update-default-text-view-mode="emit('updateDefaultTextViewMode', $event)"
    @update-body-text-format="emit('updateBodyTextFormat', $event)"
    @retry-long-agents="emit('retryLongAgents')"
    @save-long-agents="emit('saveLongAgents', $event)"
    @save-library-agents="emit('saveLibraryAgents', $event)"
    @reset-library-agent="emit('resetLibraryAgent', $event)"
    @load-model-usage="emit('loadModelUsage', $event)"
    @load-models="emit('loadModels')"
    @save-models="emit('saveModels', $event)"
    @test-model="emit('testModel', $event)"
  />

  <WorkspaceFeatureFrame
    v-else-if="module.kind === 'agent-team'"
    class="agent-team-main-view"
    :left-collapsed="leftCollapsed"
    expand-button-class="agent-team-expand-sidebar"
    label="子智能体团队"
    @expand-left="emit('expandLeft')"
  >
    <AgentTeamCatalogFeature
      v-if="module.authoring"
      :catalog="module.catalog"
      :navigation-epoch="module.navigationEpoch"
      :models="module.models"
      :skills="module.skills"
      :preferred-model-id="module.preferredModelId"
      :loading="module.loading"
      :saving="module.saving"
      :load-error="module.loadError"
      :runtime-available="module.runtimeAvailable"
      :authoring-generating="module.authoring.isBusy.value"
      :authoring-draft="module.authoring.draft.value"
      :authoring-status-text="module.authoring.statusText.value"
      :authoring-error="module.authoring.error.value"
      @retry="emit('retryAgentTeam')"
      @create="emit('createAgentTeam', $event)"
      @rename="emit('renameAgentTeam', $event)"
      @delete="emit('deleteAgentTeam', $event)"
      @download="emit('downloadAgentTeam', $event)"
      @install="emit('installAgentTeam')"
      @set-enabled="emit('setAgentTeamEnabled', $event)"
      @save="emit('saveAgentTeam', $event)"
      @authoring-generate="generateWorkspaceFeatureSubagent(module, $event)"
      @authoring-stop="stopWorkspaceFeatureSubagent(module)"
      @authoring-reset="resetWorkspaceFeatureSubagent(module)"
    />
  </WorkspaceFeatureFrame>

  <WorkspaceFeatureFrame
    v-else-if="module.kind === 'directory'"
    class="workspace-settings-main-view"
    :left-collapsed="leftCollapsed"
    expand-button-class="workspace-settings-expand-sidebar"
    label="工作目录"
    @expand-left="emit('expandLeft')"
  >
    <WorkspaceDirectoryFeature
      :path="module.path"
      :loading="module.loading"
      @choose="emit('chooseWorkspaceDirectory')"
    />
  </WorkspaceFeatureFrame>

  <WorkspaceFeatureFrame
    v-else-if="module.kind === 'models'"
    class="workspace-settings-main-view"
    :left-collapsed="leftCollapsed"
    expand-button-class="workspace-settings-expand-sidebar"
    label="自定义模型配置"
    @expand-left="emit('expandLeft')"
  >
    <ModelSettingsFeature
      active
      :model-settings="module.settings"
      :model-loading="module.loading"
      :model-saving="module.saving"
      :model-error="module.error"
      :model-test-message="module.testMessage"
      :testing-model-id="module.testingModelId"
      :model-alert-messages="module.alertMessages"
      @save-models="emit('saveModels', $event)"
      @test-model="emit('testModel', $event)"
      @open-official-models="emit('openOfficialModels')"
    />
  </WorkspaceFeatureFrame>

  <WorkspaceFeatureFrame
    v-else-if="module.kind === 'revision-analysis'"
    class="revision-analysis-main-view"
    :left-collapsed="leftCollapsed"
    expand-button-class="revision-analysis-expand-sidebar"
    label="修改分析"
    @expand-left="emit('expandLeft')"
  >
    <RevisionAnalysisPage
      v-if="module.controller"
      :controller="module.controller"
      :models="module.models"
      :catalog-snapshot="module.catalogSnapshot"
      @refresh-catalog="emit('refreshCatalog')"
    />
  </WorkspaceFeatureFrame>
</template>
