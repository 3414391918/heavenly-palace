import {
  chooseLongBookAnalysisSource,
  listLongBookAnalysisSources,
  loadLongBookAnalysisSource,
  listLongBookAnalysisPresets,
  saveLongBookAnalysisPresets,
  resetLongBookAnalysisPresets
} from "./long-book-analysis-api";
import { shortBookAnalysisApi } from "./short-book-analysis-api";
import { revisionAnalysisApi } from "./revision-analysis-api";
export const analysisApis = {
  revisionAnalysis: revisionAnalysisApi,
  shortBookAnalysis: shortBookAnalysisApi,
  longBookAnalysis: {
    chooseSource: chooseLongBookAnalysisSource,
    sources: {
      list: listLongBookAnalysisSources,
      load: loadLongBookAnalysisSource
    },
    presets: {
      list: listLongBookAnalysisPresets,
      save: saveLongBookAnalysisPresets,
      reset: resetLongBookAnalysisPresets
    }
  }
};
