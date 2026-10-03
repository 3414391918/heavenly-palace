import type { DeepWriteApi } from "@deepwrite/contracts/renderer";
export function createBookAnalysisTestApi(): Pick<
  DeepWriteApi,
  "revisionAnalysis"
> {
  return {
    revisionAnalysis: {
      list: async () => ({ systemPrompt: "测试方法" }),
      save: async (input) => input,
      reset: async () => ({ systemPrompt: "测试方法" })
    }
  };
}
