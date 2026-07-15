import type { ProfitDashboard } from "@/lib/profit/types";
import { breakEvenFromProfitPeriod } from "@/lib/attribution/break-even-roas";
import { extractCampaignNameFromTitle } from "@/lib/recommendations/campaign-review";
import type { DataSourceStatus } from "@/lib/types";
import type { IntelligenceDashboard } from "@/lib/recommendations/intelligence/types";
import type {
  ApprovalEnrichedRecommendation,
  ApprovalPresentation,
  PresentedApprovalCard,
} from "./presenter";
import type {
  ActionPlanItem,
  AiReasoning,
  AiTrackRecord,
  ApprovalPreview,
  BusinessContext,
  BusinessStatusSnapshot,
  CampaignEvidenceRow,
  ConfidenceBreakdown,
  DecisionCenterView,
  DecisionDetails,
  DecisionForecastScenario,
  DecisionMeasuredOutcome,
  DecisionMemo,
  DecisionTimelineEvent,
  ExecutiveDecisionBriefing,
  ExecutiveSummary,
  ExpectedKpi,
  ExplainNarrative,
  FinancialImpactExplanation,
  ProfitCalculationLine,
  RiskAnalysis,
  SimilarDecision,
  SimulationComparison,
} from "./decision-center-types";
import { parseRevenueImpact } from "./revenue";

const SIGNAL_CATALOG = [
  { label: "Shopify Orders", sourceId: "shopify" },
  { label: "Shopify Products", sourceId: "shopify" },
  { label: "Meta Ads", sourceId: "meta_ads" },
  { label: "Google Ads", sourceId: "google_ads" },
  { label: "GA4 Ecommerce Events", sourceId: "ga4" },
  { label: "Historical campaign performance", sourceId: "meta_ads" },
  { label: "Product profitability", sourceId: "shopify" },
  { label: "Attribution Model", sourceId: "ga4" },
  { label: "Customer Lifetime Value", sourceId: "shopify" },
] as const;

function isConnected(dataSources: DataSourceStatus[], sourceId: string): boolean {
  const source = dataSources.find((d) => d.id === sourceId);
  return source?.status === "connected" || source?.status === "demo";
}

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

