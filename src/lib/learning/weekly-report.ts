import { listOutcomeHistory, listStoredRecommendations } from "@/lib/db/learning";
import { getWeeklyReport, saveWeeklyReport } from "@/lib/db/weekly-reports";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import type { AttributionDashboard } from "@/lib/attribution/models";
import type { Opportunity, Recommendation, WeeklyAiReport } from "@/lib/types";
import { DEMO_STORE_ID } from "@/lib/types";
import type { StoreSnapshot } from "@/lib/connectors/types";

function weekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

function weekEnd(weekStartStr: string): string {
  const d = new Date(weekStartStr);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

export async function generateWeeklyAiReport(
  storeId = DEMO_STORE_ID,
  context?: {
    snapshot?: StoreSnapshot;
    profitDashboard?: ProfitDashboard | null;
    productIntelligence?: ProductIntelligenceDashboard | null;
    attributionDashboard?: AttributionDashboard | null;
    topOpportunities?: Opportunity[];
    activeRecommendations?: Recommendation[];
  },
): Promise<WeeklyAiReport> {
  const now = new Date();
  const currentWeekStart = weekStart(now);

  const cached = await getWeeklyReport(storeId, currentWeekStart);
  if (cached && new Date(cached.generatedAt).getTime() > now.getTime() - 3600000) {
    return cached;
  }

  const allRecs = await listStoredRecommendations(storeId);
  const outcomes = await listOutcomeHistory(storeId);

  const weekStartMs = new Date(currentWeekStart).getTime();
  const weekEndMs = weekStartMs + 7 * 86400000;

  const measuredThisWeek = allRecs.filter((r) => {
    if (!r.measuredAt) return false;
    const t = new Date(r.measuredAt).getTime();
    return t >= weekStartMs && t < weekEndMs;
  });

  const completedThisWeek = allRecs.filter((r) => {
    if (!r.completedAt) return false;
    const t = new Date(r.completedAt).getTime();
    return t >= weekStartMs && t < weekEndMs;
  });

  const resolvedThisWeek = allRecs.filter((r) => {
    if (r.status !== "measured" && r.status !== "implemented") return false;
    const t = new Date(r.measuredAt ?? r.implementedAt ?? r.completedAt ?? "").getTime();
    return t >= weekStartMs && t < weekEndMs;
  });

  const measuredWithAccuracy = measuredThisWeek.filter(
    (r) => (r.predictionAccuracy ?? 0) > 0,
  );

  const bestPerforming =
    measuredWithAccuracy.length > 0
      ? measuredWithAccuracy.reduce((best, r) =>
          (r.predictionAccuracy ?? 0) > (best.predictionAccuracy ?? 0) ? r : best,
        )
      : null;

  const worstPrediction =
    measuredWithAccuracy.length > 1
      ? measuredWithAccuracy.reduce((worst, r) =>
          (r.predictionAccuracy ?? 100) < (worst.predictionAccuracy ?? 100) ? r : worst,
        )
      : null;

  const accuracyTrend = buildAccuracyTrend(outcomes, 4);

  const overallAccuracy =
    measuredWithAccuracy.length > 0
      ? Math.round(
          measuredWithAccuracy.reduce((s, r) => s + (r.predictionAccuracy ?? 0), 0) /
            measuredWithAccuracy.length,
        )
      : accuracyTrend.length > 0
        ? accuracyTrend[accuracyTrend.length - 1].accuracy
        : 0;

  const profit = context?.profitDashboard;
  const products = context?.productIntelligence;
  const attribution = context?.attributionDashboard;
  const snapshot = context?.snapshot;
  const opportunities = context?.topOpportunities ?? [];

  const bestProducts = products
    ? [...products.products]
        .sort((a, b) => b.netProfit - a.netProfit)
        .slice(0, 3)
        .map((p) => ({ title: p.title, profit: Math.round(p.netProfit) }))
    : [];

  const worstCampaigns = (snapshot?.campaigns ?? [])
    .filter((c) => c.status === "ACTIVE" && c.roas7d != null)
    .sort((a, b) => (a.roas7d ?? 0) - (b.roas7d ?? 0))
    .reduce<{ id: string; name: string; roas: number }[]>((acc, c) => {
      if (acc.some((x) => x.id === c.id || x.name === c.name)) return acc;
      acc.push({
        id: c.id,
        name: c.name,
        roas: Math.round((c.roas7d ?? 0) * 100) / 100,
      });
      return acc;
    }, [])
    .slice(0, 3);

  const biggestOpportunities = opportunities
    .slice(0, 3)
    .map((o) => ({
      title: o.title,
      profitImpact: o.estimatedMonthlyNetProfitImpact,
    }));

  const resolvedIssues = resolvedThisWeek
    .map((r) => r.title.replace(/^[^:]+:\s*/, ""))
    .slice(0, 5);

  const topRec =
    context?.activeRecommendations?.[0] ??
    allRecs.find((r) => (r.status ?? "pending") === "pending");

  const revenue30d = profit?.primary.revenue ?? snapshot?.storeMetrics.revenue30d;
  const profit30d = profit?.primary.netProfit ?? undefined;
  const roas30d = profit?.blendedRoas?.blendedRoas30d ?? null;

  const executiveSummary = buildExecutiveSummary({
    revenue30d,
    profit30d,
    roas30d,
    bestProducts,
    worstCampaigns,
    biggestOpportunities,
    resolvedIssues,
    topRecommendation: topRec?.title.replace(/^[^:]+:\s*/, "") ?? null,
    overallAccuracy,
    completedCount: completedThisWeek.length,
  });

  const report: WeeklyAiReport = {
    weekStart: currentWeekStart,
    weekEnd: weekEnd(currentWeekStart),
    recommendationsCompleted: completedThisWeek.length,
    recommendationsMeasured: measuredThisWeek.length,
    bestPerforming: bestPerforming
      ? {
          title: bestPerforming.title.replace(/^[^:]+:\s*/, ""),
          accuracy: bestPerforming.predictionAccuracy ?? 0,
          actualImpact: bestPerforming.actualImpact ?? "—",
        }
      : null,
    worstPrediction: worstPrediction
      ? {
          title: worstPrediction.title.replace(/^[^:]+:\s*/, ""),
          accuracy: worstPrediction.predictionAccuracy ?? 0,
          expectedImpact: worstPrediction.expectedImpact,
          actualImpact: worstPrediction.actualImpact ?? "—",
        }
      : null,
    accuracyTrend,
    overallAccuracy,
    generatedAt: now.toISOString(),
    revenue30d,
    profit30d,
    roas30d,
    bestProducts,
    worstCampaigns,
    biggestOpportunities,
    resolvedIssues,
    topRecommendationNextWeek: topRec?.title.replace(/^[^:]+:\s*/, "") ?? null,
    executiveSummary,
  };

  await saveWeeklyReport(storeId, currentWeekStart, report);
  return report;
}

function buildExecutiveSummary(input: {
  revenue30d?: number;
  profit30d?: number;
  roas30d?: number | null;
  bestProducts: { title: string; profit: number }[];
  worstCampaigns: { id?: string; name: string; roas: number }[];
  biggestOpportunities: { title: string; profitImpact: number }[];
  resolvedIssues: string[];
  topRecommendation: string | null;
  overallAccuracy: number;
  completedCount: number;
}): string[] {
  const lines: string[] = [];

  if (input.revenue30d != null) {
    lines.push(`Revenue (30d): $${Math.round(input.revenue30d).toLocaleString()}`);
  }
  if (input.profit30d != null) {
    lines.push(`Net profit (30d): $${Math.round(input.profit30d).toLocaleString()}`);
  }
  if (input.roas30d != null) {
    lines.push(`Blended ROAS: ${input.roas30d.toFixed(2)}`);
  }
  if (input.bestProducts.length > 0) {
    lines.push(
      `Top product: ${input.bestProducts[0].title} ($${input.bestProducts[0].profit.toLocaleString()} profit)`,
    );
  }
  if (input.worstCampaigns.length > 0) {
    lines.push(
      `Weakest campaign: ${input.worstCampaigns[0].name} (ROAS ${input.worstCampaigns[0].roas})`,
    );
  }
  if (input.biggestOpportunities.length > 0) {
    lines.push(
      `Biggest opportunity: ${input.biggestOpportunities[0].title} (+$${input.biggestOpportunities[0].profitImpact.toLocaleString()}/mo)`,
    );
  }
  if (input.resolvedIssues.length > 0) {
    lines.push(`Resolved ${input.resolvedIssues.length} issue(s) this week.`);
  }
  if (input.topRecommendation) {
    lines.push(`Focus next week: ${input.topRecommendation}`);
  }
  lines.push(
    `AI accuracy: ${input.overallAccuracy}% · ${input.completedCount} recommendations completed`,
  );

  return lines;
}

function buildAccuracyTrend(
  outcomes: {
    measuredAt: string;
    predictionAccuracy: number;
  }[],
  weeks: number,
): { week: string; accuracy: number }[] {
  const trend: { week: string; accuracy: number }[] = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const ws = weekStart(d);
    const wsMs = new Date(ws).getTime();
    const weMs = wsMs + 7 * 86400000;

    const weekOutcomes = outcomes.filter((o) => {
      const t = new Date(o.measuredAt).getTime();
      return t >= wsMs && t < weMs;
    });

    if (weekOutcomes.length === 0) continue;

    const avg = Math.round(
      weekOutcomes.reduce((s, o) => s + o.predictionAccuracy, 0) / weekOutcomes.length,
    );
    trend.push({ week: ws, accuracy: avg });
  }

  return trend;
}

