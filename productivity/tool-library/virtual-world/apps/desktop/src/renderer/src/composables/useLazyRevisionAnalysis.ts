import type { DeepWriteApi } from "@deepwrite/contracts";
import { useLazyModelFeature } from "./useLazyModelFeature";
export function useLazyRevisionAnalysis(options: {
  api: () => DeepWriteApi | undefined;
}) {
  return useLazyModelFeature("修改分析", async () => {
    const { useRevisionAnalysis } = await (
      await import("../extras/revision-analysis/loader")
    ).loadController();
    return useRevisionAnalysis(options);
  });
}