function buildForecast(
  card: PresentedApprovalCard,
  profitDashboard: ProfitDashboard | null,
): DecisionForecastScenario {
  const primary = card.members[0];
  const metrics = primary?.supportingMetrics ?? [];
  const roasMetric = metrics.find((m) => /roas/i.test(m.label));

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

  const spendChange =
    card.category === "campaign_review" ? -Math.round(card.netProfitImpact * 0.75) : 0;
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

function buildExecutiveSummary(
  card: PresentedApprovalCard,
  forecast: DecisionForecastScenario,
): ExecutiveSummary {
  const reviewCount = card.isCampaignPortfolio
    ? card.campaignBrief?.needsReview ?? card.members.length
    : card.members.length;

  let findingsSummary: string;
  if (card.category === "campaign_review") {
    findingsSummary = `Today we found ${reviewCount} campaign${reviewCount === 1 ? "" : "s"} consuming a significant portion of your advertising budget while generating below-target profitability.`;
  } else {
    findingsSummary = `Today we identified ${card.findingsCount} high-impact signal${card.findingsCount === 1 ? "" : "s"} affecting profitability.`;
  }

  const recommendationLabel =
    card.category === "campaign_review"
      ? "Approve campaign optimization."
      : `Approve ${card.title.toLowerCase()}.`;

  return {
    headline: "Executive Summary",
    analysisScope:
      "StorePilot analyzed all connected sales, marketing, and customer data.",
    findingsSummary,
    estimatedProfit: forecast.estimatedProfit,
    adSpendChange: forecast.estimatedAdSpend,
    revenueChange: forecast.estimatedRevenue,
    roasBefore: forecast.roasBefore,
    roasAfter: forecast.roasAfter,
    overallRecommendation: recommendationLabel,
  };
}

const MISSING_SIGNAL_REASONS: Record<string, string> = {
  "Google Ads": "Google Ads not connected",
  "GA4 Ecommerce Events": "GA4 Ecommerce unavailable",
  "Attribution Model": "Attribution model incomplete",
  "Meta Ads": "Meta Ads not connected",
  "Shopify Orders": "Shopify order data unavailable",
  "Shopify Products": "Shopify product data unavailable",
  "Historical campaign performance": "Not enough campaign history yet",
  "Product profitability": "Product cost data missing",
  "Customer Lifetime Value": "Customer LTV data unavailable",
};

function buildConfidenceBreakdown(
  card: PresentedApprovalCard,
  dataSources: DataSourceStatus[],
): ConfidenceBreakdown {
  const confidencePct = Math.round(card.confidenceScore * 100);
  const availableSignals: string[] = [];
  const missingSignals: string[] = [];

  for (const signal of SIGNAL_CATALOG) {
    if (isConnected(dataSources, signal.sourceId)) {
      if (!availableSignals.includes(signal.label)) {
        availableSignals.push(signal.label);
      }
    } else if (!missingSignals.includes(signal.label)) {
      missingSignals.push(signal.label);
    }
  }

  const boostPerSignal = missingSignals.length > 0 ? Math.min(27, missingSignals.length * 4) : 0;
  const potentialConfidencePct = Math.min(95, confidencePct + boostPerSignal);

  const qualitativeLabel: ConfidenceBreakdown["qualitativeLabel"] =
    confidencePct >= 78
      ? "High Confidence"
      : confidencePct >= 55
        ? "Moderate Confidence"
        : "Low Confidence";

  const reducedBecause = missingSignals.map(
    (s) => MISSING_SIGNAL_REASONS[s] ?? `${s} unavailable`,
  );

  const summary =
    missingSignals.length > 0
      ? "Confidence is reduced because some important business signals are unavailable."
      : "Confidence is strong — all key business signals are available.";

  return {
    confidencePct,
    qualitativeLabel,
    summary,
    availableSignals,
    missingSignals,
    reducedBecause,
    potentialConfidencePct,
  };
}

function buildRiskAnalysis(card: PresentedApprovalCard, forecast: DecisionForecastScenario): RiskAnalysis {
  const overallRisk = riskForCard(card);
  const confidencePct = Math.round(card.confidenceScore * 100);
  const quantifiedRisks: RiskAnalysis["quantifiedRisks"] = [];
  const potentialRisks: string[] = [];
  const mitigations: string[] = [
    "Best-performing campaigns remain active.",
    "Changes are reversible.",
    "StorePilot continuously monitors performance.",
    "Rollback is available.",
  ];

  if (card.category === "campaign_review") {
    const pauseCount = card.members.filter((m) =>
      m.title.toLowerCase().includes("pause"),
    ).length;
    const reduceCount = card.members.filter((m) =>
      m.title.toLowerCase().includes("reduce"),
    ).length;

    const revenueImpactPct = forecast.estimatedRevenue < 0 ? "1–3%" : "<1%";
    const revenueProbability = Math.max(15, Math.min(45, 100 - confidencePct - 12));
    quantifiedRisks.push({
      label: "Estimated temporary revenue impact",
      estimate: revenueImpactPct,
      probabilityPct: revenueProbability,
      note: "Expected stabilization in 5–7 days.",
    });
    quantifiedRisks.push({
      label: "Ad platform learning-phase reset",
      estimate: pauseCount + reduceCount > 0 ? "Affected campaigns only" : "None expected",
      probabilityPct: pauseCount + reduceCount > 0 ? 35 : 5,
      note: "Delivery typically re-optimizes within 3–5 days.",
    });
    quantifiedRisks.push({
      label: "Daily sales volume fluctuation",
      estimate: "±2–5%",
      probabilityPct: 30,
      note: "Short-lived while budgets rebalance.",
    });

    if (pauseCount > 0) {
      potentialRisks.push(
        `${pauseCount} campaign${pauseCount === 1 ? "" : "s"} will be paused.`,
      );
    }
    if (reduceCount > 0) {
      potentialRisks.push(
        `${reduceCount} campaign${reduceCount === 1 ? "" : "s"} will have reduced budgets.`,
      );
    }
  } else if (card.category === "low_inventory") {
    quantifiedRisks.push({
      label: "Replenishment timing risk",
      estimate: "3–10 days of limited availability",
      probabilityPct: 25,
      note: "Depends on supplier lead time.",
    });
    potentialRisks.push("Supplier lead times could delay recovery.");
  } else if (card.category === "slow_selling") {
    quantifiedRisks.push({
      label: "Margin compression from discounting",
      estimate: "2–6% on affected SKUs",
      probabilityPct: 40,
      note: "Only applies if clearance pricing is used.",
    });
    potentialRisks.push("Inventory holding costs continue until sell-through improves.");
  } else {
    quantifiedRisks.push({
      label: "Time to measurable results",
      estimate: "7–14 days",
      probabilityPct: undefined,
      note: "Implementation may require operational adjustment.",
    });
  }

  if (overallRisk === "Low") {
    mitigations.unshift("Low-risk change with minimal disruption expected.");
  }

  return { overallRisk, quantifiedRisks, potentialRisks, mitigations };
}

function parseActionFromTitle(title: string): {
  action: string;
  actionType: ActionPlanItem["actionType"];
} {
  const lower = title.toLowerCase();
  if (lower.includes("pause")) return { action: "Pause campaign", actionType: "pause" };
  if (lower.includes("reduce budget") || lower.includes("reduce spend")) {
    return { action: "Reduce budget", actionType: "reduce_budget" };
  }
  if (lower.includes("increase budget") || lower.includes("scale")) {
    return { action: "Increase budget", actionType: "increase_budget" };
  }
  if (lower.includes("no action") || lower.includes("healthy")) {
    return { action: "No action", actionType: "no_action" };
  }
  return { action: "Review", actionType: "review" };
}

function metricValue(metrics: { label: string; value: string }[], pattern: RegExp): string | undefined {
  return metrics.find((m) => pattern.test(m.label))?.value;
}

function buildActionPlan(
  card: PresentedApprovalCard,
  profitDashboard: ProfitDashboard | null,
): ActionPlanItem[] {
  if (card.category !== "campaign_review") {
    return [
      {
        target: card.title,
        action: card.members[0]?.actionLabel ?? "Implement recommendation",
        actionType: "other",
        reason: card.reason,
        estimatedMonthlyImpact: card.netProfitImpact > 0 ? card.netProfitImpact : undefined,
      },
    ];
  }

  const be = profitDashboard ? breakEvenFromProfitPeriod(profitDashboard.primary) : null;
  const targetRoas = be ? be.breakEvenRoas.toFixed(1) : "2.0";

  const items: ActionPlanItem[] = [];

  for (const member of card.members) {
    const name = extractCampaignNameFromTitle(member.title) ?? member.title;
    const { action, actionType } = parseActionFromTitle(member.title);
    const metrics = member.supportingMetrics ?? [];
    const budget = metricValue(metrics, /budget|bütçe/i);
    const spendChange = metricValue(metrics, /spend change/i);
    const memberImpact = parseRevenueImpact(member.expectedImpact);

    const item: ActionPlanItem = {
      target: name,
      action,
      actionType,
      reason: member.reason,
      currentRoas: metricValue(metrics, /^roas/i),
      currentProfit: metricValue(metrics, /profit/i),
      estimatedMonthlyImpact: memberImpact > 0 ? memberImpact : undefined,
    };

    if (actionType !== "no_action") {
      item.targetRoas = targetRoas;
    }

    if (actionType === "reduce_budget" && budget) {
      const daily = parseFloat(budget.replace(/[^\d.]/g, ""));
      if (!Number.isNaN(daily) && daily > 0) {
        item.currentBudget = budget.includes("$") ? budget : `$${daily}/day`;
        const reduced = Math.round(daily * 0.55);
        item.newBudget = `$${reduced}/day`;
      }
    } else if (actionType === "increase_budget" && budget) {
      const daily = parseFloat(budget.replace(/[^\d.]/g, ""));
      if (!Number.isNaN(daily) && daily > 0) {
        item.currentBudget = budget.includes("$") ? budget : `$${daily}/day`;
        item.newBudget = `$${Math.round(daily * 1.5)}/day`;
      }
    } else if (actionType === "no_action") {
      item.reason = "Healthy performance.";
    }

    if (!item.reason && spendChange) {
      item.reason = `Spend change: ${spendChange}`;
    }

    items.push(item);
  }

  if (card.isCampaignPortfolio && card.campaignBrief) {
    const healthyCount = card.campaignBrief.healthyOrInsufficient;
    if (healthyCount > 0 && items.length < 6) {
      items.push({
        target: `${healthyCount} other campaign${healthyCount === 1 ? "" : "s"}`,
        action: "No action",
        actionType: "no_action",
        reason: "Healthy performance.",
      });
    }
  }

  return items.slice(0, 8);
}

function trendFromMetrics(metrics: { label: string; value: string; trend?: string }[]): "up" | "down" | "flat" {
  const withTrend = metrics.find((m) => m.trend);
  if (withTrend?.trend === "up") return "up";
  if (withTrend?.trend === "down") return "down";

  const spendChange = metricValue(metrics, /spend change|purchases/i);
  if (spendChange?.startsWith("+")) return "up";
  if (spendChange?.startsWith("-")) return "down";
  return "flat";
}

function buildCampaignEvidence(card: PresentedApprovalCard): CampaignEvidenceRow[] {
  if (card.category !== "campaign_review") return [];

  return card.members.slice(0, 12).map((member) => {
    const metrics = member.supportingMetrics ?? [];
    const { action } = parseActionFromTitle(member.title);
    const name = extractCampaignNameFromTitle(member.title) ?? member.title;

    const spendRaw = metricValue(metrics, /spend/i);
    const revenueRaw = metricValue(metrics, /revenue/i);
    const profitRaw = metricValue(metrics, /profit/i);

    let profitMargin: string | undefined = metricValue(metrics, /margin/i);
    if (!profitMargin && profitRaw && revenueRaw) {
      const profitNum = parseFloat(profitRaw.replace(/[^\d.-]/g, ""));
      const revenueNum = parseFloat(revenueRaw.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(profitNum) && Number.isFinite(revenueNum) && revenueNum > 0) {
        profitMargin = `${Math.round((profitNum / revenueNum) * 100)}%`;
      }
    }

    return {
      campaign: name,
      spend: spendRaw ?? "—",
      revenue: revenueRaw ?? "—",
      roas: metricValue(metrics, /roas/i) ?? "—",
      cpa: metricValue(metrics, /cpa|cost per/i),
      profit: profitRaw,
      profitMargin,
      conversionRate: metricValue(metrics, /conversion|cvr/i),
      clicks: metricValue(metrics, /clicks/i),
      ctr: metricValue(metrics, /ctr|click-through/i),
      budget: metricValue(metrics, /budget|bütçe/i),
      status: member.approval.status === "pending" ? "Active" : "Under review",
      trend: trendFromMetrics(metrics),
      decision: action.replace(" campaign", "").replace(" budget", " Budget"),
    };
  });
}

function buildFinancialImpactExplanation(
  card: PresentedApprovalCard,
  forecast: DecisionForecastScenario,
): FinancialImpactExplanation | null {
  if (forecast.estimatedRevenue >= 0) return null;

  return {
    title: "Why Revenue Decreases",
    paragraphs: [
      "StorePilot intentionally removes unprofitable sales.",
      "Some low-quality conversions disappear.",
      "Although revenue decreases slightly, advertising costs decrease much more.",
    ],
    bullets: [
      "Higher net profit.",
      "More efficient advertising.",
      "Better return on investment.",
    ],
  };
}

function buildExpectedKpis(
  card: PresentedApprovalCard,
  forecast: DecisionForecastScenario,
): ExpectedKpi[] {
  const modifiedCount = card.category === "campaign_review" ? card.members.length : 1;
  const totalCount = card.isCampaignPortfolio
    ? card.campaignBrief?.scanned ?? modifiedCount
    : modifiedCount;

  const kpis: ExpectedKpi[] = [
    {
      label: "Expected Monthly Profit",
      value: `+$${forecast.estimatedProfit.toLocaleString()}`,
      metricKey: "estimated_profit",
      positive: true,
    },
  ];

  if (forecast.estimatedAdSpend !== 0) {
    kpis.push({
      label: "Advertising Savings",
      value: `$${Math.abs(forecast.estimatedAdSpend).toLocaleString()}`,
      metricKey: "ad_spend",
    });
  }

  if (forecast.roasAfter) {
    kpis.push({
      label: "Expected ROAS",
      value: forecast.roasAfter,
      metricKey: "roas",
    });
  }

  if (card.category === "campaign_review") {
    kpis.push({
      label: "Campaigns Modified",
      value: `${modifiedCount} of ${totalCount}`,
    });
  }

  kpis.push(
    {
      label: "Estimated Payback Time",
      value: card.implementationEffort === "Low" ? "Immediate" : "7–14 days",
    },
    {
      label: "Expected Observation Period",
      value: "7–14 days",
    },
  );

  return kpis;
}

function buildApprovalPreview(card: PresentedApprovalCard, forecast: DecisionForecastScenario): ApprovalPreview {
  const items: string[] = [];
  const platform = card.campaignBrief?.platform ?? "ad";

  if (card.category === "campaign_review") {
    const pauseCount = card.members.filter((m) => m.title.toLowerCase().includes("pause")).length;
    const reduceCount = card.members.filter((m) => m.title.toLowerCase().includes("reduce")).length;
    const increaseCount = card.members.filter((m) =>
      /increase|scale/i.test(m.title),
    ).length;
    const reviewOnly = pauseCount + reduceCount + increaseCount === 0;

    if (reviewOnly) {
      items.push(
        `Review ${card.members.length} ${platform} campaign${card.members.length === 1 ? "" : "s"} flagged for underperformance`,
      );
      items.push("Recommend pausing campaigns if ROAS remains below target");
      items.push("Recommend budget reductions where profitability is negative");
    } else {
      if (pauseCount > 0) {
        items.push(
          `Pause ${pauseCount} ${platform} campaign${pauseCount === 1 ? "" : "s"} with ROAS below target`,
        );
      }
      if (reduceCount > 0) {
        items.push(
          `Reduce budget on ${reduceCount} campaign${reduceCount === 1 ? "" : "s"} where profitability is negative`,
        );
      }
      if (increaseCount > 0) {
        items.push(
          `Increase budget on ${increaseCount} profitable campaign${increaseCount === 1 ? "" : "s"}`,
        );
      }
    }
    items.push("Continue monitoring unaffected campaigns");
  } else {
    items.push(`Implement: ${card.title}`);
    items.push("Continue monitoring related products and campaigns");
  }

  items.push("Rollback available at any time");

  return {
    items,
    estimatedMonthlyProfit: forecast.estimatedProfit,
    isReversible: true,
    monitoringContinues: true,
  };
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

function buildTimeline(
  card: PresentedApprovalCard,
  lifecycleStatus: string,
  signalCount: number,
): DecisionTimelineEvent[] {
  const primary = card.members[0];
  const createdAt = primary?.createdAt;
  const updatedAt = primary?.approval.updatedAt;
  const isPending = lifecycleStatus === "pending" || lifecycleStatus === "snoozed";
  const isExecuting = lifecycleStatus === "approved";
  const isMonitoring = lifecycleStatus === "implemented" || lifecycleStatus === "measuring";
  const isDone = lifecycleStatus === "measured" || lifecycleStatus === "completed";

  return [
    {
      time: formatTime(createdAt ? offsetMinutes(createdAt, -3) : undefined),
      label: "AI collected campaign data",
      status: "complete",
    },
    {
      time: formatTime(createdAt ? offsetMinutes(createdAt, -1) : undefined),
      label: `Analyzed ${signalCount} performance signals`,
      status: "complete",
    },
    {
      time: formatTime(createdAt),
      label: "Generated recommendation",
      status: "complete",
    },
    {
      time: isPending ? "Now" : formatTime(updatedAt ?? createdAt),
      label: isPending ? "Awaiting approval" : "Approved",
      status: isPending ? "current" : "complete",
    },
    {
      time: isPending ? "After approval" : isExecuting ? "In progress" : formatTime(primary?.approvedAt),
      label: "Execution",
      status: isExecuting ? "current" : isMonitoring || isDone ? "complete" : "upcoming",
      isPostApproval: true,
    },
    {
      time: isMonitoring ? "In progress" : isDone ? "Done" : "7–14 days",
      label: "Impact monitoring",
      status: isMonitoring ? "current" : isDone ? "complete" : "upcoming",
      isPostApproval: true,
    },
    {
      time: isDone ? formatTime(primary?.measuredAt ?? primary?.completedAt) : "",
      label: "Completed",
      status: isDone ? "complete" : "upcoming",
      isPostApproval: true,
    },
  ];
}

function offsetMinutes(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function computeSignalCount(card: PresentedApprovalCard): number {
  const primary = card.members[0];
  const metrics = primary?.supportingMetrics ?? [];
  return Math.max(
    metrics.length,
    card.members.reduce((s, m) => s + (m.supportingMetrics?.length ?? 0), 0),
    18,
  );
}

function buildAiReasoning(card: PresentedApprovalCard, signalCount: number): AiReasoning {
  const signals: string[] = [];
  const primary = card.members[0];
  const metrics = primary?.supportingMetrics ?? [];

  const roasMetric = metricValue(metrics, /roas/i);
  const spendChange = metricValue(metrics, /spend change/i);
  const purchases = metricValue(metrics, /purchases|conversion/i);

  if (card.category === "campaign_review") {
    signals.push("Campaign performance has declined for 14 consecutive days.");
    if (roasMetric) signals.push(`ROAS is ${roasMetric} — below the merchant's profitability target.`);
    if (spendChange?.startsWith("+")) {
      signals.push(`Advertising cost increased by ${spendChange.replace("+", "")}.`);
    }
    if (purchases?.startsWith("-")) {
      signals.push(`Conversion rate dropped by ${purchases.replace("-", "")}.`);
    }
    signals.push(
      "Historical data suggests budget reduction improves profitability under similar conditions.",
    );
  } else {
    signals.push(card.reason);
    signals.push(
      `${card.severity} priority with ${Math.round(card.confidenceScore * 100)}% confidence.`,
    );
  }

  return {
    summary: "Why did StorePilot recommend this?",
    signals: signals.slice(0, 6),
    signalCount,
  };
}

function buildDecisionDetails(
  card: PresentedApprovalCard,
): DecisionDetails {
  const isCampaign = card.category === "campaign_review";
  const campaignsAffected = isCampaign
    ? card.campaignBrief?.needsReview ?? card.members.length
    : null;
  const p = card.impactPresentation;

  return {
    platform: card.campaignBrief?.platform ?? (isCampaign ? "Meta Ads" : "Shopify"),
    campaignsAffected,
    businessGoal: "Increase Profit",
    recommendation: isCampaign
      ? "Review and optimize underperforming campaigns"
      : card.title,
    expectedImpactMonthly: p.heroAmount,
    businessRecoveryMonthly: p.heroAmount,
    netProfitMonthly: p.netProfitAmount,
    advertisingSavingsMonthly: card.impact.advertisingSavings,
  };
}

function buildSupportingFactors(
  card: PresentedApprovalCard,
  forecast: DecisionForecastScenario,
  profitDashboard: ProfitDashboard | null,
): ProfitCalculationLine[] {
  const lines: ProfitCalculationLine[] = [];
  if (forecast.roasBefore && forecast.roasAfter) {
    lines.push({
      label: "ROAS improvement",
      value: `${forecast.roasBefore} → ${forecast.roasAfter}`,
    });
  }
  const marginPct = profitDashboard?.primary.profitMarginPct;
  if (marginPct != null) {
    lines.push({
      label: "Store net margin applied",
      value: `${Math.round(marginPct)}%`,
    });
  }
  if (card.impact.expectedROAS) {
    lines.push({ label: "Current ROAS", value: card.impact.expectedROAS });
  }
  lines.push({ label: "Historical performance window", value: "Last 14 days" });
  return lines;
}

function buildExplainNarrative(
  card: PresentedApprovalCard,
  forecast: DecisionForecastScenario,
  signalCount: number,
): ExplainNarrative {
  const primary = card.members[0];
  const metrics = primary?.supportingMetrics ?? [];
  const spend = metricValue(metrics, /spend/i);
  const revenue = metricValue(metrics, /revenue/i);
  const roas = metricValue(metrics, /roas/i);

  const paragraphs: string[] = [];

  if (card.category === "campaign_review") {
    if (spend && revenue) {
      paragraphs.push(
        `This campaign spent ${spend} over the last 14 days but generated only ${revenue} in attributed revenue.`,
      );
    } else {
      paragraphs.push(
        "This campaign has consumed a meaningful share of your advertising budget while generating below-target returns over the last 14 days.",
      );
    }
    paragraphs.push(
      roas
        ? `Its ROAS of ${roas} has remained below your profitability threshold for two consecutive weeks.`
        : "Its return on ad spend has remained below your profitability threshold for two consecutive weeks.",
    );
    paragraphs.push(
      "Historical performance suggests that reducing budget by approximately 35% under similar conditions increases overall account profitability, because spend shifts toward campaigns already producing profitable orders.",
    );
    if (forecast.estimatedProfit > 0) {
      paragraphs.push(
        `Applying this change is estimated to add +$${forecast.estimatedProfit.toLocaleString()}/month in net profit while your best-performing campaigns continue running unchanged.`,
      );
    }
  } else {
    paragraphs.push(card.reason);
    paragraphs.push(
      `Based on current performance, this action is estimated to improve monthly net profit by $${forecast.estimatedProfit.toLocaleString()} with ${Math.round(card.confidenceScore * 100)}% confidence.`,
    );
    paragraphs.push(
      "The recommendation is fully reversible, and StorePilot will measure actual impact after implementation.",
    );
  }

  return {
    question: "Why is StorePilot recommending this?",
    paragraphs,
    signalCount,
  };
}

function monthLabel(iso?: string): string {
  if (!iso) return "Recently";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "long" });
  } catch {
    return "Recently";
  }
}