export function summarizeWeeklyReport(report: WeeklyAiReport): string[] {
  const lines: string[] = [
    `**Weekly AI Report** (${report.weekStart} – ${report.weekEnd})`,
    "",
    `• Recommendations completed: **${report.recommendationsCompleted}**`,
    `• Recommendations measured: **${report.recommendationsMeasured}**`,
    `• Overall prediction accuracy: **${report.overallAccuracy}%**`,
  ];

  if (report.revenue30d != null) {
    lines.push(`• Revenue (30d): **$${Math.round(report.revenue30d).toLocaleString()}**`);
  }
  if (report.profit30d != null) {
    lines.push(`• Net profit (30d): **$${Math.round(report.profit30d).toLocaleString()}**`);
  }
  if (report.roas30d != null) {
    lines.push(`• Blended ROAS: **${report.roas30d.toFixed(2)}**`);
  }

  if (report.bestPerforming) {
    lines.push(
      `• Best performing: **${report.bestPerforming.title}** (${report.bestPerforming.accuracy}% accuracy, ${report.bestPerforming.actualImpact})`,
    );
  }

  if (report.worstPrediction) {
    lines.push(
      `• Worst prediction: **${report.worstPrediction.title}** (${report.worstPrediction.accuracy}% accuracy)`,
    );
  }

  if (report.topRecommendationNextWeek) {
    lines.push(`• Top recommendation for next week: **${report.topRecommendationNextWeek}**`);
  }

  if (report.accuracyTrend.length >= 2) {
    const first = report.accuracyTrend[0].accuracy;
    const last = report.accuracyTrend[report.accuracyTrend.length - 1].accuracy;
    const dir = last >= first ? "improving" : "declining";
    lines.push(`• Accuracy trend: ${dir} over ${report.accuracyTrend.length} weeks`);
  }

  return lines;
}
