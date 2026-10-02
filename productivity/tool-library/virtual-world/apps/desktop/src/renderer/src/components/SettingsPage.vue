<script setup lang="ts">
import { computed, ref } from "vue";
import {
  type AppLanguage,
  type BodyTextFormats,
  type BodyTextFormatChange,
  type CreativePlotStage,
  type GeneralPermissionMode,
  type LibraryAgentDomain,
  type LibraryAgentSettings,
  type LibraryAgentSettingsInput,
  type LongAgentSettings,
  type LongAgentSettingsInput,
  type ModelConfigInput,
  type ModelSettings,
  type ModelSettingsInput,
  type ModelUsageDashboard,
  type ModelUsageQueryInput,
  type TextViewMode,
  type WorkspacePaneLayout,
  type WorkspaceAgentSettings,
  type WorkspaceAgentSettingsInput
} from "@deepwrite/contracts";
import AppIcon from "./AppIcon.vue";
import AppearanceSettingsPanel from "./AppearanceSettingsPanel.vue";
import BodyTextSettingsPanel from "./BodyTextSettingsPanel.vue";
import GeneralSettingsPanel from "./GeneralSettingsPanel.vue";
import LibraryAgentSettingsPanel from "./LibraryAgentSettingsPanel.vue";
import ModelSettingsFeature from "./ModelSettingsFeature.vue";
import ModelUsagePanel from "./ModelUsagePanel.vue";
import ShortAgentSettingsPanel from "./ShortAgentSettingsPanel.vue";

interface SettingsCategory {
  id: string;
  label: string;
  icon?:
    | "user"
    | "sparkles"
    | "keyboard"
    | "globe"
    | "model"
    | "ledger"
    | "brain"
    | "settings"
    | "wand"
    | "archive";
}

interface SettingsSection {
  id: string;
  label: string;
  categories: SettingsCategory[];
}

const props = defineProps<{
  initialCategory?: string;
  permissionMode: GeneralPermissionMode;
  autoApproveCrossStageOperations: boolean;
  autoSaveEnabled: boolean;
  language: AppLanguage;
  showContextUsage: boolean;
  showInMenuBar: boolean;
  workspacePaneLayout: WorkspacePaneLayout;
  defaultTextViewMode: TextViewMode;
  bodyTextFormats: BodyTextFormats;
  workspaceAgentSettings: readonly WorkspaceAgentSettings[];
  creativePlotStages: readonly CreativePlotStage[];
  longAgentSettings: LongAgentSettings | null;
  workspaceAgentLoading: boolean;
  workspaceAgentSaving: boolean;
  longAgentLoading: boolean;
  longAgentSaving: boolean;
  longAgentError: string | null;
  modelUsageDashboard: ModelUsageDashboard | null;
  modelUsageLoading: boolean;
  modelSettings: ModelSettings | null;
  modelLoading: boolean;
  modelSaving: boolean;
  modelError: string | null;
  modelTestMessage: string | null;
  testingModelId: string | null;
  libraryAgentSettings: LibraryAgentSettings | null;
  libraryAgentLoading: boolean;
  libraryAgentSaving: boolean;
  runtimeAvailable: boolean;
}>();

const emit = defineEmits<{
  back: [];
  updatePermissionMode: [mode: GeneralPermissionMode];
  updateAutoApproveCrossStageOperations: [enabled: boolean];
  updateAutoSave: [enabled: boolean];
  updateLanguage: [language: AppLanguage];
  updateShowContextUsage: [enabled: boolean];
  updateShowInMenuBar: [enabled: boolean];
  updateWorkspacePaneLayout: [layout: WorkspacePaneLayout];
  updateDefaultTextViewMode: [mode: TextViewMode];
  updateBodyTextFormat: [change: BodyTextFormatChange];
  saveWorkspaceAgents: [settings: WorkspaceAgentSettingsInput];
  retryLongAgents: [];
  saveLongAgents: [settings: LongAgentSettingsInput];
  saveLibraryAgents: [settings: LibraryAgentSettingsInput];
  resetLibraryAgent: [domain: LibraryAgentDomain];
  loadModelUsage: [input?: ModelUsageQueryInput];
  loadModels: [];
  saveModels: [settings: ModelSettingsInput];
  testModel: [model: ModelConfigInput];
}>();
const searchQuery = ref("");

const sections: SettingsSection[] = [
  {
    id: "creation",
    label: "创作",
    categories: [
      { id: "short-agents", label: "创作空间配置", icon: "brain" },
      { id: "skill-library-agent", label: "技能库配置", icon: "wand" },
      { id: "material-library-agent", label: "素材库配置", icon: "archive" }
    ]
  },
  {
    id: "models-and-usage",
    label: "模型与用量",
    categories: [
      { id: "usage", label: "用量", icon: "ledger" },
      { id: "custom-models", label: "自定义模型配置", icon: "model" }
    ]
  },
  {
    id: "personal",
    label: "个人",
    categories: [
      { id: "general", label: "常规", icon: "settings" },
      { id: "body-text", label: "正文文本", icon: "wand" },
      { id: "appearance", label: "外观", icon: "sparkles" }
    ]
  }
];

const activeCategory = ref(
  sections.some((section) =>
    section.categories.some((category) => category.id === props.initialCategory)
  )
    ? props.initialCategory!
    : "general"
);

const visibleSections = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) return sections;
  return sections
    .map((section) => ({
      ...section,
      categories: section.categories.filter((category) =>
        category.label.toLocaleLowerCase().includes(query)
      )
    }))
    .filter((section) => section.categories.length);
});

