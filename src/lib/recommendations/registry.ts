import type { AnalyzerOutput, Recommendation, RecommendationSeverity } from "@/lib/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { InventorySummary } from "@/lib/types";
import {
  computeInventoryHealthScore,
} from "@/lib/inventory/summary";
import { isConnectorActiveForAnalysis } from "@/lib/connectors/active";
import { applyValidationGateToOutputs } from "@/lib/recommendations/validation/evidence-builder";
import type { ValidationGateReport } from "@/lib/recommendations/validation/types";
import { bundlesAnalyzer } from "./bundles";
import { campaignsAnalyzer } from "./campaigns";
import { homepageAnalyzer } from "./homepage";
import { inventoryAnalyzer } from "./inventory";
import { pricingAnalyzer } from "./pricing";
import { promotionsAnalyzer } from "./promotions";
import { filterMeasurableRecommendations } from "./impact";
import type { RecommendationAnalyzerContext } from "./analyzer-context";
import type { RecommendationAnalyzer } from "./analyzer-types";
import { buildAnalyzerContext } from "./analyzer-context";
import { analyzerAllowedByPack, filterAnalyzerOutputs } from "@/lib/decision-packs/registry";
import type { DecisionPack } from "@/lib/decision-packs/types";

/** Auto-discovered recommendation modules */
export const RECOMMENDATION_ANALYZERS: RecommendationAnalyzer[] = [
  inventoryAnalyzer,
  pricingAnalyzer,
  bundlesAnalyzer,
  homepageAnalyzer,
  promotionsAnalyzer,
  campaignsAnalyzer,
];

function severityRank(severity: RecommendationSeverity): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[severity];
}

export function analyzerOutputToRecommendation(
  output: AnalyzerOutput,
  createdAt: string,
  uuid?: string,
): Recommendation {
  return {
    id: uuid ?? output.id,
    category: output.category,
    title: output.title,
    severity: output.priority,
    reason: output.description,
    expectedImpact: output.expectedImpact,
    confidenceScore: output.confidence,
    actionLabel: output.actions[0]?.label ?? "Review",
    supportingMetrics: output.evidence,
    entityType: output.entityType,
    entityId: output.entityId,
    createdAt,
  };
}

function shouldRunAnalyzer(
  analyzer: RecommendationAnalyzer,
  snapshot: StoreSnapshot,
): boolean {
  if (!analyzer.requiredConnectors?.length) return true;
  const states = snapshot.connectorStates ?? {};
  return analyzer.requiredConnectors.some((id) =>
    isConnectorActiveForAnalysis(id, states[id] ?? "disconnected"),
  );
}

export function runAllAnalyzers(
  snapshot: StoreSnapshot,
  context?: RecommendationAnalyzerContext,
): AnalyzerOutput[] {
  const outputs = RECOMMENDATION_ANALYZERS.flatMap((analyzer) =>
    shouldRunAnalyzer(analyzer, snapshot) ? analyzer.analyze(snapshot, context) : [],
  );
  return filterMeasurableRecommendations(outputs);
}

export function runValidatedAnalyzers(
  snapshot: StoreSnapshot,
  gate: ValidationGateReport,
  context?: RecommendationAnalyzerContext,
): AnalyzerOutput[] {
  const raw = runAllAnalyzers(snapshot, context);
  return applyValidationGateToOutputs(raw, gate, RECOMMENDATION_ANALYZERS);
}

export function runBusinessModelAwareAnalyzers(
  snapshot: StoreSnapshot,
  gate: ValidationGateReport,
  pack: DecisionPack,
  context?: RecommendationAnalyzerContext,
): AnalyzerOutput[] {
  const raw = RECOMMENDATION_ANALYZERS.flatMap((analyzer) => {
    if (!shouldRunAnalyzer(analyzer, snapshot)) return [];
    if (!analyzerAllowedByPack(analyzer, pack)) return [];
    return analyzer.analyze(snapshot, context);
  });
  const measurable = filterMeasurableRecommendations(raw);
  const packFiltered = filterAnalyzerOutputs(measurable, pack);
  return applyValidationGateToOutputs(packFiltered, gate, RECOMMENDATION_ANALYZERS);
}

export { buildAnalyzerContext };

export function generateRecommendations(snapshot: StoreSnapshot): Recommendation[] {
  const now = new Date().toISOString();
  const outputs = runAllAnalyzers(snapshot);
  return sortRecommendations(outputs.map((o) => analyzerOutputToRecommendation(o, now, o.id)));
}

export function sortRecommendations(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => {
    const sev = severityRank(a.severity) - severityRank(b.severity);
    if (sev !== 0) return sev;
    return b.confidenceScore - a.confidenceScore;
  });
}

export function computeHealthScore(
  recs: Recommendation[],
  inventorySummary?: InventorySummary,
  options?: { hasActiveAdsConnector?: boolean; hasActiveMetaCampaigns?: boolean },
): {
  score: number;
  breakdown: {
    inventory: number;
    merchandising: number;
    campaigns: number;
    promotions: number;
  };
} {
  const penalties = { critical: 18, high: 10, medium: 5, low: 2 };

  let inventoryRecPenalty = 0;
  let merchandisingPenalty = 0;
  let campaignsPenalty = 0;
  let promotionsPenalty = 0;

  const hasAds = options?.hasActiveAdsConnector ?? true;
  const scoreCampaigns = hasAds && (options?.hasActiveMetaCampaigns ?? true);
  const scoredRecs = scoreCampaigns
    ? recs
    : recs.filter((r) => r.category !== "campaign_review");

  for (const rec of scoredRecs) {
    const p = penalties[rec.severity];
    if (rec.category === "low_inventory" || rec.category === "slow_selling") {
      inventoryRecPenalty += p;
    } else if (rec.category === "homepage_merchandising") {
      merchandisingPenalty += p;
    } else if (rec.category === "campaign_review") {
      campaignsPenalty += p;
    } else {
      promotionsPenalty += p;
    }
  }

  const inventory = inventorySummary
    ? computeInventoryHealthScore(inventorySummary, inventoryRecPenalty)
    : Math.max(0, 100 - inventoryRecPenalty);

  const merchandising = Math.max(0, 100 - merchandisingPenalty);
  const campaigns = scoreCampaigns ? Math.max(0, 100 - campaignsPenalty) : 100;
  const promotions = Math.max(0, 100 - promotionsPenalty);
  const score = Math.round(
    inventory * 0.3 + merchandising * 0.2 + campaigns * 0.3 + promotions * 0.2,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: { inventory, merchandising, campaigns, promotions },
  };
}
