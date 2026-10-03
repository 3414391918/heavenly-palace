import { useBookAnalysisFeatures } from "../../composables/useBookAnalysisFeatures";
import { useLazySubagentAuthoringController } from "../../composables/useLazyFeatureControllers";
import { useSettingsFeatureCoordinator } from "../../composables/useSettingsFeatureCoordinator";
import { useWorkspaceDialogModuleCoordinator } from "../../composables/useWorkspaceDialogModuleCoordinator";
import { useWorkspaceFeatureHostCoordinator } from "../../composables/useWorkspaceFeatureHostCoordinator";
import { useCreativeBookCreation } from "../../composables/useCreativeBookCreation";
export interface FeaturesRuntime {
  revisionAnalysisFeature: ReturnType<
    typeof useBookAnalysisFeatures
  >["revisionAnalysisFeature"];
  revisionAnalysisRunning: ReturnType<
    typeof useBookAnalysisFeatures
  >["revisionAnalysisRunning"];
  disposeAnalysisFeatures: ReturnType<
    typeof useBookAnalysisFeatures
  >["disposeAnalysisFeatures"];
  subagentAuthoringFeature: ReturnType<
    typeof useLazySubagentAuthoringController
  >;
  featureHost: ReturnType<typeof useWorkspaceFeatureHostCoordinator>;
  isLongWorkspaceActive: ReturnType<
    typeof useWorkspaceFeatureHostCoordinator
  >["isLongWorkspaceActive"];
  activeFeature: ReturnType<
    typeof useWorkspaceFeatureHostCoordinator
  >["activeFeature"];
  workspaceFeatureModule: ReturnType<
    typeof useWorkspaceFeatureHostCoordinator
  >["workspaceFeatureModule"];
  closeCreateBookDialog: ReturnType<
    typeof useCreativeBookCreation
  >["closeCreateBookDialog"];
  openCreateBookDialog: ReturnType<
    typeof useCreativeBookCreation
  >["openCreateBookDialog"];
  createCreativeBook: ReturnType<
    typeof useCreativeBookCreation
  >["createCreativeBook"];
  workspaceDialogModule: ReturnType<typeof useWorkspaceDialogModuleCoordinator>;
  loadModelSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["loadModelSettings"];
  loadAppAlerts: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["loadAppAlerts"];
  closeStartupAlert: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["closeStartupAlert"];
  loadModelUsage: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["loadModelUsage"];
  loadOfficialModels: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["loadOfficialModels"];
  loadSiteOfficialModels: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["loadSiteOfficialModels"];
  saveOfficialToken: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["saveOfficialToken"];
  clearOfficialToken: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["clearOfficialToken"];
  saveSiteOfficialToken: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["saveSiteOfficialToken"];
  clearSiteOfficialToken: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["clearSiteOfficialToken"];
  refreshSiteOfficialModels: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["refreshSiteOfficialModels"];
  setSiteOfficialModelEnabled: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["setSiteOfficialModelEnabled"];
  setOfficialModelEnabled: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["setOfficialModelEnabled"];
  saveModelSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["saveModelSettings"];
  refreshFreeModels: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["refreshFreeModels"];
  setFreeModelEnabled: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["setFreeModelEnabled"];
  testModel: ReturnType<typeof useSettingsFeatureCoordinator>["testModel"];
  loadLongAgentSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["loadLongAgentSettings"];
  ensureLongAgentSettingsLoaded: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["ensureLongAgentSettingsLoaded"];
  saveLongAgentSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["saveLongAgentSettings"];
  loadAgentTeamSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["loadAgentTeamSettings"];
  createAgentTeam: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["createAgentTeam"];
  renameAgentTeam: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["renameAgentTeam"];
  deleteAgentTeam: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["deleteAgentTeam"];
  downloadAgentTeam: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["downloadAgentTeam"];
  installAgentTeam: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["installAgentTeam"];
  setAgentTeamEnabled: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["setAgentTeamEnabled"];
  saveAgentTeamSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["saveAgentTeamSettings"];
  saveLibraryAgentSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["saveLibraryAgentSettings"];
  resetLibraryAgentSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["resetLibraryAgentSettings"];
}
