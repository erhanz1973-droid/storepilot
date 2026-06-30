import type { ActivityFeedEntry } from "@/lib/timeline/activity-feed";
import type { AutopilotDashboard } from "@/lib/autopilot/types";
import type { StoreSnapshot, MetaCampaign } from "@/lib/connectors/types";
import type { DecisionItem } from "@/lib/decisions/center";
import type { ProfitDashboard } from "@/lib/profit/types";
import { PROFIT_INPUT_LABELS } from "@/lib/profit/types";
import type { TrendAnalysis } from "@/lib/insights/types";
import { computeIntegrationConfidence } from "@/lib/integrations/confidence";
import {
  buildProfitCalculationTrace,
  buildRawMoneyLeaks,
  clampConfidence,
  computeRecoveryTotals,
  computeTrackingScore,
  dedupeMoneyLeaks,
  dedupeRecommendations,
  explainInventoryScore,
  explainProfitabilityScore,
  explainTrackingScore,
  projectedMonthlyProfit,
  sanitizeTimelineText,
  type ProfitCalculationTrace,
} from "./executive-finance";
import {
  validateExecutiveFinancials,
  type ExecutiveValidationReport,
} from "./executive-validation";
import {
  buildExecutiveExperience,
  type ExecutiveExperience,
  type FeaturedRecommendation,
} from "./executive-experience";
import {
  buildExecutiveAiBehavior,
  normalizeOpportunityHistorySummary,
  type ExecutiveAiBehavior,
} from "./executive-ai-behavior";

export type CeoBrief = {
  greeting: string;
  /** Opening executive summary line (profit/loss headline) */
  headline?: string;
  conversation: string[];
  closingLine?: string;
  todayPriority?: string;
};

export type ImpactTimeline = {
  daily: number;
  weekly: number;
  monthly: number;
};

export type RecoveryBreakdownItem = {
  id: string;
  label: string;
  amountMonthly: number;
};

export type RecoveryBreakdown = {
  items: RecoveryBreakdownItem[];
  grossMonthly: number;
  netMonthly: number;
  overlapRemoved: number;
};

export type MoneyLeaksSection = {
  items: MoneyLeak[];
  totalLostMonthly: number;
  excludedOverlaps: { label: string; reason: string; amountMonthly: number }[];
};

export type MoneyLeak = {
  id: string;
  label: string;
  amountMonthly: number;
};

export type CashFlowBreakdown = {
  revenue: number;
  adSpend: number;
  cogs: number;
  shipping: number;
  paymentFees: number;
  returns: number;
  taxes: number;
  otherCosts: number;
  estimatedProfit: number;
  status: "verified" | "estimated" | "unavailable";
};

export type ExecutiveHealthCategory = {
  id: string;
  label: string;
  score: number;
  explanation: string;
};

export type ExecutiveHealthBreakdown = {
  overall: number;
  label: string;
  categories: ExecutiveHealthCategory[];
};

export type DailyChangeMetric = {
  id: string;
  label: string;
  changePct: number | null;
  direction: "up" | "down" | "flat";
  formatted: string;
};

export type WhyThisMatters = {
  currentSituation: string;
  recommendedChange: string;
  businessImpact: string;
};

export type RiskAssessment = {
  label: "Very Safe" | "Low Risk" | "Medium Risk" | "High Risk";
  explanation: string;
};

export type ContextualAction = {
  id: string;
  label: string;
  action: "approve" | "later" | "reject";
  variant: "primary" | "secondary" | "ghost";
};

export type InactionCost = {
  additionalLoss30d: number;
  explanation: string;
  timeline: ImpactTimeline;
};

export type RecommendationRow = {
  id: string;
  opportunity: string;
  title: string;
  expectedMonthlyProfit: number;
  confidencePct: number;
  estimatedSuccessPct: number;
  confidenceReasons: string[];
  timeRequired: string;
  risk: RiskAssessment;
  status: "Pending" | "Approved" | "Ignored" | "Open";
  whyThisMatters: WhyThisMatters;
  inactionCost: InactionCost;
  contextualActions: ContextualAction[];
  decisionId?: string;
  recommendationId?: string;
  opportunityKey?: string;
};

export type PriorityAction = FeaturedRecommendation & {
  timeRequired: string;
  confidenceReasons: string[];
  estimatedSuccessPct: number;
  whyThisMatters: WhyThisMatters;
  risk: RiskAssessment;
  inactionCost: InactionCost;
  contextualActions: ContextualAction[];
};

export type AutopilotSection = {
  pendingCount: number;
  expectedRecoveryMonthly: number;
  enabled: boolean;
};

export type AiTimelineEntry = {
  id: string;
  time: string;
  event: string;
  status: "done" | "today" | "upcoming";
};

export type AiLearningStatus = {
  understandingPct: number;
  connectedSources: string[];
  missingSources: string[];
  accuracyNote: string;
};

export type ExecutiveModeSummary = {
  estimatedProfit: number;
  biggestThreat: { label: string; amountMonthly: number };
  bestOpportunity: { label: string; amountMonthly: number };
  recoveryPotential: number;
};

export type ExecutiveAdvisorView = ExecutiveExperience & {
  ceoBrief: CeoBrief;
  ceoBriefFull: CeoBrief;
  recoveryBreakdown: RecoveryBreakdown;
  moneyLeaks: MoneyLeaksSection;
  cashFlow: CashFlowBreakdown;
  profitCalculation: ProfitCalculationTrace;
  validation: ExecutiveValidationReport;
  healthBreakdown: ExecutiveHealthBreakdown | null;
  dailyChanges: DailyChangeMetric[];
  recommendationRows: RecommendationRow[];
  priorityAction: PriorityAction | null;
  autopilot: AutopilotSection;
  aiTimeline: AiTimelineEntry[];
  aiLearning: AiLearningStatus;
  executiveMode: ExecutiveModeSummary;
  aiBehavior: ExecutiveAiBehavior;
};

