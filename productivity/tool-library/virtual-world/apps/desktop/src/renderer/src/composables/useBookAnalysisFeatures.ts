import { useLazyRevisionAnalysis } from "./useLazyRevisionAnalysis";
import type { DeepWriteApi, ModelConfig } from "@deepwrite/contracts";
export function useBookAnalysisFeatures(api: () => DeepWriteApi | undefined) {
  const revisionAnalysisFeature = useLazyRevisionAnalysis({ api });
  return {
    revisionAnalysisFeature,
    revisionAnalysisRunning: revisionAnalysisFeature.isBusy,
    configureAnalysisModels(
      models: readonly ModelConfig[],
      defaultModelId?: string
    ) {
      revisionAnalysisFeature.setConfiguredModels(models, defaultModelId);
    },
    disposeAnalysisFeatures() {
      revisionAnalysisFeature.dispose();
    }
  };
}
