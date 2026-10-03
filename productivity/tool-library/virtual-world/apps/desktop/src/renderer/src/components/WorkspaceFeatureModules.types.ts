import type {
  AppLanguage,
  BodyTextFormats,
  AgentTeamCatalogSnapshot,
  CatalogSnapshot,
  GeneralPermissionMode,
  LibraryAgentSettings,
  LongAgentSettings,
  ModelConfig,
  ModelSettings,
  ModelUsageDashboard,
  SkillLibrary,
  TextViewMode,
  WorkspacePaneLayout
} from "@deepwrite/contracts";
import type { SubagentAuthoringController } from "../composables/useSubagentAuthoring";

export interface SettingsFeatureModule {
  kind: "settings";
  initialCategory: string;
  permissionMode: GeneralPermissionMode;
  autoApproveCrossStageOperations: boolean;
  autoSaveEnabled: boolean;
  language: AppLanguage;
  showContextUsage: boolean;
  showInMenuBar: boolean;
  workspacePaneLayout: WorkspacePaneLayout;
  defaultTextViewMode: TextViewMode;
  bodyTextFormats: BodyTextFormats;
  longAgentSettings: LongAgentSettings | null;
  longAgentLoading: boolean;
  longAgentSaving: boolean;
  longAgentError: string | null;
  libraryAgentSettings: LibraryAgentSettings | null;
  libraryAgentLoading: boolean;
  libraryAgentSaving: boolean;
  modelUsageDashboard: ModelUsageDashboard | null;
  modelUsageLoading: boolean;
  modelSettings: ModelSettings | null;
  modelLoading: boolean;
  modelSaving: boolean;
  modelError: string | null;
  modelTestMessage: string | null;
  testingModelId: string | null;
  runtimeAvailable: boolean;
}

export interface AgentTeamFeatureModule {
  kind: "agent-team";
  navigationEpoch: number;
  catalog: AgentTeamCatalogSnapshot | null;
  models: readonly ModelConfig[];
  skills: readonly SkillLibrary[];
  preferredModelId: string | null;
  loading: boolean;
  saving: boolean;
  loadError: string | null;
  runtimeAvailable: boolean;
  authoring: SubagentAuthoringController | null;
}

export interface DirectoryFeatureModule {
  kind: "directory";
  path: string | null;
  loading: boolean;
}

export interface ModelsFeatureModule {
  kind: "models";
  settings: ModelSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  testMessage: string | null;
  testingModelId: string | null;
  alertMessages: readonly string[];
}

export type WorkspaceFeatureModule =
  | {
      kind: "revision-analysis";
      controller:
        | import("../extras/revision-analysis/useRevisionAnalysis").RevisionAnalysisController
        | null;
      models: readonly ModelConfig[];
      catalogSnapshot: CatalogSnapshot | null;
    }
  | SettingsFeatureModule
  | AgentTeamFeatureModule
  | DirectoryFeatureModule
  | ModelsFeatureModule;
