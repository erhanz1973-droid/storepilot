import type { ProfitDashboard } from "@/lib/profit/types";
import { breakEvenFromProfitPeriod } from "@/lib/attribution/break-even-roas";
import type {
  ApprovalEnrichedRecommendation,
  ApprovalPresentation,
  PresentedApprovalCard,
} from "./presenter";
import type {
  BusinessStatusSnapshot,
  DecisionCenterView,
  DecisionForecastScenario,
  DecisionMeasuredOutcome,
  DecisionMemo,
  ExecutiveDecisionBriefing,
} from "./decision-center-types";
import { parseRevenueImpact } from "./revenue";

function riskForCard(card: PresentedApprovalCard): "Low" | "Medium" | "High" {
  if (card.severity === "critical" && card.confidenceScore < 0.65) return "High";
  if (card.severity === "critical" || card.severity === "high") return "Medium";
  if (card.category === "campaign_review") return "Medium";
  return "Low";
}

function buildExpectedResult(card: PresentedApprovalCard): string {
  switch (card.category) {
    case "campaign_review":
      return "Reduce advertising waste while preserving top-performing campaigns.";
    case "low_inventory":
      return "Prevent stockouts on revenue-driving SKUs and protect cash flow.";
    case "slow_selling":
      return "Improve sell-through and recover margin without broad discounting.";
    case "bundle_opportunity":
      return "Increase average order value through strategic product bundling.";
    case "homepage_merchandising":
      return "Surface high-converting products to improve store conversion.";
    case "promotion_opportunity":
      return "Re-engage customers and lift repeat purchase rate.";
    default:
      return "Improve net profitability with controlled, measurable changes.";
  }
}

function buildWhyItMatters(card: PresentedApprovalCard): string {
  const primary = card.members[0];
  const metrics = primary?.supportingMetrics ?? [];
  const spendMetric = metrics.find((m) => /spend/i.test(m.label));
  const roasMetric = metrics.find((m) => /roas/i.test(m.label));

  if (card.category === "campaign_review") {
    const wasteEstimate = Math.max(card.netProfitImpact * 1.3, 1200);
    const roasNote = roasMetric ? ` at ${roasMetric.value} ROAS` : " below break-even";
    return `Without intervention, this campaign is projected to waste approximately $${Math.round(wasteEstimate).toLocaleString()} over the next 30 days while remaining${roasNote}.`;
  }

  if (card.category === "low_inventory") {
    return `Stockouts on this SKU could forfeit an estimated $${card.netProfitImpact.toLocaleString()}/month in profit before replenishment arrives.`;
  }

  if (spendMetric && card.netProfitImpact > 0) {
    return `Delaying action leaves ${spendMetric.value} in spend working against profitability — estimated $${card.netProfitImpact.toLocaleString()}/month recoverable with approval.`;
  }

  return `This ${card.severity} priority signal represents $${card.netProfitImpact.toLocaleString()}/month in estimated net profit opportunity with ${Math.round(card.confidenceScore * 100)}% model confidence.`;
}

function extractEvidence(card: PresentedApprovalCard): { label: string; value: string }[] {
  const fromMembers = card.members.flatMap((m) => m.supportingMetrics ?? []);
  if (fromMembers.length > 0) return fromMembers.slice(0, 6);

  if (card.isCampaignPortfolio && card.campaignBrief) {
    return [
      { label: "Campaigns scanned", value: String(card.campaignBrief.scanned) },
      { label: "Need review", value: String(card.campaignBrief.needsReview) },
      { label: "Active", value: String(card.campaignBrief.active) },
    ];
  }

  return [];
}

function buildForecast(card: PresentedApprovalCard, profitDashboard: ProfitDashboard | null): DecisionForecastScenario {
  const primary = card.members[0];
  const metrics = primary?.supportingMetrics ?? [];
  const roasMetric = metrics.find((m) => /roas/i.test(m.label));
  const spendMetric = metrics.find((m) => /spend/i.test(m.label));

  let roasBefore: string | null = roasMetric?.value ?? null;
  let roasAfter: string | null = null;

  if (profitDashboard && card.category === "campaign_review") {
    const period = profitDashboard.primary;
    const be = breakEvenFromProfitPeriod(period);
    if (!roasBefore && profitDashboard.blendedRoas?.blendedRoas30d != null) {
      roasBefore = profitDashboard.blendedRoas.blendedRoas30d.toFixed(2);
    }
    if (be && roasBefore) {
      const current = parseFloat(roasBefore.replace(/[^\d.]/g, ""));
      roasAfter = Math.max(be.breakEvenRoas, current * 1.15).toFixed(2);
    }
  }

  const spendChange = card.category === "campaign_review" ? -Math.round(card.netProfitImpact * 0.75) : 0;
  const revenueChange =
    card.category === "campaign_review"
      ? -Math.round(card.revenueImpact * 0.08)
      : Math.round(card.revenueImpact * 0.15);

  return {
    estimatedProfit: card.netProfitImpact,
    estimatedRevenue: revenueChange,
    estimatedAdSpend: spendChange,
    roasBefore,
    roasAfter,
    confidencePct: Math.round(card.confidenceScore * 100),
    summary: buildExpectedResult(card),
  };
}

function buildMeasuredOutcome(member: ApprovalEnrichedRecommendation): DecisionMeasuredOutcome | undefined {
  if (member.approval.status !== "measured" && member.status !== "measured") return undefined;

  const expected = parseRevenueImpact(member.expectedImpact);
  let actual: number | null = null;
  if (member.actualImpact) {
    actual = parseRevenueImpact(member.actualImpact);
  }

  return {
    expectedMonthlyProfit: expected,
    actualMonthlyProfit: actual,
    accuracyPct: member.predictionAccuracy ?? null,
    windowDays: member.measurementWindowDays ?? 14,
    summary: member.outcomeSummary ?? null,
  };
}

