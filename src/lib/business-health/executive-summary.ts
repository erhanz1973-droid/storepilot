import type { BusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";
import type { BusinessHealthDomain, HealthExecutiveSummary } from "./types";

function healthStatusLabel(score: number): string {
  if (score >= 70) return "Healthy";
  if (score >= 55) return "Fair";
  if (score >= 45) return "Warning";
  return "At Risk";
}

export function buildHealthExecutiveSummary(input: {
  overallScore: number;
  risk: BusinessRiskAssessment;
  domains: BusinessHealthDomain[];
  biggestOpportunity: string;
  criticalCount: number;
}): HealthExecutiveSummary {
  const { overallScore, risk, domains, criticalCount } = input;
  const statusLabel = healthStatusLabel(overallScore);
  const worstDomain = [...domains].sort((a, b) => a.score - b.score)[0];
  const topDomain = worstDomain;

  const headline = "Executive Summary";

  const primaryNarrative =
    risk.executiveBriefing ??
    `${risk.primaryRisk.title}: ${risk.primaryRisk.reason}`;

  const highestPriority =
    topDomain?.recommendedAction ??
    risk.recommendationSteps[0]?.action ??
    input.biggestOpportunity;

  const todaysPriority = highestPriority.toLowerCase().includes("replenish") ||
    highestPriority.toLowerCase().includes("inventory")
      ? "Restoring inventory before scaling advertising."
      : highestPriority.endsWith(".")
        ? highestPriority.slice(0, -1) + "."
        : `${highestPriority.charAt(0).toUpperCase()}${highestPriority.slice(1)}.`;

  const impactValue =
    topDomain?.estimatedImpactMonthly ??
    risk.estimatedExposure.totalMonthly ??
    null;

  const briefingParagraphs = [
    `Your business is currently operating at **${overallScore}/100 Health (${statusLabel}).**`,
    primaryNarrative,
    `Today's priority is ${todaysPriority.charAt(0).toLowerCase()}${todaysPriority.slice(1)}`,
  ];

  const narrative = briefingParagraphs.join("\n\n");

  return {
    headline,
    narrative,
    highestPriority: todaysPriority,
    estimatedMonthlyImprovement:
      impactValue != null && impactValue > 0
        ? `+$${impactValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : null,
    estimatedMonthlyImprovementValue: impactValue,
    briefingParagraphs,
  };
}
