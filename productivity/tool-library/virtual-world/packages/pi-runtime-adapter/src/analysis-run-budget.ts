import {
  assertRevisionAnalysisBudget,
  assertShortAnalysisBudget
} from "@deepwrite/contracts";
import type { AgentRunInput } from "./runtime-types";
export function assertAnalysisRunBudget(
  input: AgentRunInput,
  model: { contextWindow?: number; maxTokens?: number }
) {
  if (input.workspaceContext?.revisionAnalysis)
    assertRevisionAnalysisBudget(
      input.workspaceContext.revisionAnalysis,
      model
    );
  if (
    input.workspaceContext?.shortBookAnalysis &&
    input.shortBookAnalysisProfile
  )
    assertShortAnalysisBudget(
      input.workspaceContext.shortBookAnalysis,
      input.shortBookAnalysisProfile,
      model
    );
}
