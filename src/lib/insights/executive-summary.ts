import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { DataSourceStatus } from "@/lib/types";
import type { CommerceOpportunity } from "./opportunity-schema";
import type { TrendAnalysis } from "./types";

export type ExecutiveSummary = {
  headline: string;
  storeHealthScore: number;
  revenue30d: number;
  revenueChangePct: number | null;
  profit30d: number;
  profitChangePct: number | null;
  roas: number;
  roasChangePct: number | null;
  criticalIssueCount: number;
  opportunityCount: number;
  topRecommendation: CommerceOpportunity | null;
  lastSyncAt: string;
  lastSyncStatus: "healthy" | "stale" | "error";
};

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function computeHealthScore(input: {
  criticalCount: number;
  opportunityCount: number;
  syncStatus: ExecutiveSummary["lastSyncStatus"];
  marginPct: number;
}): number {
  let score = 78;
  score -= input.criticalCount * 12;
  score += Math.min(input.opportunityCount, 8) * 2;
  if (input.syncStatus === "error") score -= 15;
  if (input.syncStatus === "stale") score -= 8;
  if (input.marginPct >= 25) score += 8;
  if (input.marginPct < 15) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildExecutiveSummary(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  opportunities: CommerceOpportunity[];
  storeHealthScore?: number;
  dataSources: DataSourceStatus[];
  trends: TrendAnalysis;
}): ExecutiveSummary {
  const { snapshot, profitDashboard, opportunities, dataSources, trends } = input;
  const criticalIssueCount = opportunities.filter((o) => o.severity === "critical").length;
  const revenueMetric = trends.metrics.find((m) => m.id === "revenue_7d");
  const profitMetric = trends.metrics.find((m) => m.id === "profit_7d");
  const roasMetric = trends.metrics.find((m) => m.id === "roas_7d");

  const revenue30d = snapshot.storeMetrics.revenue30d;
  const profit30d = profitDashboard?.primary.netProfit ?? revenue30d * 0.25;
  const spend7d =
    snapshot.adSpendSnapshot?.totalRollups.last7d.spend ??
    snapshot.googleAdsSnapshot?.rollups.last7d.spend ??
    0;
  const rev7d =
    snapshot.adSpendSnapshot?.totalRollups.last7d.attributedRevenue ?? revenue30d / 4;
  const roas =
    profitDashboard?.blendedRoas?.blendedRoas30d ??
    (spend7d > 0 ? rev7d / spend7d : 0);

  const hasError = dataSources.some((d) => d.status === "error");
  const stale = dataSources.some((d) => {
    if (!d.lastSyncAt) return true;
    const hours = (Date.now() - new Date(d.lastSyncAt).getTime()) / 3600000;
    return hours > 26;
  });
  const lastSyncStatus: ExecutiveSummary["lastSyncStatus"] = hasError
    ? "error"
    : stale
      ? "stale"
      : "healthy";

  const marginPct = profitDashboard?.primary.profitMarginPct ?? 20;
  const storeHealthScore =
    input.storeHealthScore ??
    computeHealthScore({
      criticalCount: criticalIssueCount,
      opportunityCount: opportunities.length,
      syncStatus: lastSyncStatus,
      marginPct,
    });

  const topRecommendation = opportunities[0] ?? null;

  return {
    headline: "How is my business today?",
    storeHealthScore,
    revenue30d,
    revenueChangePct: revenueMetric?.changePct ?? null,
    profit30d,
    profitChangePct: profitMetric?.changePct ?? null,
    roas: Math.round(roas * 100) / 100,
    roasChangePct: roasMetric?.changePct ?? null,
    criticalIssueCount,
    opportunityCount: opportunities.length,
    topRecommendation,
    lastSyncAt: snapshot.syncedAt,
    lastSyncStatus,
  };
}