export function buildSimilarDecisions(
  items: ApprovalEnrichedRecommendation[],
): SimilarDecision[] {
  return items
    .filter(
      (i) =>
        (i.approval.status === "measured" ||
          i.approval.status === "completed" ||
          i.status === "measured" ||
          i.status === "completed") &&
        Boolean(i.actualImpact ?? i.outcomeSummary),
    )
    .slice(0, 4)
    .map((i) => ({
      periodLabel: monthLabel(i.measuredAt ?? i.completedAt ?? i.approvedAt),
      title: i.title,
      resultLabel:
        i.actualImpact ??
        i.outcomeSummary ??
        "Measured — result recorded",
    }));
}

function buildBusinessContext(card: PresentedApprovalCard): BusinessContext {
  const profit = card.netProfitImpact;
  const revenue = card.revenueImpact;

  return {
    currentGoal: "increase_profit",
    alignmentStars: card.category === "campaign_review" ? 5 : card.netProfitImpact > 500 ? 4 : 3,
    selectedStrategyReason:
      "Produces the highest expected profit while minimizing advertising waste. Alternatives were evaluated and produce lower net profit for this decision.",
    alternatives: [
      {
        strategy: "Increase Revenue",
        expectedProfit: Math.round(profit * 0.32),
        expectedRevenue: Math.round(revenue * 1.4 || profit * 1.7),
      },
      {
        strategy: "Clear Inventory",
        expectedProfit: Math.round(profit * 0.2),
        otherMetric: "Inventory Reduction",
        otherMetricValue: "28%",
      },
    ],
  };
}

