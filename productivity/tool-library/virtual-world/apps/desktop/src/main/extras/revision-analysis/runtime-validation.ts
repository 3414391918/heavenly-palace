import {
  assertRevisionAnalysisBudget,
  type RevisionAnalysisRuntimeContext,
  type AgentProviderRuntimeConfig
} from "@deepwrite/contracts";
export function assertRevisionAnalysisRuntime(
  context: RevisionAnalysisRuntimeContext,
  model: AgentProviderRuntimeConfig | undefined
): void {
  if (!model) throw new Error("请先选择一个可用模型，再运行修改分析。");
  assertRevisionAnalysisBudget(context, model);
}