const activeLabel = computed(() => {
  for (const section of sections) {
    const found = section.categories.find(
      (category) => category.id === activeCategory.value
    );
    if (found) return found.label;
  }
  return "常规";
});

async function selectCategory(id: string): Promise<void> {
  if (id === "custom-models") {
    emit("loadModels");
  }
  activeCategory.value = id;
}
</script>

<template>
  <div class="settings-page">
    <aside class="settings-sidebar">
      <button class="settings-back" type="button" @click="emit('back')">
        <AppIcon name="chevron" :size="14" />
        <span>返回应用</span>
      </button>

      <div class="settings-search">
        <AppIcon name="search" :size="14" />
        <input v-model="searchQuery" type="search" placeholder="搜索设置..." />
      </div>

      <nav class="settings-nav" aria-label="设置分类">
        <div
          v-for="section in visibleSections"
          :key="section.id"
          class="settings-section"
        >
          <strong class="settings-section-label">{{ section.label }}</strong>
          <button
            v-for="category in section.categories"
            :key="category.id"
            class="settings-category"
            :class="{ 'is-active': activeCategory === category.id }"
            type="button"
            @click="selectCategory(category.id)"
          >
            <AppIcon v-if="category.icon" :name="category.icon" :size="15" />
            <span v-else class="settings-category-spacer" />
            <span>{{ category.label }}</span>
          </button>
        </div>
        <p v-if="!visibleSections.length" class="settings-search-empty">
          没有匹配的设置
        </p>
      </nav>
    </aside>

    <main class="settings-content">
      <div class="settings-content-inner">
        <h1 class="settings-title">{{ activeLabel }}</h1>

        <ShortAgentSettingsPanel
          v-if="activeCategory === 'short-agents'"
          :settings="workspaceAgentSettings"
          :creative-plot-stages="creativePlotStages"
          :long-settings="longAgentSettings"
          :loading="workspaceAgentLoading"
          :saving="workspaceAgentSaving"
          :long-loading="longAgentLoading"
          :long-saving="longAgentSaving"
          :long-error-message="longAgentError"
          :runtime-available="runtimeAvailable"
          @save="emit('saveWorkspaceAgents', $event)"
          @retry-long="emit('retryLongAgents')"
          @save-long="emit('saveLongAgents', $event)"
        />

        <LibraryAgentSettingsPanel
          v-else-if="activeCategory === 'skill-library-agent'"
          domain="skill"
          :settings="libraryAgentSettings"
          :loading="libraryAgentLoading"
          :saving="libraryAgentSaving"
          :runtime-available="runtimeAvailable"
          @save="emit('saveLibraryAgents', $event)"
          @reset="emit('resetLibraryAgent', $event)"
        />

        <LibraryAgentSettingsPanel
          v-else-if="activeCategory === 'material-library-agent'"
          domain="material"
          :settings="libraryAgentSettings"
          :loading="libraryAgentLoading"
          :saving="libraryAgentSaving"
          :runtime-available="runtimeAvailable"
          @save="emit('saveLibraryAgents', $event)"
          @reset="emit('resetLibraryAgent', $event)"
        />

        <ModelUsagePanel
          v-else-if="activeCategory === 'usage'"
          :dashboard="modelUsageDashboard"
          :loading="modelUsageLoading"
          @query="emit('loadModelUsage', $event)"
        />

        <ModelSettingsFeature
          v-else-if="activeCategory === 'custom-models'"
          model-scope="custom"
          embedded
          active
          :model-settings="modelSettings"
          :model-loading="modelLoading"
          :model-saving="modelSaving"
          :model-error="modelError"
          :model-test-message="modelTestMessage"
          :testing-model-id="testingModelId"
          :model-alert-messages="[]"
          @save-models="emit('saveModels', $event)"
          @test-model="emit('testModel', $event)"
        />

        <GeneralSettingsPanel
          v-else-if="activeCategory === 'general'"
          :permission-mode="permissionMode"
          :auto-approve-cross-stage-operations="autoApproveCrossStageOperations"
          :auto-save-enabled="autoSaveEnabled"
          :language="language"
          :show-context-usage="showContextUsage"
          :show-in-menu-bar="showInMenuBar"
          :workspace-pane-layout="workspacePaneLayout"
          @update-permission-mode="emit('updatePermissionMode', $event)"
          @update-auto-approve-cross-stage-operations="
            emit('updateAutoApproveCrossStageOperations', $event)
          "
          @update-auto-save="emit('updateAutoSave', $event)"
          @update-language="emit('updateLanguage', $event)"
          @update-show-context-usage="emit('updateShowContextUsage', $event)"
          @update-show-in-menu-bar="emit('updateShowInMenuBar', $event)"
          @update-workspace-pane-layout="
            emit('updateWorkspacePaneLayout', $event)
          "
        />

        <BodyTextSettingsPanel
          v-else-if="activeCategory === 'body-text'"
          :default-text-view-mode="defaultTextViewMode"
          :body-text-formats="bodyTextFormats"
          @update-default-text-view-mode="
            emit('updateDefaultTextViewMode', $event)
          "
          @update-body-text-format="emit('updateBodyTextFormat', $event)"
        />

        <AppearanceSettingsPanel v-else-if="activeCategory === 'appearance'" />

        <section v-else class="settings-group">
          <div class="settings-card">
            <p class="settings-placeholder">
              「{{ activeLabel }}」设置项待配置。
            </p>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped src="./settings-page.css"></style>
