import type { WorkspaceDirectorySettings } from "@deepwrite/contracts";
import { createPinia, setActivePinia } from "pinia";
import { ref, shallowRef } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "../stores/settingsStore";
import { loadSettingsFeature } from "../components/loadSettingsFeature";
import { buildSettingsFeatureModule } from "./settingsFeatureModule";
import type { WorkspaceMainView } from "../stores/layoutStore";
import type { SubagentAuthoringController } from "./useSubagentAuthoring";
import {
  useWorkspaceFeatureHostCoordinator,
  type WorkspaceFeatureHostCoordinatorOptions
} from "./useWorkspaceFeatureHostCoordinator";
vi.mock("../components/loadSettingsFeature", () => ({
  loadSettingsFeature: vi.fn(async () => buildSettingsFeatureModule)
}));
function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
interface HarnessOverrides {
  runtimeAvailable?: boolean;
  saveBeforeLeaving?: () => Promise<boolean>;
  ensureRevisionLoaded?: () => Promise<unknown>;
  ensureAuthoringLoaded?: () => Promise<unknown>;
  loadDirectory?: () => Promise<WorkspaceDirectorySettings>;
  chooseDirectory?: () => Promise<WorkspaceDirectorySettings | null>;
  loaderOverrides?: Partial<WorkspaceFeatureHostCoordinatorOptions["loaders"]>;
}
function createHarness(overrides: HarnessOverrides = {}) {
  setActivePinia(createPinia());
  const currentView = ref<"workspace" | "settings">("workspace"),
    settingsInitialCategory = ref("general"),
    workspaceMainView = ref<WorkspaceMainView>("conversation"),
    activeLongBookId = ref<string | null>(null);
  const settingsStore = useSettingsStore();
  const saveBeforeLeaving = vi.fn(
    overrides.saveBeforeLeaving ?? (async () => true)
  );
  const newLibraryConversation = vi.fn(),
    newLongConversation = vi.fn();
  const ensureRevisionLoaded = vi.fn(
      overrides.ensureRevisionLoaded ?? (async () => undefined)
    ),
    ensureAuthoringLoaded = vi.fn(
      overrides.ensureAuthoringLoaded ?? (async () => undefined)
    );
  const listDirectory = vi.fn(
      overrides.loadDirectory ?? (async () => ({ path: "/workspace-a" }))
    ),
    chooseDirectory = vi.fn(
      overrides.chooseDirectory ?? (async () => ({ path: "/workspace-b" }))
    );
  const api = {
    workspaceDirectory: { list: listDirectory, choose: chooseDirectory }
  };
  let runtimeAvailable = overrides.runtimeAvailable ?? true;
  const loaders = {
    loadModelSettings: vi.fn(async () => undefined),
    loadOfficialModels: vi.fn(async () => undefined),
    ensureLongAgentSettingsLoaded: vi.fn(async () => undefined),
    loadAgentTeamSettings: vi.fn(async () => undefined),
    loadLibraryAgentSettings: vi.fn(async () => undefined),
    loadCatalogSnapshot: vi.fn(async () => undefined),
    ...overrides.loaderOverrides
  };
  const errors: string[] = [],
    successes: string[] = [];
  const authoringController = shallowRef<SubagentAuthoringController | null>(
    null
  );
  const coordinator = useWorkspaceFeatureHostCoordinator({
    api: () => (runtimeAvailable ? api : undefined),
    view: {
      current: currentView,
      settingsInitialCategory,
      workspaceMain: workspaceMainView,
      activeLongBookId
    },
    settingsStore,
    catalogSnapshot: shallowRef(null),
    features: {
      revisionAnalysis: {
        controller: shallowRef(null),
        ensureLoaded: ensureRevisionLoaded
      },
      subagentAuthoring: {
        controller: authoringController,
        ensureLoaded: ensureAuthoringLoaded
      }
    },
    actions: {
      saveActiveLongEditorBeforeLeaving: saveBeforeLeaving,
      newLibraryConversation,
      newLongConversation
    },
    loaders,
    notifications: {
      error: (m) => errors.push(m),
      success: (m) => successes.push(m)
    }
  });
  return {
    coordinator,
    currentView,
    settingsInitialCategory,
    workspaceMainView,
    activeLongBookId,
    settingsStore,
    saveBeforeLeaving,
    newLibraryConversation,
    newLongConversation,
    ensureRevisionLoaded,
    ensureAuthoringLoaded,
    listDirectory,
    chooseDirectory,
    loaders,
    errors,
    successes,
    authoringController,
    setRuntimeAvailable: (value: boolean) => {
      runtimeAvailable = value;
    }
  };
}
describe("useWorkspaceFeatureHostCoordinator", () => {
  it("prioritizes settings, then an open long workspace, then the selected main view", () => {
    const harness = createHarness();

    expect(harness.coordinator.activeFeature.value).toBe("conversation");
    harness.activeLongBookId.value = "long-book";
    expect(harness.coordinator.isLongWorkspaceActive.value).toBe(true);
    expect(harness.coordinator.activeFeature.value).toBe("long-workspace");
    harness.currentView.value = "settings";
    expect(harness.coordinator.activeFeature.value).toBe("settings");
    harness.workspaceMainView.value = "models";
    expect(harness.coordinator.activeFeature.value).toBe("settings");
    harness.currentView.value = "workspace";
    expect(harness.coordinator.activeFeature.value).toBe("models");
  });

  it("projects every feature descriptor and leaves both writing surfaces unwrapped", async () => {
    const harness = createHarness();

    expect(harness.coordinator.workspaceFeatureModule.value).toBeNull();
    harness.activeLongBookId.value = "long-book";
    expect(harness.coordinator.workspaceFeatureModule.value).toBeNull();
    harness.activeLongBookId.value = null;

    const featureKinds = [
      "directory",
      "models",
      "revision-analysis",
      "revision-analysis",
      "agent-team"
    ] as const;
    for (const feature of featureKinds) {
      harness.workspaceMainView.value = feature;
      expect(harness.coordinator.workspaceFeatureModule.value?.kind).toBe(
        feature
      );
    }

    await harness.coordinator.openSettings("appearance");
    const settingsModule = harness.coordinator.workspaceFeatureModule.value;
    expect(settingsModule?.kind).toBe("settings");
    expect(
      settingsModule?.kind === "settings"
        ? settingsModule.initialCategory
        : undefined
    ).toBe("appearance");
  });

  it("opens style comparison through the save guard and loads available models", async () => {
    const harness = createHarness();
    await harness.coordinator.openWorkspaceDialog("revision-analysis");
    expect(harness.saveBeforeLeaving).toHaveBeenCalledOnce();
    expect(harness.loaders.loadModelSettings).toHaveBeenCalledOnce();
    expect(harness.coordinator.workspaceFeatureModule.value).toEqual({
      kind: "revision-analysis",
      models: [],
      controller: null,
      catalogSnapshot: null
    });
    const blocked = createHarness({ saveBeforeLeaving: async () => false });
    await blocked.coordinator.openWorkspaceDialog("revision-analysis");
    expect(blocked.workspaceMainView.value).toBe("conversation");
  });

  it("routes new conversations using the current long-book identity", () => {
    const harness = createHarness();

    harness.coordinator.newConversation();
    harness.activeLongBookId.value = "long-book";
    harness.coordinator.newConversation();

    expect(harness.newLibraryConversation).toHaveBeenCalledOnce();
    expect(harness.newLongConversation).toHaveBeenCalledOnce();
  });

  it("blocks every feature navigation and all dependent loads when saving fails", async () => {
    const harness = createHarness({
      saveBeforeLeaving: async () => false
    });

    await harness.coordinator.openWorkspaceDialog("directory");
    await harness.coordinator.openWorkspaceDialog("models");
    await harness.coordinator.openWorkspaceDialog("revision-analysis");
    await harness.coordinator.openSettings();
    await harness.coordinator.openAgentTeams();
    await harness.coordinator.openWorkspaceDialog("models");
    await harness.coordinator.openWorkspaceDialog("models");

    expect(harness.currentView.value).toBe("workspace");
    expect(harness.workspaceMainView.value).toBe("conversation");
    expect(harness.ensureRevisionLoaded).not.toHaveBeenCalled();
    expect(harness.ensureAuthoringLoaded).not.toHaveBeenCalled();
    expect(harness.listDirectory).not.toHaveBeenCalled();
    expect(
      Object.values(harness.loaders).every(
        (loader) => vi.mocked(loader).mock.calls.length === 0
      )
    ).toBe(true);
  });

  it("does not let a late imitation or team load replace a newer page", async () => {
    const learning = deferred<void>();
    const authoring = deferred<void>();
    const harness = createHarness({
      ensureRevisionLoaded: () => learning.promise,
      ensureAuthoringLoaded: () => authoring.promise
    });

    const imitationNavigation =
      harness.coordinator.openWorkspaceDialog("revision-analysis");
    await Promise.resolve();
    await harness.coordinator.openWorkspaceDialog("models");
    learning.resolve();
    await imitationNavigation;
    expect(harness.workspaceMainView.value).toBe("models");

    const teamNavigation = harness.coordinator.openAgentTeams();
    await Promise.resolve();
    await harness.coordinator.openWorkspaceDialog("models");
    authoring.resolve();
    await teamNavigation;
    expect(harness.workspaceMainView.value).toBe("models");
    expect(harness.loaders.loadAgentTeamSettings).not.toHaveBeenCalled();
  });

  it("does not let a lazy feature replace an external conversation navigation", async () => {
    const learning = deferred<void>();
    const harness = createHarness({
      ensureRevisionLoaded: () => learning.promise
    });

    harness.workspaceMainView.value = "models";
    const imitationNavigation =
      harness.coordinator.openWorkspaceDialog("revision-analysis");
    await Promise.resolve();
    harness.coordinator.showConversation();
    learning.resolve();
    await imitationNavigation;

    expect(harness.workspaceMainView.value).toBe("conversation");
    expect(harness.loaders.loadModelSettings).not.toHaveBeenCalled();
  });

  it("reports an active lazy-feature failure but suppresses a stale failure", async () => {
    const activeHarness = createHarness({
      ensureRevisionLoaded: async () => {
        throw new Error("仿写模块不可用");
      }
    });
    await activeHarness.coordinator.openWorkspaceDialog("revision-analysis");
    expect(activeHarness.errors).toEqual(["仿写模块不可用"]);
    expect(activeHarness.workspaceMainView.value).toBe("conversation");

    const pending = deferred<void>();
    const staleHarness = createHarness({
      ensureAuthoringLoaded: () => pending.promise
    });
    const teamNavigation = staleHarness.coordinator.openAgentTeams();
    await Promise.resolve();
    await staleHarness.coordinator.openWorkspaceDialog("models");
    pending.reject(new Error("旧团队加载失败"));
    await teamNavigation;
    expect(staleHarness.errors).toEqual([]);
  });

  it("loads only the dependencies owned by conversation, long writing, and models", async () => {
    const harness = createHarness();

    await harness.coordinator.ensureActiveFeatureDependencies("conversation");
    expect(harness.loaders.loadModelSettings).toHaveBeenCalledTimes(1);
    expect(harness.loaders.loadLibraryAgentSettings).toHaveBeenCalledTimes(1);
    expect(harness.loaders.loadAgentTeamSettings).toHaveBeenCalledTimes(1);

    await harness.coordinator.ensureActiveFeatureDependencies("long-workspace");
    expect(harness.loaders.loadModelSettings).toHaveBeenCalledTimes(2);
    expect(harness.loaders.ensureLongAgentSettingsLoaded).toHaveBeenCalledTimes(
      1
    );
    expect(harness.loaders.loadAgentTeamSettings).toHaveBeenCalledTimes(2);

    await harness.coordinator.ensureActiveFeatureDependencies("models");
    await harness.coordinator.ensureActiveFeatureDependencies("directory");
    expect(harness.loaders.loadModelSettings).toHaveBeenCalledTimes(3);
  });

  it("loads settings models without opening removed official model pages", async () => {
    const harness = createHarness();

    await harness.coordinator.openSettings("general");
    expect(harness.currentView.value).toBe("settings");
    expect(harness.loaders.loadModelSettings).toHaveBeenCalledOnce();
    expect(harness.loaders.loadOfficialModels).not.toHaveBeenCalled();
    expect(
      harness.loaders.ensureLongAgentSettingsLoaded
    ).toHaveBeenCalledOnce();
    expect(harness.loaders.loadLibraryAgentSettings).toHaveBeenCalledOnce();

    harness.coordinator.closeSettings();
    await harness.coordinator.openSettings("custom-models");
    expect(harness.loaders.loadOfficialModels).not.toHaveBeenCalled();
    expect(harness.loaders.loadModelSettings).toHaveBeenCalledTimes(2);
  });

  it("keeps the current page usable when a settings chunk cannot load", async () => {
    const harness = createHarness();
    harness.workspaceMainView.value = "models";
    vi.mocked(loadSettingsFeature).mockRejectedValueOnce(
      new TypeError("Failed to fetch dynamically imported module")
    );

    await harness.coordinator.openSettings();

    expect(harness.currentView.value).toBe("workspace");
    expect(harness.workspaceMainView.value).toBe("models");
    expect(harness.errors).toEqual([
      "设置页面加载失败，请稍后重试或重新启动应用。"
    ]);
    expect(
      harness.loaders.ensureLongAgentSettingsLoaded
    ).not.toHaveBeenCalled();

    await harness.coordinator.openSettings();
    expect(harness.currentView.value).toBe("settings");
  });

  it("waits for settings assets and ignores completion after newer navigation", async () => {
    const pending = deferred<typeof buildSettingsFeatureModule>();
    const loading = vi.fn(() => pending.promise);
    vi.mocked(loadSettingsFeature).mockImplementationOnce(loading);
    const harness = createHarness();
    const opening = harness.coordinator.openSettings("custom-models");
    await vi.waitFor(() => expect(loading).toHaveBeenCalledOnce());
    expect(harness.currentView.value).toBe("workspace");

    await harness.coordinator.openWorkspaceDialog("models");
    pending.resolve(buildSettingsFeatureModule);
    await opening;

    expect(harness.currentView.value).toBe("workspace");
    expect(harness.workspaceMainView.value).toBe("models");
    expect(harness.loaders.loadOfficialModels).not.toHaveBeenCalled();
  });

  it("contains rejecting background loaders without changing the selected page", async () => {
    const harness = createHarness({
      loaderOverrides: {
        loadCatalogSnapshot: async () => {
          throw new Error("Catalog unavailable");
        }
      }
    });

    await expect(
      harness.coordinator.openWorkspaceDialog("models")
    ).resolves.toBeUndefined();
    await Promise.resolve();
    expect(harness.workspaceMainView.value).toBe("models");
    expect(harness.errors).toEqual([]);
  });

  it("loads and chooses a workspace directory with cancellation, errors, and single-flight guards", async () => {
    const harness = createHarness();

    await harness.coordinator.loadWorkspaceDirectory();
    expect(harness.settingsStore.workspaceDirectoryPath).toBe("/workspace-a");

    await harness.coordinator.chooseWorkspaceDirectory();
    expect(harness.settingsStore.workspaceDirectoryPath).toBe("/workspace-b");
    expect(harness.successes).toEqual([
      "工作目录已切换；现有项目保持原位置不变"
    ]);

    const cancelled = createHarness({
      chooseDirectory: async () => null
    });
    await cancelled.coordinator.chooseWorkspaceDirectory();
    expect(cancelled.settingsStore.workspaceDirectoryPath).toBeNull();
    expect(cancelled.successes).toEqual([]);

    const failed = createHarness({
      loadDirectory: async () => {
        throw new Error("目录读取失败");
      },
      chooseDirectory: async () => {
        throw new Error("目录切换失败");
      }
    });
    await failed.coordinator.loadWorkspaceDirectory();
    await failed.coordinator.chooseWorkspaceDirectory();
    expect(failed.errors).toEqual(["目录读取失败", "目录切换失败"]);

    const pendingChoice = deferred<WorkspaceDirectorySettings | null>();
    const guarded = createHarness({
      chooseDirectory: () => pendingChoice.promise
    });
    const firstChoice = guarded.coordinator.chooseWorkspaceDirectory();
    await guarded.coordinator.chooseWorkspaceDirectory();
    expect(guarded.chooseDirectory).toHaveBeenCalledOnce();
    pendingChoice.resolve({ path: "/workspace-c" });
    await firstChoice;
  });
});
