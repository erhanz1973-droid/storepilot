import type { AnalyzerOutput, DataSourceId } from "@/lib/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { RecommendationAnalyzerContext } from "./analyzer-context";

export type RecommendationAnalyzer = {
  id: string;
  category: AnalyzerOutput["category"];
  /** Run only when at least one of these connectors is active */
  requiredConnectors?: DataSourceId[];
  analyze(
    snapshot: StoreSnapshot,
    context?: RecommendationAnalyzerContext,
  ): AnalyzerOutput[];
};
