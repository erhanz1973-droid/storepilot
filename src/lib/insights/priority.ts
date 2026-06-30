import type { Opportunity, Recommendation } from "@/lib/types";
import type { CommerceOpportunity } from "./opportunity-schema";
import type { PriorityQueueItem } from "./types";
import { buildValidatedStoreInsight } from "@/lib/copilot/insight-engine";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { TrendAnalysis } from "./types";

const SEVERITY_RANK: Record<CommerceOpportunity["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function buildPriorityQueue(
  opportunities: CommerceOpportunity[],
  legacyOpportunities: Opportunity[],
  criticalAlerts: Recommendation[],
): PriorityQueueItem[] {
  const items: PriorityQueueItem[] = [];

  for (const opp of opportunities.slice(0, 12)) {
    items.push({
      id: `pq-${opp.id}`,
      priority: opp.severity,
      title: opp.title,
      summary: opp.description,
      confidence: opp.confidence,
      expectedImpactLabel: opp.expectedImpact.label,
      source: "insight",
      insightId: opp.id,
      opportunityId: opp.id,
      futureAction: opp.futureAction,
    });
  }

  for (const opp of legacyOpportunities.slice(0, 4)) {
    items.push({
      id: `pq-opp-${opp.id}`,
      priority:
        opp.confidenceScore >= 0.85 ? "high" : opp.confidenceScore >= 0.7 ? "medium" : "low",
      title: opp.title,
      summary: opp.description,
      confidence: Math.round(opp.confidenceScore * 100),
      expectedImpactLabel: `$${opp.estimatedMonthlyNetProfitImpact.toLocaleString()}/mo est. net profit`,
      source: "opportunity",
      opportunityId: opp.id,
      futureAction: opp.adEfficiencyAction,
    });
  }

  for (const alert of criticalAlerts) {
    items.push({
      id: `pq-alert-${alert.id}`,
      priority: "critical",
      title: alert.title,
      summary: alert.reason,
      confidence: Math.round(alert.confidenceScore * 100),
      expectedImpactLabel: alert.expectedImpact,
      source: "alert",
      recommendationId: alert.id,
    });
  }

  return items.sort(
    (a, b) =>
      SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority] ||
      b.confidence - a.confidence,
  );
}

export function generateDailyQuestion(
  queue: PriorityQueueItem[],
  opportunities: CommerceOpportunity[],
  insightContext?: {
    snapshot: StoreSnapshot;
    profitDashboard?: ProfitDashboard | null;
    trends?: TrendAnalysis | null;
  },
): string {
  if (insightContext) {
    const insight = buildValidatedStoreInsight({
      snapshot: insightContext.snapshot,
      profitDashboard: insightContext.profitDashboard,
      trends: insightContext.trends,
      opportunities,
    });
    if (insight.bottleneck !== "overview") {
      return insight.title;
    }
  }

  const top = queue[0];
  if (!top) {
    return "What should I do today to increase my store's profit?";
  }
  if (top.priority === "critical") {
    return `Urgent: ${top.title} — address this first to stop profit leakage.`;
  }
  const profitOpp = opportunities.find(
    (o) => o.category === "roas" || o.category === "spend_efficiency",
  );
  if (profitOpp) {
    return `Focus today: ${profitOpp.recommendation}`;
  }
  return `Top priority: ${top.title}`;
}
