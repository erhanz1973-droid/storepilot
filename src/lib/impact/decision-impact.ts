/**
 * @deprecated Import from `@/lib/calculations` — this file is a compatibility facade.
 */
import type { Recommendation } from "@/lib/types";
import {
  buildDecisionImpactPresentation,
  calculateDecisionImpactFromInputs,
  mergeDecisionImpacts,
  DECISION_IMPACT_COPY,
  detectAdvertisingSavingsRange,
  extractExplicitProfitAmount,
  formatDecisionMonthlyImpact,
  recommendationCategoryToOpportunity,
  decisionImpactWaterfall,
} from "@/lib/calculations/impact/engine";

export type {
  DecisionImpact,
  DecisionImpactPresentation,
  DecisionImpactWaterfallStep,
} from "@/lib/calculations/impact/engine";

export {
  buildDecisionImpactPresentation,
  mergeDecisionImpacts,
  DECISION_IMPACT_COPY,
  detectAdvertisingSavingsRange,
  extractExplicitProfitAmount,
  formatDecisionMonthlyImpact,
  recommendationCategoryToOpportunity,
  decisionImpactWaterfall,
};

/** @deprecated Use calculateDecisionImpact(decision, kpis) from @/lib/calculations */
export function calculateDecisionImpact(input: {
  expectedImpactLabel: string;
  category?: string;
  confidenceScore?: number;
  netMarginPct?: number;
  campaignCount?: number | null;
  supportingMetrics?: { label: string; value: string }[];
  observationPeriodDays?: number | null;
}) {
  return calculateDecisionImpactFromInputs(input, {
    netMarginPct: input.netMarginPct ?? null,
    orders: 0,
  } as import("@/lib/calculations/kpis/engine").BusinessKPIs);
}

export function calculateDecisionImpactFromRecommendation(
  rec: Pick<Recommendation, "expectedImpact" | "category" | "confidenceScore" | "supportingMetrics">,
  netMarginPct?: number,
  extras?: { campaignCount?: number | null; observationPeriodDays?: number | null },
) {
  return calculateDecisionImpactFromInputs(
    {
      expectedImpactLabel: rec.expectedImpact,
      category: rec.category,
      confidenceScore: rec.confidenceScore,
      netMarginPct,
      supportingMetrics: rec.supportingMetrics,
      campaignCount: extras?.campaignCount,
      observationPeriodDays: extras?.observationPeriodDays,
    },
    { netMarginPct: netMarginPct ?? null, orders: 0 } as import("@/lib/calculations/kpis/engine").BusinessKPIs,
  );
}
