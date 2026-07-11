import type { BusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";
import type { BenchmarkRow, BusinessHealthDomain, BusinessStrength, ExecutiveDecision } from "./types";

export function buildBusinessStrengths(input: {
  domains: BusinessHealthDomain[];
  benchmarkRows: BenchmarkRow[];
}): BusinessStrength[] {
  const strengths: BusinessStrength[] = [];

  for (const row of input.benchmarkRows) {
    if (row.interpretationKind === "strength") {
      strengths.push({
        id: `benchmark-${row.id}`,
        label: row.label,
        detail: row.interpretation,
      });
    }
  }

  for (const domain of input.domains) {
    if (domain.status === "healthy") {
      strengths.push({
        id: `domain-${domain.id}`,
        label: domain.label,
        detail: `${domain.label} health is strong at ${domain.score}/100.`,
      });
    } else if (domain.trend.direction === "improving") {
      strengths.push({
        id: `trend-${domain.id}`,
        label: domain.label,
        detail: `${domain.label} improved over the ${domain.trend.windowLabel.toLowerCase()}.`,
      });
    }
  }

  const seen = new Set<string>();
  return strengths.filter((s) => {
    const key = s.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

export function buildExecutiveDecision(input: {
  overallScore: number;
  risk: BusinessRiskAssessment;
  domains: BusinessHealthDomain[];
}): ExecutiveDecision {
  const worst = [...input.domains].sort((a, b) => a.score - b.score)[0];
  const impactMonthly =
    worst?.estimatedImpactMonthly ??
    input.risk.estimatedExposure.totalMonthly ??
    null;

  if (input.risk.primaryRisk.category === "inventory") {
    return {
      title: "Today's Executive Decision",
      decision: "Do not increase advertising until inventory has been replenished.",
      reason: "Current inventory levels prevent profitable growth.",
      estimatedBenefit:
        impactMonthly != null && impactMonthly > 0
          ? `Reduce unnecessary ad spend and recover approximately $${impactMonthly.toLocaleString()}/month.`
          : "Avoid wasted ad spend on products customers cannot purchase.",
      estimatedBenefitMonthly: impactMonthly,
    };
  }

  if (input.risk.primaryRisk.category === "marketing") {
    return {
      title: "Today's Executive Decision",
      decision: "Pause or reduce spend on campaigns below break-even ROAS.",
      reason: input.risk.primaryRisk.reason,
      estimatedBenefit:
        impactMonthly != null && impactMonthly > 0
          ? `Recover approximately $${impactMonthly.toLocaleString()}/month in wasted acquisition spend.`
          : "Stop budget leakage before scaling acquisition.",
      estimatedBenefitMonthly: impactMonthly,
    };
  }

  if (input.risk.primaryRisk.category === "profitability") {
    return {
      title: "Today's Executive Decision",
      decision: "Prioritize margin recovery before growth investments.",
      reason: input.risk.primaryRisk.reason,
      estimatedBenefit:
        impactMonthly != null && impactMonthly > 0
          ? `Potential profit recovery of approximately $${impactMonthly.toLocaleString()}/month.`
          : "Stabilize profitability before increasing spend.",
      estimatedBenefitMonthly: impactMonthly,
    };
  }

  return {
    title: "Today's Executive Decision",
    decision: worst?.recommendedAction ?? input.risk.recommendationSteps[0]?.action ?? "Review today's priorities and act on the highest-impact item.",
    reason: input.risk.primaryRisk.reason,
    estimatedBenefit:
      impactMonthly != null && impactMonthly > 0
        ? `Estimated financial benefit of approximately $${impactMonthly.toLocaleString()}/month.`
        : "Addressing this first protects revenue and margin.",
    estimatedBenefitMonthly: impactMonthly,
  };
}
