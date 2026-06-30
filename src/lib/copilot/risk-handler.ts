import type { BusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";
import { buildBusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";
import type { CopilotDataBundle } from "./data";
import type { CopilotDataSource, CopilotStructuredResponse } from "./types";

function buildSummary(assessment: BusinessRiskAssessment): string {
  const { primaryRisk, secondaryRisk, rankingExplanation } = assessment;
  const lines = [`Biggest risk: ${primaryRisk.title}. ${primaryRisk.reason}`];

  if (secondaryRisk) {
    lines.push(`Secondary risk: ${secondaryRisk.title} — ${secondaryRisk.reason}`);
  }
  if (rankingExplanation) {
    lines.push(rankingExplanation);
  }

  return lines.join(" ");
}

function formatExposure(assessment: BusinessRiskAssessment): string {
  if (assessment.estimatedExposure.items.length === 0) {
    return `Business impact: ${assessment.primaryRisk.businessImpact}`;
  }
  return assessment.estimatedExposure.items
    .map((i) => `${i.label}: ~$${i.amountMonthly.toLocaleString()}/month`)
    .join(" · ");
}

export function buildCopilotRiskResponse(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
): CopilotStructuredResponse {
  const assessment = buildBusinessRiskAssessment({
    snapshot: bundle.snapshot,
    profitDashboard: bundle.context.profitDashboard,
    attributionDashboard: bundle.context.attributionDashboard,
    customerIntelligence: bundle.customerIntelligence,
    productIntelligence: bundle.context.productIntelligence,
    storeHealth: bundle.storeHealth,
    hasActiveAds: bundle.context.hasActiveAdsConnector,
  });

  const topCategories = assessment.categories.filter((c) => c.score >= 40);
  const allLowRisk = assessment.primaryRisk.businessImpact === "Low";

  if (allLowRisk && topCategories.length === 0) {
    return {
      summary: `Store Health is ${bundle.storeHealth.score}/100 (${bundle.storeHealth.label}) — no critical business risks detected across profitability, marketing, inventory, or retention.`,
      evidence: assessment.categories.map((c) => ({
        label: c.label,
        value: `${c.score} (${c.confidencePct}% conf.)`,
      })),
      confidencePct: 82,
      recommendations: [],
      businessImpact: {
        label: "",
        calculable: false,
        reasonIfNot: "No material risks to quantify.",
      },
      relatedInsights: [],
      dataSourcesUsed: sources,
      intent: "biggest_risk",
      riskAssessment: assessment,
    };
  }

  const exposureTotal = assessment.estimatedExposure.totalMonthly;

  return {
    summary: buildSummary(assessment),
    evidence: [],
    confidencePct: assessment.primaryRisk.confidencePct,
    recommendations: assessment.recommendationSteps.map((step) => ({
      action: `Step ${step.step}: ${step.action}`,
      detail: step.reason,
      available: false,
    })),
    businessImpact: {
      label: formatExposure(assessment),
      calculable: exposureTotal > 0,
      monthlyRevenue:
        assessment.estimatedExposure.items.find((i) =>
          i.label.toLowerCase().includes("revenue"),
        )?.amountMonthly ?? undefined,
      monthlyProfit:
        assessment.estimatedExposure.items.find((i) =>
          i.label.toLowerCase().includes("profit") || i.label.toLowerCase().includes("burn"),
        )?.amountMonthly ?? undefined,
    },
    relatedInsights: [],
    dataSourcesUsed: sources,
    intent: "biggest_risk",
    riskAssessment: assessment,
  };
}
