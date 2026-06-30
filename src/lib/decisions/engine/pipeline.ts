import { buildDecisionCenter } from "@/lib/decisions/center";
import { collectGroupedProductIds } from "@/lib/insights/business-action-groups";
import { scoreStrategyForMode } from "@/lib/decisions/merchant-mode";
import { filterDecisionsByPack } from "@/lib/decision-packs/registry";
import { applyDnaPersonalizationToDecisions } from "@/lib/merchant-dna/personalization";
import { buildDecisionConfidenceBreakdown } from "./confidence-breakdown";
import { computeDecisionExplainability } from "./explainability-score";
import { formatModeWeights } from "./mode-weights";
import {
  filterShadowedByGroupedDeadInventory,
  mergeDuplicateDecisions,
} from "./merge";
import { buildStrategyWinnerExplanation } from "./strategy-explanation";
import type { DecisionEngineInput, EnrichedDecisionItem } from "./types";

/**
 * Decision Engine pipeline:
 * Provider Data → Validation → Verified Snapshot → Analyzers → Decision Center
 * → Merge duplicates → Strategy enrichment → Confidence / Explainability
 */
export function buildDecisionEngine(input: DecisionEngineInput): EnrichedDecisionItem[] {
  const groupedProductIds = collectGroupedProductIds(input.opportunities);
  const raw = buildDecisionCenter(input);
  const filtered = filterShadowedByGroupedDeadInventory(raw, groupedProductIds);
  const merged = mergeDuplicateDecisions(filtered);

  const mode = input.merchantMode ?? "profit";
  const strategies = input.profitStrategiesByProductId ?? new Map();
  const modeWeights = formatModeWeights(mode);
  const packContext = input.decisionPackContext;
  const businessModel = input.businessProfile?.businessModel ?? packContext?.businessModel;
  const promptContext = packContext?.promptContext;

  const enriched = merged.map((item) => {
    const productId =
      item.entityType === "product" ? item.entityId : undefined;
    const strategyComparison = productId ? strategies.get(productId) : undefined;
    const confidenceBreakdown = buildDecisionConfidenceBreakdown(item);
    const explainability = computeDecisionExplainability({ item, strategyComparison });
    const strategyExplanation = strategyComparison
      ? buildStrategyWinnerExplanation(strategyComparison)
      : undefined;
    const profitWaterfall = strategyComparison?.recommended.waterfall;

    let priorityScore = item.priorityScore;
    if (strategyComparison) {
      const modeScore = scoreStrategyForMode(mode, {
        netProfit: strategyComparison.recommended.expectedNetProfit,
        revenue: strategyComparison.recommended.expectedRevenue,
        inventoryReduction: strategyComparison.recommended.inventoryReduction,
        cashRecovery: strategyComparison.recommended.cashFlowImpact,
        unitsSold: strategyComparison.recommended.expectedUnitsSold,
        roasImpact: strategyComparison.recommended.roasImpact,
      });
      priorityScore = Math.round(item.priorityScore + modeScore / 100);
    }

    return {
      ...item,
      priorityScore,
      confidencePct: confidenceBreakdown.overallPct,
      strategyComparison,
      confidenceBreakdown,
      explainability,
      profitWaterfall,
      modeWeights,
      merchantMode: mode,
      businessModel,
      businessModelPack: packContext?.pack.label,
      businessModelPromptContext: promptContext,
      strategyExplanation,
      recommendedAction: strategyExplanation?.recommendedLabel ?? item.recommendedAction,
      why: promptContext
        ? `${strategyExplanation?.narrative ?? item.why}\n\n${promptContext}`
        : strategyExplanation?.narrative ?? item.why,
    };
  });

  const modelFiltered = packContext
    ? filterDecisionsByPack(enriched, packContext.pack)
    : enriched;

  const withDna = input.merchantDna
    ? applyDnaPersonalizationToDecisions(modelFiltered, input.merchantDna).map((item) => ({
        ...item,
        merchantDna: input.merchantDna,
      }))
    : modelFiltered;

  return withDna.sort((a, b) => {
    const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
    return (
      SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority] ||
      b.priorityScore - a.priorityScore ||
      (b.explainability?.scorePct ?? 0) - (a.explainability?.scorePct ?? 0)
    );
  });
}

export { buildDecisionCenter };
