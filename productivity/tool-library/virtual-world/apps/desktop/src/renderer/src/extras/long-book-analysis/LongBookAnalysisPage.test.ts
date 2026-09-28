import { expectSourceToContain } from "../../../../test-utils/sourceText";
import { describe, expect, it } from "vitest";
import pageSource from "./LongBookAnalysisPage.vue?raw";
import runControlsSource from "./LongAnalysisRunControls.vue?raw";
import runStatusSource from "./AnalysisRunStatus.vue?raw";
import processPanelSource from "./AnalysisProcessPanel.vue?raw";
import processTrackerSource from "./analysis-process.ts?raw";
import resultPanelSource from "./AnalysisResultPanel.vue?raw";
import sourceControlsSource from "./AnalysisSourceControls.vue?raw";
import presetManagerSource from "./PresetManager.vue?raw";
import presetEditorSource from "./PresetEditor.vue?raw";
import sidebarViewSource from "../../components/LeftSidebar.vue?raw";
import sidebarCatalogSource from "../../components/sidebarMoreFeatures.ts?raw";
const sidebarSource = `${sidebarViewSource}\n${sidebarCatalogSource}`;
import moduleSource from "../../components/WorkspaceFeatureModules.vue?raw";
import asyncComponentsSource from "../../components/lazyAppComponents.ts?raw";
import featureImportsSource from "../../components/lazyFeatureImports.ts?raw";
const lazySource = `${asyncComponentsSource}\n${featureImportsSource}`;

describe("long-book analysis feature wiring", () => {
  it("is a preset-driven page without a conversation composer", () => {
    expect(pageSource).toContain("长篇拆书分析");
    expect(pageSource).toContain("selectionCount <= 50");
    expect(pageSource).toContain("<PopupSelect");
    expect(runControlsSource).toContain("controller.retry");
    expect(runControlsSource).toContain("controller.stop");
    expect(pageSource).toContain("controller.selectedThinkingLevel.value");
    expect(pageSource).toContain("selectedTargetLibraryId");
    expect(pageSource).toContain("<AnalysisSourceControls");
    expect(sourceControlsSource).toContain("选择已导入长篇");
    expect(sourceControlsSource).toContain("controller.loadSavedSources");
    expect(sourceControlsSource).toContain("controller.loadSavedSource");
    expect(sourceControlsSource).toContain("备份到工作目录");
    expect(pageSource).toContain(
      ':target-library-id="controller.targetLibraryId.value"'
    );
    expect(runStatusSource).toContain("查看详情");
    expect(runStatusSource).toContain("<AnalysisProcessPanel");
    expect(runControlsSource).toContain("查看生成结果");
    expect(runControlsSource).toContain("执行“{{ presetName }}");
    expect(pageSource).not.toContain("!selectedTargetLibraryId");
    expect(processTrackerSource).toContain("仅运行当前预设");
    expect(processPanelSource).toContain("内部思考文本不会展示");
    expect(resultPanelSource).toContain('v-model="targetId"');
    expect(resultPanelSource).toContain("生成后可随时更换目标库");
    expect(pageSource).not.toContain("AgentConversation");
    expect(pageSource).not.toContain("ConversationComposer");
  });

  it("uses a lazy more-features entry with background status", () => {
    expect(sidebarSource).toContain('id: "long-book-analysis"');
    expect(sidebarSource).toContain("props.longBookAnalysisRunning");
    expectSourceToContain(
      lazySource,
      'import("../extras/long-book-analysis/loader")'
    );
    expect(moduleSource).toContain("module.kind === 'long-book-analysis'");
    expect(moduleSource).toContain('class="long-book-analysis-main-view"');
  });

  it("keeps the page toolbar and task form responsive", () => {
    expect(sourceControlsSource).toContain('class="analysis-page-actions"');
    expect(pageSource).toContain('class="chapter-range-inputs"');
    expect(pageSource).toContain("<AnalysisRunStatus");
    expect(pageSource).toContain('import "./long-book-analysis.css"');
    expect(pageSource).toContain('class="analysis-empty-meta"');
    expect(pageSource).toContain('class="setup-field setup-range-field"');
    expect(pageSource).toContain('class="preset-target-field"');
  });

  it("configures a preset's concrete target library", () => {
    expect(presetEditorSource).toContain("默认目标资料库");
    expect(presetEditorSource).toContain("setTargetLibrary");
    expect(presetEditorSource).not.toContain("导入条目类型");
    expect(presetManagerSource).toContain("cloneLongBookAnalysisPreset");
    expect(presetManagerSource).not.toContain("structuredClone(preset)");
    expect(presetManagerSource).toContain("点击卡片展开编辑");
    expect(presetManagerSource).toContain('v-if="!preset.builtin"');
  });
});