function buildMemo(
  card: PresentedApprovalCard,
  profitDashboard: ProfitDashboard | null,
): DecisionMemo {
  const primary = card.members[0];
  const lifecycleStatus = primary?.approval.status ?? "pending";

  return {
    card,
    title: card.title,
    subtitle: card.subtitle ?? card.category.replace(/_/g, " "),
    reason: card.reason,
    whyItMatters: buildWhyItMatters(card),
    expectedResult: buildExpectedResult(card),
    evidence: extractEvidence(card),
    riskLevel: riskForCard(card),
    lifecycleStatus,
    forecast: buildForecast(card, profitDashboard),
    measuredOutcome: primary ? buildMeasuredOutcome(primary) : undefined,
    primaryRecommendationId: primary?.id ?? null,
  };
}

function buildBusinessStatus(
  presentation: ApprovalPresentation,
  profitDashboard: ProfitDashboard | null,
): BusinessStatusSnapshot {
  const urgent = presentation.allOpportunities.filter(
    (c) => c.severity === "critical" || c.severity === "high",
  ).length;

  if (urgent >= 2) {
    return {
      level: "critical",
      label: "Immediate Attention Required",
      emoji: "🔴",
      summary: `${urgent} urgent decisions need review to protect profitability.`,
    };
  }

  const margin = profitDashboard?.primary.profitMarginPct;
  const roas = profitDashboard?.blendedRoas?.blendedRoas30d;
  const be = profitDashboard ? breakEvenFromProfitPeriod(profitDashboard.primary) : null;

  if (margin != null && margin < 15) {
    return {
      level: "pressure",
      label: "Profit Under Pressure",
      emoji: "🟠",
      summary: `Net margin at ${margin.toFixed(1)}% — prioritize efficiency decisions today.`,
    };
  }

  if (roas != null && be && roas < be.breakEvenRoas) {
    return {
      level: "pressure",
      label: "Advertising Efficiency Gap",
      emoji: "🟠",
      summary: `Blended ROAS ${roas.toFixed(2)} is below break-even ${be.breakEvenRoas.toFixed(2)}.`,
    };
  }

  if (presentation.hasActionableOpportunities) {
    return {
      level: "caution",
      label: "Opportunities Identified",
      emoji: "🟡",
      summary: `${presentation.totalActionable} high-impact decision${presentation.totalActionable === 1 ? "" : "s"} ready for review.`,
    };
  }

  return {
    level: "healthy",
    label: "Operating Smoothly",
    emoji: "🟢",
    summary: "No urgent decisions — StorePilot continues monitoring all connected sources.",
  };
}

function countCompletedToday(items: ApprovalEnrichedRecommendation[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return items.filter((i) => {
    const ts = i.completedAt ?? i.measuredAt ?? i.approvedAt;
    return ts?.slice(0, 10) === today;
  }).length;
}

export function buildExecutiveNarrative(presentation: ApprovalPresentation): {
  narrative: string;
  highlights: string[];
} {
  const { allOpportunities, topFiveMonthlyImpact, hasActionableOpportunities } = presentation;

  if (!hasActionableOpportunities) {
    return {
      narrative: presentation.aiSummary,
      highlights: presentation.aiSummaryLines,
    };
  }

  const count = allOpportunities.length;
  const avgConfidence =
    count > 0
      ? Math.round(
          (allOpportunities.reduce((s, c) => s + c.confidenceScore, 0) / count) * 100,
        )
      : 0;
  const dominantEffort = allOpportunities[0]?.implementationEffort ?? "Medium";

  const narrative = [
    "StorePilot analyzed all connected marketing channels and identified",
    `${count} high-impact decision${count === 1 ? "" : "s"}`,
    "that could improve profitability.",
    `Together, these opportunities are estimated to increase monthly net profit by $${topFiveMonthlyImpact.toLocaleString()},`,
    `with ${dominantEffort.toLowerCase()} implementation effort and ${avgConfidence}% confidence.`,
  ].join(" ");

  const highlights = [
    narrative,
    ...presentation.aiSummaryLines.slice(1),
  ].filter(Boolean);

  return { narrative, highlights };
}

export function buildDecisionCenterView(
  presentation: ApprovalPresentation,
  items: ApprovalEnrichedRecommendation[],
  profitDashboard: ProfitDashboard | null,
): DecisionCenterView {
  const memos = presentation.allOpportunities.map((card) => buildMemo(card, profitDashboard));
  const top = presentation.topOpportunities[0];
  const { narrative, highlights } = buildExecutiveNarrative(presentation);

  const pending = items.filter(
    (i) => i.approval.status === "pending" || i.approval.status === "snoozed",
  );
  const urgent = pending.filter((i) => i.severity === "critical" || i.severity === "high").length;

  const briefing: ExecutiveDecisionBriefing = {
    businessStatus: buildBusinessStatus(presentation, profitDashboard),
    topOpportunityTitle: top?.title ?? null,
    topOpportunityImpact: top?.netProfitImpact ?? 0,
    topOpportunityConfidencePct: top ? Math.round(top.confidenceScore * 100) : 0,
    urgentDecisions: urgent,
    pendingDecisions: pending.length,
    completedToday: countCompletedToday(items),
    narrative,
    narrativeHighlights: highlights,
  };

  return {
    briefing,
    primaryDecision: memos[0] ?? null,
    additionalDecisions: memos.slice(1),
    presentation,
    visionStatement:
      "Approval Center is your daily operating dashboard — every recommendation answers what happened, why, how much is at stake, and what happens if you approve.",
  };
}