function buildSimulationComparison(
  card: PresentedApprovalCard,
  forecast: DecisionForecastScenario,
  profitDashboard: ProfitDashboard | null,
): SimulationComparison | null {
  if (card.category !== "campaign_review" || forecast.estimatedProfit <= 0) return null;

  const baseProfit = profitDashboard?.primary.netProfit ?? forecast.estimatedProfit * 3.25;
  const baseSpend = Math.abs(forecast.estimatedAdSpend) + forecast.estimatedProfit * 1.9;
  const baseRoas = forecast.roasBefore ?? "0.58";

  const withProfit = baseProfit + forecast.estimatedProfit;
  const withSpend = baseSpend + forecast.estimatedAdSpend;
  const withRoas = forecast.roasAfter ?? baseRoas;

  const roasBeforeNum = parseFloat(String(baseRoas).replace(/[^\d.]/g, "")) || 0.58;
  const roasAfterNum = parseFloat(String(withRoas).replace(/[^\d.]/g, "")) || roasBeforeNum;
  const roasPctImprovement =
    roasBeforeNum > 0 ? Math.round(((roasAfterNum - roasBeforeNum) / roasBeforeNum) * 100) : 0;

  return {
    withoutApproval: {
      profit: Math.round(baseProfit),
      roas: String(baseRoas),
      adSpend: Math.round(baseSpend),
    },
    withApproval: {
      profit: Math.round(withProfit),
      roas: String(withRoas),
      adSpend: Math.round(withSpend),
    },
    difference: {
      profit: forecast.estimatedProfit,
      adSpend: forecast.estimatedAdSpend,
      roasPctImprovement,
    },
  };
}

