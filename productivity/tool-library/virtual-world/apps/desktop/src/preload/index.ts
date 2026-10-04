import {
  SystemHealthPayloadSchema,
  UPDATE_STATE_EVENT_CHANNEL,
  UpdateStateSchema,
  createEnvelope,
  type DeepWriteApi,
  type SystemHealthPayload,
  type UpdateState
} from "@deepwrite/contracts";
import { contextBridge, ipcRenderer } from "electron";
import {
  createAgentTeam,
  deleteAgentTeam,
  downloadAgentTeam,
  installAgentTeam,
  listAgentTeams,
  renameAgentTeam,
  saveAgentTeams,
  saveBuiltinSubagents,
  setAgentTeamEnabled
} from "./agent-teams-api";
import { analysisApis } from "./analysis-apis";
import {
  acknowledgeDesktopAlert,
  checkForUpdates,
  downloadUpdate,
  getAppAlerts,
  getUpdateState,
  installUpdate
} from "./app-notification-api";
import { appearance } from "./appearance-api";
import {
  createLibrary,
  createLibraryGroup,
  updateLibrary,
  updateLibraryGroup
} from "./catalog-library-api";
import {
  chooseExternalLibraryEntries,
  createLibraryEntry,
  importLibraryEntries,
  moveLibraryEntry,
  removeLibraryEntry,
  saveLibraryEntry
} from "./catalog-library-entry-api";
import {
  deleteProject,
  duplicateProject,
  importLegacyLibrary,
  openProject,
  unregisterProject
} from "./catalog-project-api";
import {
  getCatalogIndex,
  getCatalogSnapshot,
  loadDraftRecovery,
  readCatalogDocument,
  readWritingContext,
  saveDraftRecovery,
  writeWritingContext
} from "./catalog-read-api";
import {
  chatAssistantProjectConfig,
  chatAssistantRoleplay
} from "./chat-assistant-api";
import { conversationExport } from "./conversation-export-api";
import { conversationPersistence } from "./conversation-persistence-api";
import { desktopEvents } from "./desktop-events-api";
import { browserId, invokeCommand } from "./invoke";
import {
  deleteBook,
  saveDocument,
  updateBook
} from "./legacy-catalog-book-api";
import { long } from "./long-api";
import {
  abort,
  prompt,
  queryModelUsage,
  models as sessionModels,
  submitUserInput
} from "./session-models-api";
import {
  chooseWorkspaceDirectory,
  exportLongManuscript,
  listGeneralSettings,
  listLibraryAgents,
  listLongAgents,
  updateLongPromptTemplate,
  listWorkspaceDirectory,
  resetLibraryAgents,
  resetLongAgents,
  saveGeneralSettings,
  saveLibraryAgents,
  saveLongAgents
} from "./settings-api";
import { textContextMenu } from "./text-context-menu-api";
async function getHealth(): Promise<SystemHealthPayload> {
  const id = browserId("cmd_health");
  return SystemHealthPayloadSchema.parse(
    await invokeCommand<SystemHealthPayload>(
      createEnvelope("system.health", {}, { id, correlationId: id })
    )
  );
}
const api: DeepWriteApi = {
  textContextMenu,
  system: {
    health: getHealth
  },
  conversationPersistence,
  conversationExport,
  updates: {
    getState: getUpdateState,
    check: checkForUpdates,
    download: downloadUpdate,
    install: installUpdate,
    subscribe(listener: (state: UpdateState) => void): () => void {
      const handler = (
        _event: Electron.IpcRendererEvent,
        rawState: unknown
      ): void => {
        const parsed = UpdateStateSchema.safeParse(rawState);
        if (!parsed.success) {
          console.warn("DeepWrite discarded an invalid update state event.");
          return;
        }
        listener(parsed.data);
      };
      ipcRenderer.on(UPDATE_STATE_EVENT_CHANNEL, handler);
      return () =>
        ipcRenderer.removeListener(UPDATE_STATE_EVENT_CHANNEL, handler);
    }
  },
  appAlerts: {
    get: getAppAlerts,
    acknowledgeDesktop: acknowledgeDesktopAlert
  },
  catalog: {
    index: getCatalogIndex,
    readDocument: readCatalogDocument,
    readWritingContext,
    writeWritingContext,
    snapshot: getCatalogSnapshot,
    loadDraftRecovery,
    saveDraftRecovery,
    createLibrary,
    updateLibrary,
    createLibraryGroup,
    openProject,
    importLegacyLibrary,
    updateBook,
    updateLibraryGroup,
    deleteBook,
    saveDocument,
    saveLibraryEntry,
    createLibraryEntry,
    chooseExternalLibraryEntries,
    importLibraryEntries,
    removeLibraryEntry,
    moveLibraryEntry,
    unregisterProject,
    deleteProject,
    duplicateProject
  },
  long,
  session: {
    prompt,
    abort,
    submitUserInput
  },
  models: sessionModels,
  modelUsage: {
    query: queryModelUsage
  },
  chatAssistantProjectConfig,
  chatAssistantRoleplay,
  longAgents: {
    list: listLongAgents,
    updatePromptTemplate: updateLongPromptTemplate,
    save: saveLongAgents,
    reset: resetLongAgents
  },
  agentTeams: {
    saveBuiltins: saveBuiltinSubagents,
    list: listAgentTeams,
    create: createAgentTeam,
    rename: renameAgentTeam,
    delete: deleteAgentTeam,
    setEnabled: setAgentTeamEnabled,
    save: saveAgentTeams,
    download: downloadAgentTeam,
    install: installAgentTeam
  },
  libraryAgents: {
    list: listLibraryAgents,
    save: saveLibraryAgents,
    reset: resetLibraryAgents
  },
  ...analysisApis,
  workspaceDirectory: {
    list: listWorkspaceDirectory,
    choose: chooseWorkspaceDirectory
  },
  appearance,
  generalSettings: {
    list: listGeneralSettings,
    save: saveGeneralSettings
  },
  manuscript: {
    exportLong: exportLongManuscript
  },
  ...desktopEvents
};
contextBridge.exposeInMainWorld("deepwrite", api);
