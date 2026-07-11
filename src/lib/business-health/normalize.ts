import type {
  BusinessHealthDashboard,
  BusinessHealthDomain,
  BusinessHealthTrend,
  DomainTrend,
  ExecutiveDecision,
  HealthExecutiveSummary,
  HealthOverallCard,
} from "./types";
import type { BusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";
import { FINANCIAL_IMPACT_LABELS } from "./domain-guidance";

function fallbackRiskAssessment(primaryIssue: string): BusinessRiskAssessment {
  return {
    executiveBriefing: `Your top priority today is ${primaryIssue.toLowerCase()}. Open each health area below for detailed actions.`,
    categories: [],
    primaryRisk: {
      category: "operations",
      title: "Business Risk Review",
      reason: primaryIssue,
      businessConsequence: primaryIssue,
      urgency: "Medium",
      timeHorizon: "This week",
      estimatedExposureMonthly: 0,
      estimatedExposureDisplay: "See area breakdown below",
      confidencePct: 70,
      probabilityPct: 70,
      recommendedAction: "Address the highest-priority health area first.",
      rankingRationale: "Prioritized from synced store health signals.",
      supportingFactors: [],
      crossBusinessEffects: [],
      riskTimeline: [],
      inactionImpact: [],
      businessImpact: "Medium",
    },
    whyNotOtherRisks: [],
    recommendationSteps: [],
    estimatedExposure: { items: [], totalMonthly: 0 },
  };
}

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

type LegacyDashboard = Partial<Omit<BusinessHealthDashboard, "domains">> & {
  overallScore?: number;
  overallLabel?: string;
  trend?: BusinessHealthTrend;
  domains?: Array<
    Partial<BusinessHealthDomain> & {
      detail?: string;
      why?: string;
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

  const domains: BusinessHealthDomain[] = (input.domains ?? []).map((d) => {
    const currentSituation = d.currentSituation ?? d.why ?? d.detail ?? "";
    return {
      id: d.id ?? "unknown",
      label: d.label ?? "Unknown",
      score: d.score ?? 0,
      status: d.status ?? "warning",
      currentSituation,
      whyItMatters: d.whyItMatters ?? "This area affects overall business performance.",
      recommendedAction: d.recommendedAction ?? "Review this area in Analytics.",
      expectedOutcome: d.expectedOutcome ?? "Measurable improvement in this area.",
      financialImpactType: d.financialImpactType ?? "profit_recovery",
      estimatedImpact: d.estimatedImpact ?? null,
      estimatedImpactMonthly: d.estimatedImpactMonthly ?? null,
      inactionConsequence: d.inactionConsequence ?? null,
      trend: d.trend ?? defaultDomainTrend(d.id),
      why: currentSituation,
    };
  });

  const executiveSummary: HealthExecutiveSummary = input.executiveSummary ?? {
    headline: "Executive Summary",
    narrative: "Store health overview based on synced business data.",
    highestPriority: domains[0]?.recommendedAction ?? "Review recommendations",
    estimatedMonthlyImprovement: null,
    estimatedMonthlyImprovementValue: null,
    briefingParagraphs: ["Store health overview based on synced business data."],
  };

  const breakdown =
    input.breakdown ??
    domains.map((d) => ({
      id: d.id,
      label: d.label,
      score: d.score,
      weightPct: Math.round(100 / Math.max(domains.length, 1)),
    }));

  const executiveDecision: ExecutiveDecision = input.executiveDecision ?? {
    title: "Today's Executive Decision",
    decision: executiveSummary.highestPriority,
    reason: overall.primaryIssue,
    estimatedBenefit: executiveSummary.estimatedMonthlyImprovement
      ? `Estimated benefit of ${executiveSummary.estimatedMonthlyImprovement}/month.`
      : "Address the highest-priority issue first.",
    estimatedBenefitMonthly: executiveSummary.estimatedMonthlyImprovementValue,
  };

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    storeId: input.storeId ?? "",
    overall,
    executiveSummary,
    breakdown,
    domains,
    history: input.history ?? [],
    benchmark: input.benchmark ?? null,
    riskDistribution: input.riskDistribution ?? {
      critical: domains.filter((d) => d.status === "critical").length,
      warning: domains.filter((d) => d.status === "warning").length,
      healthy: domains.filter((d) => d.status === "healthy").length,
      limited: domains.filter((d) => d.status === "limited").length,
    },
    actionPlan: (input.actionPlan ?? []).map((item) => ({
      difficulty: "Medium" as const,
      timeRequired: "1–2 weeks",
      confidence: "75%",
      timeUntilResults: "2–4 weeks",
      financialImpactType: item.financialImpactType ?? "profit_recovery",
      ...item,
      impactLabel:
        item.impactLabel ??
        (item.impactMonthly != null && item.impactMonthly > 0
          ? `+$${item.impactMonthly.toLocaleString()}/month`
          : "Unlock intelligence"),
    })),
    strengths: input.strengths ?? [],
    executiveDecision,
    riskAssessment: input.riskAssessment ?? fallbackRiskAssessment(overall.primaryIssue),
  };
}

export { FINANCIAL_IMPACT_LABELS };
