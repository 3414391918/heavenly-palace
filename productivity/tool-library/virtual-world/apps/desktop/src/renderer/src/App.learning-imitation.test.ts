import { describe, expect, it } from "vitest";
import { nextTick, ref, shallowRef } from "vue";
import { watchFeatureErrors } from "./composables/workspaceFeatureErrors";
import type { WorkspaceFeatureHostCoordinatorOptions } from "./composables/workspaceFeatureHostTypes";
import source from "./WorkspaceShell.vue?raw";
import featureModulesSource from "./components/WorkspaceFeatureModules.vue?raw";
import featureHostCoordinatorSource from "./composables/useWorkspaceFeatureHostCoordinator.ts?raw";
import featureHostModuleSource from "./composables/workspaceFeatureHostModule.ts?raw";
import eventRoutesSource from "./events/registerWorkspaceSystemEventRoutes.ts?raw";

const featureHostSource = `${featureHostCoordinatorSource}\n${featureHostModuleSource}`;

describe("App learning-imitation integration", () => {
  it("lazily owns one long-lived controller and routes runtime events to it", () => {
    expect(source).toContain("useLazyLearningImitationController");
    expect(source).toContain("learningImitation: learningImitationFeature");
    expect(eventRoutesSource).toContain(
      "dependencies.learningImitation.handleEvent(event)"
    );
    expect(featureHostSource).toContain(
      "options.features.learningImitation.ensureLoaded()"
    );
    expect(featureHostSource).toContain(
      "controller: options.features.learningImitation.controller.value"
    );
    expect(featureModulesSource).toContain(':controller="module.controller"');
  });

  it("opens learning imitation as a persistent workspace page", () => {
    expect(source).toContain('@open-dialog="featureHost.openWorkspaceDialog"');
    expect(featureHostSource).toContain(
      "async function openWorkspaceDialog(mode: DialogMode)"
    );
    expect(featureHostSource).toContain(
      "options.view.workspaceMain.value = mode"
    );
    expect(featureHostSource).toContain('case "imitation":');
    expect(featureHostSource).toContain('kind: "imitation"');
    expect(featureModulesSource).toContain(
      "v-else-if=\"module.kind === 'imitation'\""
    );
    expect(featureModulesSource).toContain(
      'class="learning-imitation-main-view"'
    );
    expect(featureModulesSource).toContain("<LearningImitationDialog");
    expect(featureModulesSource).toContain("      active\n");
    expect(
      `${source}\n${featureHostSource}\n${featureModulesSource}`
    ).not.toContain("learningImitationOpen");
  });

  it("shows a sidebar background marker and disposes lazy controllers with App", () => {
    expect(source).toContain(':imitation-running="learningImitationRunning"');
    expect(source).toContain("() => learningImitationFeature.dispose()");
    expect(source).toContain("() => subagentAuthoringFeature.dispose()");
  });

  it("surfaces rejected feature calls as floating messages and stops after disposal", async () => {
    const names = [
      "learningImitation",
      "subagentAuthoring",
      "shortBookAnalysis",
      "longBookAnalysis",
      "revisionAnalysis"
    ] as const;
    const features = Object.fromEntries(
      names.map((name) => [
        name,
        { controller: shallowRef({ error: ref<string | null>(null) }) }
      ])
    );
    const errors: string[] = [];
    const stop = watchFeatureErrors(
      {
        features,
        notifications: { error: (message: string) => errors.push(message) }
      } as unknown as WorkspaceFeatureHostCoordinatorOptions,
      () => true
    );
    for (const name of names)
      features[name]!.controller.value.error.value = `${name} failed`;
    await nextTick();
    expect(errors).toEqual(names.map((name) => `${name} failed`));
    stop();
    features.learningImitation!.controller.value.error.value = "late failure";
    await nextTick();
    expect(errors).toHaveLength(names.length);
    expect(source).toContain("notifications: uiMessage");
  });
});
