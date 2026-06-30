import type {
  BusinessHealthDashboard,
  BusinessHealthDomain,
  BusinessHealthTrend,
  DomainTrend,
  HealthExecutiveSummary,
  HealthOverallCard,
} from "./types";

function defaultOverallTrend(): BusinessHealthTrend {
  return {
    direction: "stable",
    label: "Stable",
    detail: "Trend data unavailable",
    deltaPoints: null,
  };
}

function defaultDomainTrend(domainId?: string): DomainTrend {
  return {
    windowLabel: domainId === "marketing" ? "7-Day Trend" : "30-Day Trend",
    direction: "stable",
    label: "Stable",
    deltaPoints: null,
  };
}

function statusEmoji(score: number): string {
  if (score >= 70) return "🟢";
  if (score >= 45) return "🟡";
  return "🔴";
}

type LegacyDashboard = Partial<BusinessHealthDashboard> & {
  overallScore?: number;
  overallLabel?: string;
  trend?: BusinessHealthTrend;
  domains?: Array<
    Partial<BusinessHealthDomain> & {
      detail?: string;
    }
  >;
};

/** Coerce legacy / partial payloads into the current dashboard shape. */
export function normalizeBusinessHealthDashboard(input: LegacyDashboard): BusinessHealthDashboard {
  const legacyTrend = input.overall?.trend ?? input.trend ?? defaultOverallTrend();
  const score = input.overall?.score ?? input.overallScore ?? 0;

  const overall: HealthOverallCard = {
    score,
    maxScore: input.overall?.maxScore ?? 100,
    label: input.overall?.label ?? input.overallLabel ?? "Fair",
    statusEmoji: input.overall?.statusEmoji ?? statusEmoji(score),
    primaryIssue: input.overall?.primaryIssue ?? "Profitability",
    biggestOpportunity: input.overall?.biggestOpportunity ?? "Advertising optimization",
    trend: legacyTrend,
    lastUpdated: input.overall?.lastUpdated ?? input.generatedAt ?? new Date().toISOString(),
  };

  const domains: BusinessHealthDomain[] = (input.domains ?? []).map((d) => ({
    id: d.id ?? "unknown",
    label: d.label ?? "Unknown",
    score: d.score ?? 0,
    status: d.status ?? "warning",
    why: d.why ?? d.detail ?? "",
    recommendedAction: d.recommendedAction ?? "Review this area in Analytics.",
    estimatedImpact: d.estimatedImpact ?? null,
    estimatedImpactMonthly: d.estimatedImpactMonthly ?? null,
    trend: d.trend ?? defaultDomainTrend(d.id),
  }));

  const executiveSummary: HealthExecutiveSummary = input.executiveSummary ?? {
    headline: "Today's Health Summary",
    narrative: "Store health overview based on synced business data.",
    highestPriority: domains[0]?.recommendedAction ?? "Review recommendations",
    estimatedMonthlyImprovement: null,
    estimatedMonthlyImprovementValue: null,
  };

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    storeId: input.storeId ?? "",
    overall,
    executiveSummary,
    breakdown:
      input.breakdown ??
      domains.map((d) => ({ id: d.id, label: d.label, score: d.score })),
    domains,
    history: input.history ?? [],
    benchmark: input.benchmark ?? null,
    riskDistribution: input.riskDistribution ?? {
      critical: domains.filter((d) => d.status === "critical").length,
      warning: domains.filter((d) => d.status === "warning").length,
      healthy: domains.filter((d) => d.status === "healthy").length,
      limited: domains.filter((d) => d.status === "limited").length,
    },
    actionPlan: input.actionPlan ?? [],
  };
}