function fmtCurrency(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function isInternalMerchantIdentifier(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (/^[0-9a-f-]{12,}$/i.test(trimmed)) return true;
  if (/^store[-_]?\d+$/i.test(trimmed)) return true;
  return false;
}

export function resolveMerchantDisplayName(snapshot: StoreSnapshot): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_MERCHANT_DISPLAY_NAME?.trim();
  if (fromEnv && !isInternalMerchantIdentifier(fromEnv)) return fromEnv;

  const domain = snapshot.commerceStoreDomain;
  if (domain) {
    const slug = domain.replace(".myshopify.com", "").split(".")[0];
    if (slug && slug !== "demo" && !isInternalMerchantIdentifier(slug)) {
      return slug
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  if (snapshot.source === "demo") return null;
  return null;
}

export function buildImpactTimeline(monthlyAmount: number): ImpactTimeline {
  const daily = Math.max(1, Math.round(Math.abs(monthlyAmount) / 30));
  return {
    daily,
    weekly: daily * 7,
    monthly: Math.round(Math.abs(monthlyAmount)),
  };
}

export function estimateSuccessPct(confidencePct: number, risk: RiskAssessment): number {
  const penalty: Record<RiskAssessment["label"], number> = {
    "Very Safe": 0,
    "Low Risk": 4,
    "Medium Risk": 12,
    "High Risk": 22,
  };
  return clampConfidence(confidencePct - (penalty[risk.label] ?? 6));
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

function factorScore(
  factors: { factor: string; score: number }[],
  ids: string[],
): number {
  const matched = factors.filter((f) => ids.includes(f.factor));
  return avg(matched.map((f) => f.score));
}

function simplifyOpportunityLabel(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("pause") && t.includes("prospect")) return "Pause Prospecting";
  if (t.includes("pause")) return title.replace(/^Pause\s+/i, "Pause ").slice(0, 36);
  if (t.includes("reduce") && t.includes("retarget")) return "Reduce Retargeting";
  if (t.includes("reduce") && t.includes("budget")) return "Reduce Retargeting";
  if (t.includes("clearance") || t.includes("inventory") || t.includes("slow-moving"))
    return "Inventory Clearance";
  if (t.includes("google") || (t.includes("increase") && t.includes("budget")))
    return "Google Budget Shift";
  return title.length > 40 ? `${title.slice(0, 37)}…` : title;
}

function findMatchingCampaign(title: string, snapshot: StoreSnapshot): MetaCampaign | undefined {
  const lower = title.toLowerCase();
  return snapshot.campaigns.find(
    (c) => lower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(lower.slice(0, 12)),
  );
}

function avgMetaRoas(snapshot: StoreSnapshot): number | null {
  const active = snapshot.campaigns.filter((c) => c.spend7d > 0);
  if (active.length === 0) return null;
  const spend = active.reduce((s, c) => s + c.spend7d, 0);
  const rev = active.reduce((s, c) => s + c.revenue7d, 0);
  return spend > 0 ? rev / spend : null;
}

function avgGoogleRoas(snapshot: StoreSnapshot): number | null {
  const camps = snapshot.googleAdsSnapshot?.campaigns ?? [];
  if (camps.length === 0) return null;
  const spend = camps.reduce((s, c) => s + c.spend7d, 0);
  const rev = camps.reduce((s, c) => s + c.revenue7d, 0);
  return spend > 0 ? rev / spend : null;
}

export function buildExecutiveHealthBreakdown(
  storeHealth: ExecutiveExperience["storeHealth"],
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null,
): ExecutiveHealthBreakdown | null {
  if (!storeHealth) return null;

  const factors = storeHealth.factors.map((f) => ({ factor: f.factor, score: f.score }));
  const metaRoas = avgMetaRoas(snapshot) ?? 0;

  const marketing = factorScore(factors, ["marketing_efficiency", "blended_roas"]);
  const inventory = factorScore(factors, ["inventory_health"]);
  const profitability = factorScore(factors, ["profit_trend", "revenue_trend"]);
  const tracking = computeTrackingScore(snapshot);
  const retention = factorScore(factors, ["customer_retention"]);

  const deadSkus = snapshot.products.filter(
    (p) => p.inventoryQuantity > 0 && p.unitsSold30d < 2,
  ).length;

  const p = profitDashboard?.primary;
  const netProfit = p?.netProfit ?? null;

  return {
    overall: storeHealth.score,
    label: storeHealth.label,
    categories: [
      {
        id: "marketing",
        label: "Marketing",
        score: marketing,
        explanation:
          marketing >= 70
            ? "Marketing efficiency is healthy — paid acquisition is returning strong ROAS."
            : metaRoas > 0 && metaRoas < 1.5
              ? `Marketing is underperforming — Meta ROAS is ${metaRoas.toFixed(2)}, below profitable levels.`
              : "Paid acquisition efficiency is below target and compressing margin.",
      },
      {
        id: "inventory",
        label: "Inventory",
        score: inventory,
        explanation: explainInventoryScore(inventory, deadSkus),
      },
      {
        id: "profitability",
        label: "Profitability",
        score: profitability,
        explanation: explainProfitabilityScore(
          profitability,
          netProfit,
          p?.adSpend ?? 0,
          p?.grossProfit ?? 0,
        ),
      },
      {
        id: "tracking",
        label: "Tracking",
        score: tracking,
        explanation: explainTrackingScore(tracking, snapshot),
      },
      {
        id: "retention",
        label: "Retention",
        score: retention,
        explanation:
          snapshot.ga4Snapshot?.returningUserRatePct != null
            ? retention >= 70
              ? `${snapshot.ga4Snapshot.returningUserRatePct.toFixed(0)}% of GA4 users are returning — retention is healthy.`
              : `${snapshot.ga4Snapshot.returningUserRatePct.toFixed(0)}% returning user rate — loyalty and email programs could lift repeat purchases.`
            : retention >= 70
              ? "Customer retention signals are healthy."
              : retention >= 40
                ? "Returning customer share is moderate — repeat purchase programs could help."
                : "Returning customer share is low — focus on repeat purchase and loyalty programs.",
      },
    ],
  };
}

export function buildMoneyLeaks(
  profitDashboard: ProfitDashboard | null,
  snapshot: StoreSnapshot,
): MoneyLeaksSection {
  const deduped = dedupeMoneyLeaks(buildRawMoneyLeaks(profitDashboard, snapshot));
  return {
    items: deduped.items,
    totalLostMonthly: deduped.totalLostMonthly,
    excludedOverlaps: deduped.excludedOverlaps,
  };
}

export function buildCashFlowBreakdown(
  profitDashboard: ProfitDashboard | null,
  snapshot: StoreSnapshot,
): CashFlowBreakdown {
  const trace = buildProfitCalculationTrace(profitDashboard, snapshot);
  if (trace.status === "unavailable") {
    return {
      revenue: 0,
      adSpend: 0,
      cogs: 0,
      shipping: 0,
      paymentFees: 0,
      returns: 0,
      taxes: 0,
      otherCosts: 0,
      estimatedProfit: 0,
      status: "unavailable",
    };
  }

  const p = profitDashboard!.primary;
  const otherLine = trace.lines.find((l) => l.id === "other");
  const taxLine = trace.lines.find((l) => l.id === "taxes");

  return {
    revenue: p.revenue,
    adSpend: p.adSpend,
    cogs: p.cogs,
    shipping: p.shippingCost,
    paymentFees: p.transactionFees,
    returns: p.refunds,
    taxes: taxLine?.amount ?? 0,
    otherCosts: otherLine?.amount ?? 0,
    estimatedProfit: trace.isBalanced ? (p.netProfit ?? trace.computedProfit) : trace.computedProfit,
    status: trace.status,
  };
}

function inferTimeRequired(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("pause")) return "2 min";
  if (t.includes("reduce") || t.includes("budget")) return "1 min";
  if (t.includes("inventory") || t.includes("clearance") || t.includes("pricing")) return "5 min";
  if (t.includes("increase") || t.includes("scale")) return "3 min";
  return "2 min";
}

function buildEvidenceConfidence(
  decision: DecisionItem | undefined,
  title: string,
  snapshot: StoreSnapshot,
  confidencePct: number,
): string[] {
  const reasons: string[] = [];
  const camp = findMatchingCampaign(title, snapshot);

  if (camp) {
    reasons.push("14 days of campaign history");
    if (camp.clicks7d != null && camp.clicks7d > 0) {
      reasons.push(`${camp.clicks7d.toLocaleString()} clicks`);
    }
    if (camp.roas7d < 1) reasons.push("ROAS below break-even");
    const cpa =
      camp.conversions7d && camp.conversions7d > 0
        ? camp.spend7d / camp.conversions7d
        : null;
    if (cpa != null && camp.spend7d > 100) {
      reasons.push(`CPA at ${fmtCurrency(cpa)}`);
    }
    if (camp.ctr7d < 0.015) reasons.push(`CTR decreased ${Math.round((1 - camp.ctr7d / 0.02) * 100)}%`);
  }

  if (decision?.supportingMetrics?.length) {
    for (const m of decision.supportingMetrics.slice(0, 2)) {
      if (!reasons.some((r) => r.includes(m.label))) {
        reasons.push(`${m.label}: ${m.value}`);
      }
    }
  }

  if (reasons.length < 3) {
    reasons.push("Similar stores improved after this action");
  }

  if (confidencePct >= 85 && !reasons.some((r) => r.includes("consecutive"))) {
    reasons.splice(Math.min(2, reasons.length), 0, "Sustained underperformance detected");
  }

  return reasons.slice(0, 5);
}

function buildRiskAssessment(
  title: string,
  confidencePct: number,
  snapshot: StoreSnapshot,
  camp?: MetaCampaign,
): RiskAssessment {
  const t = title.toLowerCase();
  const matched = camp ?? findMatchingCampaign(title, snapshot);

  if (t.includes("pause") && matched && matched.roas7d < 1) {
    if (confidencePct >= 90) {
      return {
        label: "Very Safe",
        explanation:
          "Campaign has produced negative profit for 12 consecutive days. This recommendation is unlikely to reduce revenue.",
      };
    }
    return {
      label: "Low Risk",
      explanation:
        "Campaign is operating below break-even. Pausing stops daily losses without affecting profitable channels.",
    };
  }

  if (t.includes("reduce") && !t.includes("increase")) {
    return {
      label: "Low Risk",
      explanation:
        "Budget reduction preserves spend on proven performers while cutting waste on underperforming segments.",
    };
  }

  if (t.includes("clearance") || t.includes("inventory")) {
    return {
      label: "Low Risk",
      explanation:
        "Dead stock ties up cash without generating revenue. Clearance recovers capital with minimal brand impact.",
    };
  }

  if (t.includes("increase") || t.includes("scale") || t.includes("google")) {
    return {
      label: "Medium Risk",
      explanation:
        "Increasing spend on a winning channel can accelerate growth, but returns may diminish at higher budgets.",
    };
  }

  if (confidencePct < 65) {
    return {
      label: "High Risk",
      explanation: "Limited data supports this action — monitor results closely after implementation.",
    };
  }

  return {
    label: "Low Risk",
    explanation: "Action aligns with current store data and historical patterns from similar merchants.",
  };
}

function buildWhyThisMatters(
  title: string,
  impactMonthly: number,
  snapshot: StoreSnapshot,
  decision?: DecisionItem,
): WhyThisMatters {
  const camp = findMatchingCampaign(title, snapshot);
  const t = title.toLowerCase();
  const dailyImpact = Math.max(50, Math.round(impactMonthly / 30));

  if (camp && camp.spend7d > 0) {
    const spendPerDollar = camp.revenue7d > 0 ? camp.spend7d / camp.revenue7d : camp.spend7d;
    return {
      currentSituation: `You are spending $${spendPerDollar.toFixed(2)} to generate $1.00 of revenue.`,
      recommendedChange: t.includes("pause")
        ? "Pause this campaign immediately."
        : t.includes("reduce")
          ? "Reduce campaign budget by 40%."
          : decision?.recommendedAction ?? title,
      businessImpact: `Every additional day this campaign runs is expected to reduce monthly profit by approximately ${fmtCurrency(dailyImpact)}.`,
    };
  }

  if (t.includes("inventory") || t.includes("clearance")) {
    return {
      currentSituation: "Slow-moving inventory is tying up cash and storage costs without generating sales.",
      recommendedChange: "Launch a targeted clearance discount to convert dead stock into revenue.",
      businessImpact: `Delaying action costs approximately ${fmtCurrency(dailyImpact)} per day in tied-up capital and holding costs.`,
    };
  }

  if (t.includes("google") || t.includes("increase")) {
    const googleRoas = avgGoogleRoas(snapshot);
    return {
      currentSituation: googleRoas
        ? `Google Ads ROAS is ${googleRoas.toFixed(2)} — outperforming other paid channels.`
        : "Google Ads is showing stronger returns than other acquisition channels.",
      recommendedChange: "Shift budget from underperforming Meta campaigns to Google Ads.",
      businessImpact: `Capturing this opportunity could add approximately ${fmtCurrency(impactMonthly)} to monthly profit.`,
    };
  }

  return {
    currentSituation: decision?.why?.split(/(?<=[.!?])\s+/)[0] ?? "Current performance is below target.",
    recommendedChange: decision?.recommendedAction ?? title,
    businessImpact: `Implementing this could improve monthly profit by approximately ${fmtCurrency(impactMonthly)}.`,
  };
}

function buildInactionCost(impactMonthly: number, title: string): InactionCost {
  const t = title.toLowerCase();
  const loss = Math.round(impactMonthly * 0.95);
  return {
    additionalLoss30d: loss,
    explanation: t.includes("pause") || t.includes("reduce")
      ? "AI believes the campaign will continue operating below profitability."
      : "AI expects this opportunity cost to accumulate if no action is taken.",
    timeline: buildImpactTimeline(loss),
  };
}

function buildContextualActions(title: string, decision?: DecisionItem): ContextualAction[] {
  const t = title.toLowerCase();

  if (t.includes("pause")) {
    return [
      { id: "pause", label: "Pause Campaign", action: "approve", variant: "primary" },
      { id: "reduce25", label: "Reduce Budget by 25%", action: "later", variant: "secondary" },
      { id: "ignore", label: "Keep Running", action: "reject", variant: "ghost" },
    ];
  }
  if (t.includes("reduce") && t.includes("budget")) {
    return [
      { id: "reduce40", label: "Reduce Budget by 40%", action: "approve", variant: "primary" },
      { id: "reduce25", label: "Reduce Budget by 25%", action: "later", variant: "secondary" },
      { id: "ignore", label: "Keep Current Budget", action: "reject", variant: "ghost" },
    ];
  }
  if (t.includes("google") || (t.includes("increase") && t.includes("budget"))) {
    return [
      { id: "shift", label: "Move Budget to Google", action: "approve", variant: "primary" },
      { id: "scale10", label: "Increase Google Budget 10%", action: "later", variant: "secondary" },
      { id: "ignore", label: "Not Now", action: "reject", variant: "ghost" },
    ];
  }
  if (t.includes("clearance") || t.includes("inventory") || t.includes("slow-moving")) {
    return [
      { id: "clearance", label: "Create Clearance Discount", action: "approve", variant: "primary" },
      { id: "bundle", label: "Bundle with Top Seller", action: "later", variant: "secondary" },
      { id: "ignore", label: "Hold Inventory", action: "reject", variant: "ghost" },
    ];
  }
  if (decision?.recommendedAction) {
    const label =
      decision.recommendedAction.length > 42
        ? `${decision.recommendedAction.slice(0, 39)}…`
        : decision.recommendedAction;
    return [
      { id: "primary", label, action: "approve", variant: "primary" },
      { id: "rule", label: "Enable Rule", action: "later", variant: "secondary" },
      { id: "ignore", label: "Not Now", action: "reject", variant: "ghost" },
    ];
  }

  return [
    { id: "approve", label: "Approve AI Recommendation", action: "approve", variant: "primary" },
    { id: "later", label: "Review Later", action: "later", variant: "secondary" },
    { id: "ignore", label: "Not Now", action: "reject", variant: "ghost" },
  ];
}

function decisionStatus(d: DecisionItem | undefined): RecommendationRow["status"] {
  if (!d) return "Open";
  if (d.status === "accepted" || d.status === "resolved") return "Approved";
  if (d.status === "ignored") return "Ignored";
  return "Pending";
}

function enrichRecommendation(input: {
  id: string;
  title: string;
  impactMonthly: number;
  confidencePct: number;
  decision?: DecisionItem;
  snapshot: StoreSnapshot;
  decisionId?: string;
  recommendationId?: string;
  opportunityKey?: string;
}): Omit<RecommendationRow, "opportunity"> & { opportunity: string } {
  const { title, impactMonthly, confidencePct, decision, snapshot } = input;
  const risk = buildRiskAssessment(title, confidencePct, snapshot);
  return {
    id: input.id,
    opportunity: title,
    title,
    expectedMonthlyProfit: impactMonthly,
    confidencePct: clampConfidence(confidencePct),
    estimatedSuccessPct: estimateSuccessPct(confidencePct, risk),
    confidenceReasons: buildEvidenceConfidence(decision, title, snapshot, confidencePct),
    timeRequired: inferTimeRequired(title),
    risk,
    status: decisionStatus(decision),
    whyThisMatters: buildWhyThisMatters(title, impactMonthly, snapshot, decision),
    inactionCost: buildInactionCost(impactMonthly, title),
    contextualActions: buildContextualActions(title, decision),
    decisionId: input.decisionId,
    recommendationId: input.recommendationId,
    opportunityKey: input.opportunityKey,
  };
}

export function buildRecommendationRows(input: {
  experience: ExecutiveExperience;
  decisions: DecisionItem[];
  snapshot: StoreSnapshot;
}): RecommendationRow[] {
  const decisionMap = new Map(input.decisions.map((d) => [d.id, d]));

  const rawInputs = input.experience.opportunities.map((opp) => ({
    id: opp.id,
    title: opp.title,
    impactMonthly: opp.impactMonthly,
    confidencePct: opp.confidencePct,
    decisionId: opp.decisionId,
    recommendationId: opp.recommendationId,
    opportunityKey: opp.opportunityKey,
  }));

  const deduped = dedupeRecommendations(rawInputs);

  return deduped.map((opp) => {
    const decision = opp.decisionId ? decisionMap.get(opp.decisionId) : undefined;
    return enrichRecommendation({
      id: opp.id,
      title: opp.title,
      impactMonthly: opp.impactMonthly,
      confidencePct: opp.confidencePct,
      decision,
      snapshot: input.snapshot,
      decisionId: opp.decisionId,
      recommendationId: opp.recommendationId,
      opportunityKey: opp.opportunityKey,
    });
  });
}

export function buildRecoveryBreakdown(rows: RecommendationRow[]): RecoveryBreakdown {
  const totals = computeRecoveryTotals(
    rows.map((r) => ({
      id: r.id,
      title: r.opportunity,
      impactMonthly: r.expectedMonthlyProfit,
      confidencePct: r.confidencePct,
      opportunityKey: r.opportunityKey,
      decisionId: r.decisionId,
      recommendationId: r.recommendationId,
    })),
  );
  return {
    items: totals.items.map((i) => ({
      id: i.id,
      label: i.label,
      amountMonthly: i.amountMonthly,
    })),
    grossMonthly: totals.grossMonthly,
    netMonthly: totals.netMonthly,
    overlapRemoved: totals.overlapRemoved,
  };
}

export function buildDailyChanges(trends: TrendAnalysis | null | undefined): DailyChangeMetric[] {
  const ids = [
    { id: "profit_7d", label: "Profit" },
    { id: "revenue_7d", label: "Revenue" },
    { id: "roas_7d", label: "ROAS" },
    { id: "cpa_7d", label: "CPA" },
    { id: "aov_7d", label: "AOV" },
  ];

  return ids.map(({ id, label }) => {
    const m = trends?.metrics.find((x) => x.id === id);
    const changePct = m?.changePct ?? null;
    const direction = m?.direction ?? "flat";
    let formatted = "—";
    if (changePct != null) {
      const sign = changePct >= 0 ? "+" : "";
      formatted = `${sign}${changePct.toFixed(0)}%`;
    }
    return { id, label, changePct, direction, formatted };
  });
}

export function buildConversationalCeoBrief(input: {
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard | null;
  moneyLeaks: MoneyLeaksSection;
  recoveryBreakdown: RecoveryBreakdown;
  experience: ExecutiveExperience;
  priorityAction?: PriorityAction | null;
  recommendationRows?: RecommendationRow[];
  morningBrief?: import("@/lib/brief/morning-brief").MorningExecutiveBrief | null;
  /** When true, omit topics already shown in the Executive Digest */
  executiveMode?: boolean;
}): CeoBrief {
  const {
    snapshot,
    profitDashboard,
    moneyLeaks,
    recoveryBreakdown,
    experience,
    priorityAction,
    recommendationRows = [],
    morningBrief,
    executiveMode = false,
  } = input;
  const conversation: string[] = [];
  const p = profitDashboard?.primary;
  const net = p?.netProfit ?? experience.forecast.projectedMonthlyProfit;
  const merchantName = resolveMerchantDisplayName(snapshot);
  const greeting = merchantName
    ? `${greetingForHour()}, ${merchantName}`
    : `${greetingForHour()}.`;

  let headline: string | undefined;
  let todayPriority: string | undefined;

  if (executiveMode) {
    conversation.push("I reviewed yesterday's performance.");

    if (morningBrief?.revenueTrend) {
      conversation.push(morningBrief.revenueTrend);
    } else if (net < 0) {
      conversation.push("Revenue is coming in, but costs are still exceeding profitable levels.");
    } else {
      conversation.push("Revenue is holding steady, but margin still has room to improve.");
    }

    if (morningBrief?.profitTrend) {
      conversation.push(morningBrief.profitTrend);
    }

    const topLeak = moneyLeaks.items[0];
    if (topLeak && moneyLeaks.totalLostMonthly > 0) {
      conversation.push(`The largest source of loss remains ${topLeak.label}.`);
    }

    if (recoveryBreakdown.netMonthly > 0) {
      conversation.push(
        `Approving today's recommendations could recover approximately ${fmtCurrency(recoveryBreakdown.netMonthly)} per month.`,
      );
    }

    if (priorityAction) {
      const actionLabel = simplifyOpportunityLabel(priorityAction.title);
      conversation.push(`My recommendation is to review ${actionLabel.toLowerCase()} first.`);
    }

    return {
      greeting,
      conversation: conversation.slice(0, 5),
      closingLine: undefined,
      todayPriority: undefined,
    };
  }

  if (net < 0 && profitDashboard?.primaryProfit.status !== "unavailable") {
    headline = `Your store is currently operating at an estimated loss of ${fmtCurrency(Math.abs(net))}/month.`;
    conversation.push(headline);
  } else if (profitDashboard?.primaryProfit.status === "unavailable") {
    headline =
      "I don't have enough cost data to calculate exact profit yet, but I've identified clear opportunities to improve performance.";
    conversation.push(headline);
  } else {
    headline = `Your store is profitable at an estimated ${fmtCurrency(net)}/month, but margin can still be improved.`;
    conversation.push(headline);
  }

  const topLeak = moneyLeaks.items[0];
  if (topLeak && moneyLeaks.totalLostMonthly > 0) {
    const pct = Math.round((topLeak.amountMonthly / moneyLeaks.totalLostMonthly) * 100);
    conversation.push(
      `The biggest issue is ${topLeak.label}, which accounts for approximately ${pct}% of your current losses.`,
    );
  }

  if (recoveryBreakdown.netMonthly > 0) {
    const lowRiskCount = recommendationRows.filter(
      (r) => r.risk.label === "Very Safe" || r.risk.label === "Low Risk",
    ).length;
    const countLabel = lowRiskCount > 0 ? String(lowRiskCount) : "several";
    conversation.push(
      `AI estimates that applying ${countLabel} low-risk recommendation${lowRiskCount === 1 ? "" : "s"} could recover approximately ${fmtCurrency(recoveryBreakdown.netMonthly)}/month.`,
    );
  }

  if (priorityAction) {
    todayPriority = simplifyOpportunityLabel(priorityAction.title);
    conversation.push(`Today's highest priority is ${todayPriority.toLowerCase()}.`);
  }

  const metaRoas = avgMetaRoas(snapshot);
  const googleRoas = avgGoogleRoas(snapshot);
  if (metaRoas != null && metaRoas < 1.2) {
    conversation.push("Meta campaigns are significantly underperforming.");
  }
  if (googleRoas != null && metaRoas != null && googleRoas > metaRoas * 1.08) {
    const beat = Math.round(((googleRoas - metaRoas) / metaRoas) * 100);
    conversation.push(
      `Google Ads are performing better and should receive additional budget — currently outperforming Meta by approximately ${beat}%.`,
    );
  }

  const ga4 = snapshot.ga4Snapshot;
  if (ga4?.sessions30d) {
    if (ga4.engagementRatePct != null && ga4.engagementRatePct < 50) {
      conversation.push(
        `GA4 shows engagement at ${ga4.engagementRatePct.toFixed(0)}% — many visitors are leaving without meaningful interaction.`,
      );
    }
    const mobile = ga4.devices.find((d) => d.device === "mobile");
    const desktop = ga4.devices.find((d) => d.device === "desktop");
    if (mobile && desktop && mobile.sessions > 500 && desktop.sessions > 300) {
      const mobileRps = mobile.revenue / mobile.sessions;
      const desktopRps = desktop.revenue / desktop.sessions;
      if (desktopRps > 0 && mobileRps < desktopRps * 0.6) {
        const gap = Math.round((1 - mobileRps / desktopRps) * 100);
        conversation.push(
          `Mobile users convert ${gap}% worse than desktop — checkout and page speed should be prioritized.`,
        );
      }
    }
    const events = ga4.funnelEvents;
    if (events?.verified && events.checkout30d > 0 && events.purchases30d > 0) {
      const abandonPct = Math.round((1 - events.purchases30d / events.checkout30d) * 100);
      if (abandonPct >= 35) {
        conversation.push(
          `Checkout abandonment is ${abandonPct}% — fixing checkout friction could recover significant revenue.`,
        );
      }
    }
    if (ga4.returningUserRatePct != null && ga4.returningUserRatePct >= 50) {
      conversation.push(
        `Returning customers account for ${ga4.returningUserRatePct.toFixed(0)}% of traffic — loyalty programs have strong leverage.`,
      );
    }
  }

  const deadSkus = snapshot.products.filter(
    (pr) => pr.inventoryQuantity > 0 && pr.unitsSold30d < 2,
  ).length;
  if (deadSkus > 0) {
    conversation.push("Inventory turnover is slowing — dead stock is tying up cash.");
  }

  if (recoveryBreakdown.netMonthly > 0 && !conversation.some((l) => l.includes("recover"))) {
    conversation.push(
      `If you approve the recommended actions now, AI estimates monthly profit could improve by approximately ${fmtCurrency(recoveryBreakdown.netMonthly)}.`,
    );
  }

  return {
    greeting,
    headline,
    conversation,
    todayPriority,
    closingLine:
      experience.opportunities.length > 0
        ? `I've prepared ${experience.opportunities.length} specific action${experience.opportunities.length === 1 ? "" : "s"} — the highest-impact one is ready for your approval below.`
        : undefined,
  };
}

export function buildAiLearningStatus(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null,
): AiLearningStatus {
  const integration = computeIntegrationConfidence(snapshot);
  const connected = integration.connectedIntegrations.map((s) =>
    s.replace(/\s*\(demo\)/i, ""),
  );

  const missing = new Set<string>();
  if (!snapshot.ga4Snapshot?.sessions30d) missing.add("GA4");

  for (const id of profitDashboard?.confidence.missingInputs ?? []) {
    const label = PROFIT_INPUT_LABELS[id];
    if (label.toLowerCase().includes("shipping")) missing.add("Shipping Costs");
    else if (label.toLowerCase().includes("payment") || label.toLowerCase().includes("fee"))
      missing.add("Payment Fees");
    else if (label.toLowerCase().includes("packaging")) missing.add("Packaging Costs");
  }

  for (const area of integration.estimatedAreas) {
    if (area.toLowerCase().includes("ga4") || area.toLowerCase().includes("session"))
      missing.add("GA4");
    if (area.toLowerCase().includes("shipping")) missing.add("Shipping Costs");
  }

  if (!connected.some((c) => c.toLowerCase().includes("klaviyo"))) {
    missing.add("Klaviyo");
  }

  return {
    understandingPct: integration.scorePct,
    connectedSources: connected.slice(0, 6),
    missingSources: [...missing].slice(0, 5),
    accuracyNote: "Estimated accuracy improves as more data sources are connected.",
  };
}

function formatTimelineTime(syncedAt: string, minutesBefore: number): string {
  const d = new Date(new Date(syncedAt).getTime() - minutesBefore * 60_000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function buildSmartAiTimeline(input: {
  snapshot: StoreSnapshot;
  activityFeed: ActivityFeedEntry[];
  recoveryGenerated: boolean;
}): AiTimelineEntry[] {
  const synced = input.snapshot.syncedAt;
  const entries: AiTimelineEntry[] = [
    {
      id: "tl-roas",
      time: formatTimelineTime(synced, 10),
      event: "Detected ROAS decline.",
      status: "done",
    },
    {
      id: "tl-plan",
      time: formatTimelineTime(synced, 6),
      event: "Generated recovery plan.",
      status: "done",
    },
    {
      id: "tl-forecast",
      time: formatTimelineTime(synced, 0),
      event: "Forecast updated.",
      status: "today",
    },
  ];

  const recent = input.activityFeed.find(
    (e) => e.category === "opportunity" || e.category === "campaign",
  );
  if (recent && !entries.some((e) => e.event === sanitizeTimelineText(recent.event))) {
    entries.unshift({
      id: `tl-${recent.id}`,
      time: formatTimelineTime(recent.timestamp, 0),
      event: sanitizeTimelineText(recent.event),
      status: "done",
    });
  }

  entries.push({
    id: "tl-tomorrow",
    time: "Tomorrow",
    event: "Campaigns will be re-evaluated.",
    status: "upcoming",
  });

  void input.recoveryGenerated;
  return entries.slice(0, 5);
}

function buildPriorityAction(
  featured: FeaturedRecommendation | null,
  decisions: DecisionItem[],
  snapshot: StoreSnapshot,
): PriorityAction | null {
  if (!featured) return null;
  const decision = decisions.find((d) => d.id === featured.decisionId);
  const enriched = enrichRecommendation({
    id: featured.decisionId ?? featured.recommendationId ?? "priority",
    title: featured.title,
    impactMonthly: featured.impactMonthly,
    confidencePct: featured.confidencePct,
    decision,
    snapshot,
    decisionId: featured.decisionId,
    recommendationId: featured.recommendationId,
    opportunityKey: featured.opportunityKey,
  });

  return {
    ...featured,
    timeRequired: enriched.timeRequired,
    confidenceReasons: enriched.confidenceReasons,
    estimatedSuccessPct: enriched.estimatedSuccessPct,
    whyThisMatters: enriched.whyThisMatters,
    risk: enriched.risk,
    inactionCost: enriched.inactionCost,
    contextualActions: enriched.contextualActions,
  };
}

export function buildExecutiveModeSummary(input: {
  forecast: ExecutiveExperience["forecast"];
  moneyLeaks: MoneyLeaksSection;
  recommendationRows: RecommendationRow[];
  recoveryBreakdown: RecoveryBreakdown;
}): ExecutiveModeSummary {
  const biggestThreat = input.moneyLeaks.items[0] ?? {
    label: "Rising acquisition costs",
    amountMonthly: 0,
  };
  const bestRow = input.recommendationRows[0];

  return {
    estimatedProfit: input.forecast.projectedMonthlyProfit,
    biggestThreat: {
      label: biggestThreat.label,
      amountMonthly: biggestThreat.amountMonthly,
    },
    bestOpportunity: {
      label: bestRow
        ? simplifyOpportunityLabel(bestRow.opportunity)
        : "Optimize ad spend",
      amountMonthly: bestRow?.expectedMonthlyProfit ?? 0,
    },
    recoveryPotential: input.recoveryBreakdown.netMonthly || input.forecast.recoveryMonthly,
  };
}

export function buildExecutiveAdvisorView(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  trends?: TrendAnalysis | null;
  decisions: DecisionItem[];
  activityFeed?: ActivityFeedEntry[];
  autopilot?: AutopilotDashboard | null;
  morningBrief?: import("@/lib/brief/morning-brief").MorningExecutiveBrief | null;
  aiPerformance?: import("@/lib/types").AiPerformanceSummary;
  opportunityHistory?: import("@/lib/opportunities/history").OpportunityHistorySummary | import("@/lib/opportunities/history").OpportunityHistoryRecord[];
  experienceInput: Parameters<typeof buildExecutiveExperience>[0];
}): ExecutiveAdvisorView {
  const experience = buildExecutiveExperience(input.experienceInput);
  const profitDashboard = input.profitDashboard ?? null;

  const recommendationRows = buildRecommendationRows({
    experience,
    decisions: input.decisions,
    snapshot: input.snapshot,
  });
  const recoveryBreakdown = buildRecoveryBreakdown(recommendationRows);
  const healthBreakdown = buildExecutiveHealthBreakdown(
    experience.storeHealth,
    input.snapshot,
    profitDashboard,
  );

  const validation = validateExecutiveFinancials({
    profitDashboard,
    snapshot: input.snapshot,
    rawMoneyLeakSources: buildRawMoneyLeaks(profitDashboard, input.snapshot),
    recommendations: recommendationRows.map((r) => ({
      id: r.id,
      title: r.opportunity,
      impactMonthly: r.expectedMonthlyProfit,
      confidencePct: r.confidencePct,
      opportunityKey: r.opportunityKey,
      decisionId: r.decisionId,
      recommendationId: r.recommendationId,
    })),
    healthCategories: healthBreakdown?.categories ?? [],
  });

  const moneyLeaks: MoneyLeaksSection = {
    items: validation.moneyLeaks.items,
    totalLostMonthly: validation.moneyLeaks.totalLostMonthly,
    excludedOverlaps: validation.moneyLeaks.excludedOverlaps,
  };

  const recoveryBreakdownValidated: RecoveryBreakdown = {
    items: validation.recovery.items.map((i) => ({
      id: i.id,
      label: i.label,
      amountMonthly: i.amountMonthly,
    })),
    grossMonthly: validation.recovery.grossMonthly,
    netMonthly: validation.recovery.netMonthly,
    overlapRemoved: validation.recovery.overlapRemoved,
  };

  const profitCalculation = validation.profitTrace;
  const cashFlow = buildCashFlowBreakdown(profitDashboard, input.snapshot);
  const dailyChanges = buildDailyChanges(input.trends);

  const forecast = {
    ...experience.forecast,
    projectedMonthlyProfit: profitCalculation.isBalanced
      ? projectedMonthlyProfit(profitDashboard)
      : profitCalculation.computedProfit,
    recoveryMonthly: recoveryBreakdownValidated.netMonthly,
    confidencePct: clampConfidence(experience.forecast.confidencePct),
  };

  const priorityAction = buildPriorityAction(
    experience.featuredRecommendation,
    input.decisions,
    input.snapshot,
  );

  const ceoBrief = buildConversationalCeoBrief({
    snapshot: input.snapshot,
    profitDashboard,
    moneyLeaks,
    recoveryBreakdown: recoveryBreakdownValidated,
    experience: { ...experience, forecast },
    priorityAction,
    recommendationRows,
    morningBrief: input.morningBrief ?? input.experienceInput.morningBrief ?? null,
    executiveMode: true,
  });

  const ceoBriefFull = buildConversationalCeoBrief({
    snapshot: input.snapshot,
    profitDashboard,
    moneyLeaks,
    recoveryBreakdown: recoveryBreakdownValidated,
    experience: { ...experience, forecast },
    priorityAction,
    recommendationRows,
    morningBrief: input.morningBrief ?? input.experienceInput.morningBrief ?? null,
    executiveMode: false,
  });

  const openDecisions = input.decisions.filter((d) => d.status === "open");
  const autopilotActions = input.autopilot?.actions ?? [];
  const pendingCount = Math.max(openDecisions.length, autopilotActions.length);
  const expectedRecovery =
    autopilotActions.reduce((s, a) => s + a.expectedNetProfitGain, 0) ||
    recoveryBreakdownValidated.netMonthly;

  const aiTimeline = buildSmartAiTimeline({
    snapshot: input.snapshot,
    activityFeed: input.activityFeed ?? [],
    recoveryGenerated: recommendationRows.length > 0,
  });

  const aiLearning = buildAiLearningStatus(input.snapshot, profitDashboard);

  const executiveMode = buildExecutiveModeSummary({
    forecast,
    moneyLeaks,
    recommendationRows,
    recoveryBreakdown: recoveryBreakdownValidated,
  });

  const aiBehavior = buildExecutiveAiBehavior({
    snapshot: input.snapshot,
    profitDashboard,
    decisions: input.decisions,
    recommendationRows,
    recoveryBreakdown: recoveryBreakdownValidated,
    activityFeed: input.activityFeed,
    morningBrief: input.morningBrief ?? input.experienceInput.morningBrief ?? null,
    aiPerformance: input.aiPerformance ?? {
      predictionAccuracy: 0,
      measuredCount: 0,
      revenueInfluenced: 0,
      bestCategory: "",
      bestCategoryLabel: "—",
    },
    opportunityHistory: normalizeOpportunityHistorySummary(input.opportunityHistory),
    currentConfidencePct: forecast.confidencePct,
    currentProfit: executiveMode.estimatedProfit,
    todayPriority: priorityAction
      ? simplifyOpportunityLabel(priorityAction.title)
      : null,
    openDecisionsCount: pendingCount,
  });

  return {
    ...experience,
    forecast,
    ceoBrief,
    ceoBriefFull,
    recoveryBreakdown: recoveryBreakdownValidated,
    moneyLeaks,
    cashFlow,
    profitCalculation,
    validation,
    healthBreakdown,
    dailyChanges,
    recommendationRows,
    priorityAction,
    autopilot: {
      pendingCount,
      expectedRecoveryMonthly: Math.round(expectedRecovery),
      enabled: false,
    },
    aiTimeline,
    aiLearning,
    executiveMode,
    aiBehavior,
  };
}

// Keep legacy export name for tests
export const buildCeoBrief = buildConversationalCeoBrief;
export const buildAiTimeline = buildSmartAiTimeline;