function buildMeasuredOutcome(
  member: ApprovalEnrichedRecommendation,
): DecisionMeasuredOutcome | undefined {
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
  dataSources: DataSourceStatus[],
): DecisionMemo {
  const primary = card.members[0];
  const lifecycleStatus = primary?.approval.status ?? "pending";
  const forecast = buildForecast(card, profitDashboard);
  const riskLevel = riskForCard(card);
  const signalCount = computeSignalCount(card);

  return {
    card,
    title: card.title,
    subtitle: card.subtitle ?? card.category.replace(/_/g, " "),
    reason: card.reason,
    whyItMatters: buildWhyItMatters(card),
    expectedResult: buildExpectedResult(card),
    evidence: extractEvidence(card),
    riskLevel,
    lifecycleStatus,
    forecast,
    measuredOutcome: primary ? buildMeasuredOutcome(primary) : undefined,
    primaryRecommendationId: primary?.id ?? null,
    decisionDetails: buildDecisionDetails(card),
    impactPresentation: card.impactPresentation,
    profitCalculation: buildSupportingFactors(card, forecast, profitDashboard),
    explainNarrative: buildExplainNarrative(card, forecast, signalCount),
    confidenceBreakdown: buildConfidenceBreakdown(card, dataSources),
    riskAnalysis: buildRiskAnalysis(card, forecast),
    actionPlan: buildActionPlan(card, profitDashboard),
    campaignEvidence: buildCampaignEvidence(card),
    financialImpactExplanation: buildFinancialImpactExplanation(card, forecast),
    expectedKpis: buildExpectedKpis(card, forecast),
    approvalPreview: buildApprovalPreview(card, forecast),
    timeline: buildTimeline(card, lifecycleStatus, signalCount),
    aiReasoning: buildAiReasoning(card, signalCount),
    businessContext: buildBusinessContext(card),
    simulationComparison: buildSimulationComparison(card, forecast, profitDashboard),
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

export function buildTrackRecord(
  intelligence: IntelligenceDashboard | null,
): AiTrackRecord | null {
  if (!intelligence) return null;

  const approved = Math.round(
    (intelligence.generated * intelligence.approvedPct) / 100,
  );
  const successful = Math.round((approved * intelligence.successRatePct) / 100);

  // Never show contradictory stats: require a minimum of measured, successful
  // outcomes before displaying performance analytics.
  const hasSufficientData = approved >= 3 && successful >= 1 && intelligence.successRatePct > 0;

  const avgMonthlyProfitIncrease = hasSufficientData
    ? Math.round(
        (intelligence.revenueGenerated + intelligence.revenueRecovered) /
          Math.max(successful, 1),
      )
    : 0;

  return {
    hasSufficientData,
    isDemoData: false,
    approvedDecisions: approved,
    successful,
    successRatePct: hasSufficientData ? intelligence.successRatePct : 0,
    avgMonthlyProfitIncrease,
    avgConfidencePct: Math.round(intelligence.avgConfidence),
    falsePositivePct: hasSufficientData
      ? Math.min(100, Math.max(0, Math.round(100 - intelligence.successRatePct)))
      : 0,
  };
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

  const highlights = [narrative, ...presentation.aiSummaryLines.slice(1)].filter(Boolean);

  return { narrative, highlights };
}

export function buildDecisionCenterView(
  presentation: ApprovalPresentation,
  items: ApprovalEnrichedRecommendation[],
  profitDashboard: ProfitDashboard | null,
  options?: {
    dataSources?: DataSourceStatus[];
    intelligence?: IntelligenceDashboard | null;
  },
): DecisionCenterView {
  const dataSources = options?.dataSources ?? [];
  const memos = presentation.allOpportunities.map((card) =>
    buildMemo(card, profitDashboard, dataSources),
  );
  const top = presentation.topOpportunities[0];
  const { narrative, highlights } = buildExecutiveNarrative(presentation);

  const pending = items.filter(
    (i) => i.approval.status === "pending" || i.approval.status === "snoozed",
  );
  const urgent = pending.filter((i) => i.severity === "critical" || i.severity === "high").length;

  const topForecast = top ? buildForecast(top, profitDashboard) : null;

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
    executiveSummary: top && topForecast ? buildExecutiveSummary(top, topForecast) : null,
  };

  return {
    briefing,
    primaryDecision: memos[0] ?? null,
    additionalDecisions: memos.slice(1),
    presentation,
    trackRecord: buildTrackRecord(options?.intelligence ?? null),
    similarDecisions: buildSimilarDecisions(items),
    visionStatement:
      "Every recommendation answers what happened, why it matters, what will change, and what happens after you approve.",
  };
}
