import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { Opportunity, Recommendation } from "@/lib/types";
import { buildGa4Insights } from "./ga4";
import { buildCrossChannelInsights, buildGoogleAdsInsights } from "./google-ads";
import { buildKlaviyoInsights } from "./klaviyo";
import { buildMerchantCenterInsights } from "./merchant-center";
import { buildMetaAdsInsights } from "./meta-ads";
import {
  createCommerceOpportunity,
  sortCommerceOpportunities,
  type CommerceOpportunity,
} from "./opportunity-schema";
import { buildShopifyInsights } from "./shopify";
import { groupCommerceOpportunities } from "./business-action-groups";
import { filterOpportunitiesWithEvidence } from "./registry";
import type { StoreInsight } from "./types";

function severityToPriority(severity: CommerceOpportunity["severity"]): StoreInsight["priority"] {
  return severity;
}

export function commerceOpportunityToStoreInsight(opp: CommerceOpportunity): StoreInsight {
  return {
    id: opp.id,
    priority: severityToPriority(opp.severity),
    category: opp.category,
    title: opp.title,
    summary: opp.description,
    recommendation: opp.recommendation,
    confidence: opp.confidence,
    why: opp.why,
    evidence: opp.supportingMetrics,
    relatedEntityType:
      opp.relatedEntityType === "collection" || opp.relatedEntityType === "audience"
        ? undefined
        : opp.relatedEntityType,
    relatedEntityId: opp.relatedEntityId,
    futureAction: opp.futureAction,
  };
}

export function buildCommerceOpportunities(
  snapshot: StoreSnapshot,
  profitDashboard?: ProfitDashboard | null,
  extraOpportunities: Opportunity[] = [],
): CommerceOpportunity[] {
  const byId = new Map<string, CommerceOpportunity>();

  const all = [
    ...buildGoogleAdsInsights(snapshot),
    ...buildCrossChannelInsights(snapshot, profitDashboard),
    ...buildMetaAdsInsights(snapshot),
    ...buildShopifyInsights(snapshot, profitDashboard),
    ...buildGa4Insights(snapshot),
    ...buildKlaviyoInsights(snapshot),
    ...buildMerchantCenterInsights(snapshot),
    ...opportunitiesToCommerce(extraOpportunities),
  ];

  for (const opp of all) {
    if (!byId.has(opp.id) && filterOpportunitiesWithEvidence([opp]).length > 0) {
      byId.set(opp.id, opp);
    }
  }

  return sortCommerceOpportunities(groupCommerceOpportunities([...byId.values()]));
}

function opportunitiesToCommerce(opportunities: Opportunity[]): CommerceOpportunity[] {
  return opportunities.slice(0, 6).map((opp) =>
    createCommerceOpportunity({
      id: `profit-opp-${opp.id}`,
      source: "shopify",
      severity:
        opp.confidenceScore >= 0.85 ? "high" : opp.confidenceScore >= 0.7 ? "medium" : "low",
      confidence: Math.round(opp.confidenceScore * 100),
      title: opp.title,
      description: opp.description,
      recommendation: opp.requiredActions[0] ?? "Review in Approval Center.",
      category:
        opp.category === "advertising_efficiency"
          ? "campaign_performance"
          : opp.category === "inventory"
            ? "inventory"
            : "pricing",
      supportingMetrics: opp.evidence,
      expectedImpact: {
        profitMonthly: opp.estimatedMonthlyNetProfitImpact,
        label: `$${opp.estimatedMonthlyNetProfitImpact.toLocaleString()}/mo est. net profit`,
      },
      futureAction: opp.adEfficiencyAction,
    }),
  );
}

/** @deprecated Use buildCommerceOpportunities — kept for backward compatibility */
export function buildStoreInsights(
  snapshot: StoreSnapshot,
  profitDashboard?: ProfitDashboard | null,
): StoreInsight[] {
  return buildCommerceOpportunities(snapshot, profitDashboard).map(commerceOpportunityToStoreInsight);
}

export function insightsFromRecommendations(recommendations: Recommendation[]): StoreInsight[] {
  return recommendations.slice(0, 6).map((rec) => ({
    id: `insight-rec-${rec.id}`,
    priority: rec.severity,
    category: rec.category === "campaign_review" ? "campaign_performance" : "pricing",
    title: rec.title,
    summary: rec.reason,
    recommendation: rec.expectedImpact,
    confidence: Math.round(rec.confidenceScore * 100),
    why: rec.supportingMetrics.slice(0, 4),
    evidence: rec.supportingMetrics,
    relatedEntityType: rec.entityType === "campaign" ? "campaign" : undefined,
    relatedEntityId: rec.entityId,
  }));
}

export function insightsFromOpportunities(opportunities: Opportunity[]): StoreInsight[] {
  return opportunitiesToCommerce(opportunities).map(commerceOpportunityToStoreInsight);
}
