import type { BusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";
import type { BusinessHealthDomain, HealthExecutiveSummary } from "./types";

export function buildHealthExecutiveSummary(input: {
  risk: BusinessRiskAssessment;
  domains: BusinessHealthDomain[];
  biggestOpportunity: string;
  criticalCount: number;
}): HealthExecutiveSummary {
  const { risk, domains, biggestOpportunity, criticalCount } = input;
  const criticalDomains = domains.filter((d) => d.status === "critical");
  const riskCount = Math.max(criticalCount, criticalDomains.length, 1);

  const headline = "Today's Health Summary";

  const narrative =
    riskCount >= 2
      ? `StorePilot identified ${riskCount} critical business risks. The largest issue is ${risk.primaryRisk.title.toLowerCase()}, where ${risk.primaryRisk.reason.charAt(0).toLowerCase()}${risk.primaryRisk.reason.slice(1)}`
      : `StorePilot flagged ${risk.primaryRisk.title.toLowerCase()} as the primary business concern. ${risk.primaryRisk.reason}`;

  const topDomain = [...domains].sort((a, b) => a.score - b.score)[0];
  const highestPriority =
    topDomain?.recommendedAction ??
    risk.recommendationSteps[0]?.action ??
    biggestOpportunity;

  const impactValue =
    topDomain?.estimatedImpactMonthly ??
    risk.estimatedExposure.totalMonthly ??
    null;

  return {
    headline,
    narrative,
    highestPriority,
    estimatedMonthlyImprovement:
      impactValue != null && impactValue > 0
        ? `+$${impactValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : null,
    estimatedMonthlyImprovementValue: impactValue,
  };
}
