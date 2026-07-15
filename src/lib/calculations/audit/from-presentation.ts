import type { DecisionImpactPresentation } from "@/lib/calculations/impact/engine";
import type { ExplainedValue } from "@/lib/calculations/audit/types";
import { FORMULA_ENGINE_VERSION } from "@/lib/calculations/version";

/**
 * Build a merchant-facing ExplainedValue from DecisionImpactPresentation waterfall
 * when a full CalculationAudit is not yet plumbed into the screen.
 */
export function explainedFromImpactPresentation(
  presentation: DecisionImpactPresentation,
  opts?: {
    formula?: string;
    dataSources?: string[];
    lastUpdatedAt?: string | null;
    confidencePct?: number | null;
    assumptions?: string[];
  },
): ExplainedValue {
  return {
    value: presentation.heroAmount,
    formula:
      opts?.formula ??
      "Recoverable Opportunity = Business Leakage components → Net Profit Improvement",
    formulaId: "business_recovery_presentation",
    formulaVersion: FORMULA_ENGINE_VERSION,
    inputs: {
      heroAmount: presentation.heroAmount,
      netProfitAmount: presentation.netProfitAmount,
      confidencePct: presentation.confidencePct,
    },
    intermediateSteps: presentation.waterfall.map((step, i, arr) => ({
      label: step.label,
      value: step.amount,
      unit: "currency" as const,
      op: i === arr.length - 1 ? ("result" as const) : ("note" as const),
    })),
    dataSources: opts?.dataSources ?? ["DecisionImpact", "Shopify", "Meta Ads"],
    assumptions: opts?.assumptions,
    lastUpdatedAt: opts?.lastUpdatedAt ?? null,
    confidencePct: opts?.confidencePct ?? presentation.confidencePct,
  };
}
