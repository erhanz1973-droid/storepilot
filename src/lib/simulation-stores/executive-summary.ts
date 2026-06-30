import { buildDashboard } from "@/lib/services/dashboard";
import { getScenarioById } from "@/lib/simulation-lab/scenarios";
import { listSimulationStores } from "./db";
import type {
  SimulationExecutiveSummary,
  SimulationProblemItem,
  SimulationRecommendationItem,
} from "./executive-summary-types";

function healthLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 55) return "Fair";
  return "At Risk";
}

function severityRank(s: string): number {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return order[s.toLowerCase()] ?? 4;
}

function buildProblems(dashboard: Awaited<ReturnType<typeof buildDashboard>>): SimulationProblemItem[] {
  const items: SimulationProblemItem[] = [];

  for (const alert of dashboard.autopilotDashboard?.alerts ?? []) {
    items.push({
      title: alert.title,
      description: alert.reason,
      severity: alert.severity.toLowerCase() as SimulationProblemItem["severity"],
    });
  }

  for (const rec of dashboard.criticalAlerts ?? []) {
    items.push({
      title: rec.title.replace(/^[^:]+:\s*/, ""),
      description: rec.reason,
      severity: "critical",
    });
  }

  const seen = new Set<string>();
  return items
    .filter((p) => {
      const key = p.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 3);
}

function buildRecommendations(
  dashboard: Awaited<ReturnType<typeof buildDashboard>>,
): SimulationRecommendationItem[] {
  const actions = dashboard.autopilotDashboard?.actions ?? [];

  if (actions.length > 0) {
    return actions.slice(0, 3).map((a) => ({
      title: a.title,
      description: a.description,
      expectedMonthlyImpact: a.expectedNetProfitGain,
      confidencePct: Math.round(a.confidenceScore * 100),
      actionLabel: a.actionLabel,
    }));
  }

  return (dashboard.topOpportunities ?? []).slice(0, 3).map((o) => ({
    title: o.title,
    description: o.description,
    expectedMonthlyImpact: o.estimatedMonthlyNetProfitImpact,
    confidencePct: Math.round(o.confidenceScore * 100),
    actionLabel: "Review opportunity",
  }));
}

function estimateMonthlyLoss(
  problems: SimulationProblemItem[],
  recovery: number,
  netProfit30d: number,
): number {
  const criticalCount = problems.filter((p) => p.severity === "critical").length;
  if (recovery > 0 && criticalCount > 0) {
    return Math.round(recovery * (1.2 + criticalCount * 0.15));
  }
  if (netProfit30d < 0) {
    return Math.round(Math.abs(netProfit30d));
  }
  return Math.round(Math.max(recovery * 1.35, criticalCount * 2500));
}

function buildNarrative(input: {
  scenarioLabel: string;
  healthScore: number;
  healthLabel: string;
  headline: string;
  criticalIssueCount: number;
  netProfit30d: number;
  blendedRoas: number | null;
}): string {
  const roasLine =
    input.blendedRoas != null
      ? ` Blended ROAS is ${input.blendedRoas.toFixed(2)}.`
      : "";
  const profitLine =
    input.netProfit30d >= 0
      ? ` Estimated 30-day net profit is $${input.netProfit30d.toLocaleString()}.`
      : ` The store is running at an estimated monthly loss of $${Math.abs(input.netProfit30d).toLocaleString()}.`;

  return (
    `${input.scenarioLabel} scenario — Store Health ${input.healthScore}/100 (${input.healthLabel}). ` +
    `${input.headline} ` +
    `${input.criticalIssueCount} critical issue${input.criticalIssueCount === 1 ? "" : "s"} need attention.` +
    profitLine +
    roasLine
  );
}

export async function buildSimulationExecutiveSummary(
  storeId: string,
): Promise<SimulationExecutiveSummary> {
  const stores = await listSimulationStores();
  const store = stores.find((s) => s.storeId === storeId);
  const scenarioId = store?.scenarioId ?? "healthy_store";
  const scenario = getScenarioById(scenarioId);
  const scenarioLabel = scenario?.label ?? store?.label ?? "Simulation Store";

  const dashboard = await buildDashboard(storeId);
  const healthScore = dashboard.storeHealthScore ?? dashboard.storeHealth?.score ?? 0;
  const problems = buildProblems(dashboard);
  const recommendations = buildRecommendations(dashboard);
  const topRec = recommendations[0] ?? null;
  const recovery = topRec?.expectedMonthlyImpact ?? 0;
  const criticalFromProblems = problems.filter((p) => p.severity === "critical").length;
  const criticalIssueCount = Math.max(
    criticalFromProblems,
    dashboard.criticalAlerts?.length ?? 0,
    problems.length,
  );
  const netProfit30d = dashboard.profitDashboard?.primary.netProfit ?? 0;
  const blendedRoas = dashboard.profitDashboard?.blendedRoas?.blendedRoas30d ?? null;
  const headline =
    dashboard.autopilotDashboard?.executiveBrief.headline ??
    dashboard.aiBrief?.revenueOpportunitySummary ??
    "Review prioritized actions to protect profit.";

  const confidences = recommendations.map((r) => r.confidencePct);
  const confidencePct =
    confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : (dashboard.autopilotDashboard?.executiveBrief.confidencePct ?? 75);

  return {
    storeId,
    storeLabel: store?.label ?? scenarioLabel,
    scenarioId,
    scenarioLabel,
    generatedAt: new Date().toISOString(),
    healthScore,
    healthLabel: dashboard.storeHealth?.label ?? healthLabel(healthScore),
    headline,
    narrative: buildNarrative({
      scenarioLabel,
      healthScore,
      healthLabel: healthLabel(healthScore),
      headline,
      criticalIssueCount,
      netProfit30d,
      blendedRoas,
    }),
    criticalIssueCount,
    topProblems: problems,
    topRecommendations: recommendations,
    estimatedMonthlyLoss: estimateMonthlyLoss(problems, recovery, netProfit30d),
    estimatedMonthlyRecovery: recovery,
    topRecommendationTitle: topRec?.title ?? null,
    confidencePct,
    revenue30d: dashboard.profitDashboard?.primary.revenue ?? 0,
    netProfit30d,
    blendedRoas,
  };
}
