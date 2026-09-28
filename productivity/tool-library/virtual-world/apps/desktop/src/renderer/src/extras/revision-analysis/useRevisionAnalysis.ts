import { computed, ref, shallowRef, watch } from "vue";
import {
  DEFAULT_REVISION_METHOD,
  RevisionAnalysisInputSchema,
  RevisionAnalysisSettingsSchema,
  type DeepWriteApi,
  type ModelConfig,
  type RevisionChange,
  type ThinkingLevel
} from "@deepwrite/contracts/renderer";
import { selectableModels } from "../../utils/selectableModelSettings";
import { compareRevisionParagraphs } from "./paragraph-diff";
import { createRevisionAnalysisRun } from "./analysis-run";
import { createRevisionSkillSave } from "./skill-save";
export type RevisionAnalysisController = ReturnType<typeof useRevisionAnalysis>;
export function useRevisionAnalysis(options: {
  api: () => DeepWriteApi | undefined;
}) {
  const api = () => {
    const current = options.api();
    if (!current) throw new Error("当前环境不支持修改分析。");
    return current;
  };
  const run = createRevisionAnalysisRun(api);
  const beforeText = ref(""),
    afterText = ref(""),
    overallReason = ref("");
  const systemPrompt = ref(DEFAULT_REVISION_METHOD);
  const changes = ref<RevisionChange[]>([]);
  const comparedText = ref("");
  const selectedModelId = ref(""),
    selectedThinkingLevel = ref<ThinkingLevel>("off");
  const models = shallowRef<readonly ModelConfig[]>([]);
  const loading = ref(false);
  let loaded = false,
    disposed = false;
  const textKey = () => JSON.stringify([beforeText.value, afterText.value]);
  const comparisonCurrent = computed(() => comparedText.value === textKey());
  const input = computed(() => ({
    beforeText: beforeText.value,
    afterText: afterText.value,
    changes: changes.value,
    overallReason: overallReason.value,
    systemPrompt: systemPrompt.value
  }));
  const inputKey = computed(() => {
    const parsed = RevisionAnalysisInputSchema.safeParse(input.value);
    return parsed.success ? JSON.stringify(parsed.data) : "";
  });
  const isStale = computed(
    () =>
      Boolean(run.result.value) && inputKey.value !== run.completedInput.value
  );
  const skillSave = createRevisionSkillSave(api, run.result);
  const disabled = computed(() => run.isBusy.value || loading.value);
  const selectedModel = computed(() =>
    models.value.find((m) => m.id === selectedModelId.value)
  );
  const canStart = computed(
    () =>
      !disabled.value &&
      comparisonCurrent.value &&
      changes.value.length > 0 &&
      Boolean(selectedModel.value) &&
      Boolean(inputKey.value)
  );
  function editable() {
    if (disabled.value || disposed) throw new Error("正在处理，请稍后再修改。");
  }
  const stopModelWatch = watch(selectedModelId, () => {
    selectedThinkingLevel.value =
      selectedModel.value?.defaultThinkingLevel ?? "off";
  });
  return {
    ...run,
    ...skillSave,
    beforeText,
    afterText,
    overallReason,
    systemPrompt,
    changes,
    selectedModelId,
    selectedThinkingLevel,
    comparisonCurrent,
    isStale,
    loading,
    disabled,
    canStart,
    setConfiguredModels(next: readonly ModelConfig[], defaultModelId?: string) {
      const available = selectableModels(next);
      models.value = available;
      const model =
        available.find((m) => m.id === selectedModelId.value) ??
        available.find((m) => m.id === defaultModelId) ??
        available[0];
      selectedModelId.value = model?.id ?? "";
      if (
        model &&
        selectedThinkingLevel.value !== "off" &&
        !model.thinkingLevelOptions.includes(selectedThinkingLevel.value)
      )
        selectedThinkingLevel.value = model.defaultThinkingLevel;
    },
    async loadSettings() {
      if (loaded || loading.value || disposed) return;
      loading.value = true;
      try {
        const settings = await api().revisionAnalysis.list();
        if (!disposed) {
          systemPrompt.value = settings.systemPrompt;
          loaded = true;
        }
      } finally {
        loading.value = false;
      }
    },
    async saveSettings(reset = false) {
      editable();
      loading.value = true;
      try {
        const settings = reset
          ? await api().revisionAnalysis.reset()
          : await api().revisionAnalysis.save(
              RevisionAnalysisSettingsSchema.parse({
                systemPrompt: systemPrompt.value
              })
            );
        if (!disposed) {
          systemPrompt.value = settings.systemPrompt;
          loaded = true;
        }
      } finally {
        loading.value = false;
      }
    },
    compare() {
      editable();
      if (!beforeText.value.trim() || !afterText.value.trim())
        throw new Error("请填写修改前和修改后正文。");
      if (beforeText.value.length > 100_000 || afterText.value.length > 100_000)
        throw new Error("每侧正文最多 100,000 字符。");
      changes.value = compareRevisionParagraphs(
        beforeText.value,
        afterText.value,
        changes.value
      );
      comparedText.value = textKey();
    },
    start() {
      editable();
      if (!canStart.value || !selectedModel.value)
        throw new Error("请先比较当前正文差异并选择可用模型。");
      run.start(
        RevisionAnalysisInputSchema.parse(input.value),
        selectedModel.value,
        selectedThinkingLevel.value
      );
    },
    dispose() {
      disposed = true;
      stopModelWatch();
      run.dispose();
    }
  };
}
