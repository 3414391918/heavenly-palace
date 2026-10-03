import { computed } from "vue";
import type { ShellRuntimePorts } from "./runtimePorts";
import type { FeaturesRuntime } from "./features.types";
import { deferShellAction } from "./deferShellAction";
import { useBookAnalysisFeatures } from "../../composables/useBookAnalysisFeatures";
import { MATERIAL_KIND_ALLOWED_STAGES } from "../../composables/useCatalogLibraryTransactionsCoordinator";
import { useLazySubagentAuthoringController } from "../../composables/useLazyFeatureControllers";
import { useSettingsFeatureCoordinator } from "../../composables/useSettingsFeatureCoordinator";
import { useWorkspaceDialogModuleCoordinator } from "../../composables/useWorkspaceDialogModuleCoordinator";
import { useWorkspaceFeatureHostCoordinator } from "../../composables/useWorkspaceFeatureHostCoordinator";
import { uiMessage } from "../../ui-feedback";
import { MATERIAL_STAGE_LABELS } from "../../data/catalogWorkspace";
import { useCreativeBookCreation } from "../../composables/useCreativeBookCreation";

/** features assembly for the novel and library workspace. */
export function useShellFeatures(ports: ShellRuntimePorts): FeaturesRuntime {
  const {
    revisionAnalysisFeature,
    revisionAnalysisRunning,
    configureAnalysisModels,
    disposeAnalysisFeatures
  } = useBookAnalysisFeatures(() => window.deepwrite);

  const subagentAuthoringFeature = useLazySubagentAuthoringController({
    api: () => window.deepwrite
  });

  const featureHost = useWorkspaceFeatureHostCoordinator({
    api: () => window.deepwrite,
    view: {
      current: ports.state.currentView,
      settingsInitialCategory: ports.state.settingsInitialCategory,
      workspaceMain: ports.state.workspaceMainView,
      activeLongBookId: ports.state.activeLongBookId
    },
    settingsStore: ports.state.settingsStore,
    catalogSnapshot: ports.state.catalogSnapshot,
    features: {
      revisionAnalysis: revisionAnalysisFeature,
      subagentAuthoring: subagentAuthoringFeature
    },
    actions: {
      saveActiveLongEditorBeforeLeaving: () =>
        ports.novel.saveActiveLongEditorBeforeLeaving(),
      newLibraryConversation: () =>
        ports.conversations.newLibraryConversation(),
      newLongConversation: () => ports.conversations.newLongConversation()
    },
    loaders: {
      loadModelSettings: () => loadModelSettings(),
      loadOfficialModels: () => loadOfficialModels(),
      ensureLongAgentSettingsLoaded: () => ensureLongAgentSettingsLoaded(),
      loadAgentTeamSettings: () => loadAgentTeamSettings(),
      loadLibraryAgentSettings: () => loadLibraryAgentSettings(),
      loadCatalogSnapshot: () => ports.editor.loadCatalogSnapshot()
    },
    notifications: uiMessage
  });

  const { isLongWorkspaceActive, activeFeature, workspaceFeatureModule } =
    featureHost;

  const { closeCreateBookDialog, openCreateBookDialog, createCreativeBook } =
    useCreativeBookCreation({
      open: ports.state.createBookDialogOpen,
      pending: () =>
        ports.state.catalogMutationPending.value ||
        ports.state.longMutationPending.value,
      createLong: deferShellAction(() => ports.novelTransactions.createLongBook)
    });

  const workspaceDialogModule = useWorkspaceDialogModuleCoordinator({
    startup: {
      messages: ports.state.startupAlertMessages
    },
    save: {
      conflict: ports.editor.saveConflict,
      submitting: ports.editor.saveConflictSubmitting
    },
    longStructure: {
      characterCreation: ports.state.longCharacterCreate,
      worldbuildingItemCreation: ports.state.longWorldbuildingItemCreate,
      plotPointCreation: ports.state.longPlotPointCreate,
      chapterCardCreation: ports.state.longChapterCardCreate,
      draftDeletion: ports.state.longDraftSectionDelete,
      treeDeletion: ports.state.longTreeItemDelete,
      ledgerCommitDeletion: ports.state.longLedgerCommitDelete,
      volumeCreation: ports.state.longVolumeCreate,
      dialogOpen: ports.state.longStructureDialogOpen,
      agentsMd: ports.state.longStructureAgentsMd,
      agentsMdPending: ports.state.longStructureAgentsMdPending,
      syncBookOptions: computed(
        () => ports.novelTransactions.longWorldbuildingSyncBookOptions.value
      )
    },
    longLifecycle: {
      continuationPreview: ports.state.continuationImportPreview,
      legacyPreview: ports.state.legacySyncPreview,
      legacyResult: ports.state.legacySyncResult,
      mutationPending: ports.state.longMutationPending,
      activeBookSummary: ports.state.activeLongBookSummary,
      activeBookId: ports.state.activeLongBookId,
      workspaceIndex: ports.state.activeLongWorkspaceIndex,
      bindingsMode: ports.state.longBindingsDialogMode,
      bookActionPending: ports.state.longBookActionPending,
      renameTarget: ports.state.longBookRenameDialog,
      removalTarget: ports.state.longBookRemovalDialog,
      exportTarget: ports.state.longExportTarget,
      manuscriptExportPending: ports.state.longManuscriptExportPending
    },
    creation: {
      createDialogOpen: ports.state.createBookDialogOpen,
      transferMode: ports.state.bookTransferDialogMode
    },
    library: {
      removalDialog: ports.libraries.libraryRemovalDialog,
      projectDialog: ports.libraries.libraryProjectDialog,
      externalLibraryImportDialog: ports.libraries.externalLibraryImport.dialog,
      entryMove: ports.libraries.pendingLibraryEntryMove,
      groupDialog: ports.libraries.libraryGroupDialog,
      activeGroup: ports.libraries.activeLibraryGroup
    },
    catalog: {
      snapshot: ports.state.catalogSnapshot,
      loading: ports.state.catalogLoading,
      mutationPending: ports.state.catalogMutationPending,
      materialStageOptions(materialKind) {
        return (MATERIAL_KIND_ALLOWED_STAGES[materialKind] ?? []).map(
          (value) => ({
            value,
            label: MATERIAL_STAGE_LABELS[value]
          })
        );
      }
    }
  });

  const {
    loadModelSettings,
    loadAppAlerts,
    closeStartupAlert,
    loadModelUsage,
    loadOfficialModels,
    loadSiteOfficialModels,
    saveOfficialToken,
    clearOfficialToken,
    saveSiteOfficialToken,
    clearSiteOfficialToken,
    refreshSiteOfficialModels,
    setSiteOfficialModelEnabled,
    setOfficialModelEnabled,
    saveModelSettings,
    refreshFreeModels,
    setFreeModelEnabled,
    testModel,
    loadLongAgentSettings,
    ensureLongAgentSettingsLoaded,
    saveLongAgentSettings,
    loadAgentTeamSettings,
    createAgentTeam,
    renameAgentTeam,
    deleteAgentTeam,
    downloadAgentTeam,
    installAgentTeam,
    setAgentTeamEnabled,
    saveAgentTeamSettings,
    loadLibraryAgentSettings,
    saveLibraryAgentSettings,
    resetLibraryAgentSettings
  } = useSettingsFeatureCoordinator({
    api: () => window.deepwrite,
    settingsStore: ports.state.settingsStore,
    notifications: uiMessage,
    onModelsLoaded(settings) {
      configureAnalysisModels(settings.models, settings.defaultModelId);
      ports.conversations.applyModelSettingsToConversations(settings);
    }
  });
  return {
    revisionAnalysisFeature,
    revisionAnalysisRunning,
    disposeAnalysisFeatures,
    subagentAuthoringFeature,
    featureHost,
    isLongWorkspaceActive,
    activeFeature,
    workspaceFeatureModule,
    closeCreateBookDialog,
    openCreateBookDialog,
    createCreativeBook,
    workspaceDialogModule,
    loadModelSettings,
    loadAppAlerts,
    closeStartupAlert,
    loadModelUsage,
    loadOfficialModels,
    loadSiteOfficialModels,
    saveOfficialToken,
    clearOfficialToken,
    saveSiteOfficialToken,
    clearSiteOfficialToken,
    refreshSiteOfficialModels,
    setSiteOfficialModelEnabled,
    setOfficialModelEnabled,
    saveModelSettings,
    refreshFreeModels,
    setFreeModelEnabled,
    testModel,
    loadLongAgentSettings,
    ensureLongAgentSettingsLoaded,
    saveLongAgentSettings,
    loadAgentTeamSettings,
    createAgentTeam,
    renameAgentTeam,
    deleteAgentTeam,
    downloadAgentTeam,
    installAgentTeam,
    setAgentTeamEnabled,
    saveAgentTeamSettings,
    saveLibraryAgentSettings,
    resetLibraryAgentSettings
  };
}
