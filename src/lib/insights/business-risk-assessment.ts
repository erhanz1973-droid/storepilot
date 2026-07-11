import { analyzeInventoryContext } from "@/lib/attribution/inventory-context";
import type { AttributionDashboard } from "@/lib/attribution/models";
import type { CustomerIntelligenceDashboard } from "@/lib/customers/engine";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreHealthScore } from "@/lib/store-health/score";
import { buildUnifiedExecutiveBrief } from "./unified-executive-brief";
import type { DashboardSnapshot } from "@/lib/types";

export type BusinessRiskCategory =
  | "profitability"
  | "marketing"
  | "inventory"
  | "customer_retention"
  | "cash_flow"
  | "attribution"
  | "operations";

export type RiskTrendDirection = "increasing" | "stable" | "improving";

export type RiskInactionImpact = {
  label: string;
  value: string;
};

export type RiskTimelineEntry = {
  horizon: "Today" | "1 Week" | "30 Days" | "90 Days";
  consequence: string;
};

export type RiskScoreContributor = {
  label: string;
  points: number;
};

export type RiskFinancialExposure = {
  label: string;
  amountMonthly: number;
};

export type CategoryRiskScore = {
  category: BusinessRiskCategory;
  label: string;
  /** Internal ranking score — UI shows priority rank instead */
  score: number;
  priorityRank: number;
  summary: string;
  businessConsequence: string;
  contributors: RiskScoreContributor[];
  urgency: "Critical" | "High" | "Medium" | "Low";
  timeHorizon: string;
  confidencePct: number;
  probabilityPct: number;
  businessImpactLabel: string;
  businessImpactAmount: number | null;
  businessImpactDisplay: string;
  trendDirection: RiskTrendDirection;
  trendLabel: string;
  financialExposure: RiskFinancialExposure[];
  inactionImpact: RiskInactionImpact[];
  crossBusinessEffects: string[];
  riskTimeline: RiskTimelineEntry[];
};

export type RiskRecommendationStep = {
  step: number;
  action: string;
  reason: string;
  estimatedTime: string;
  expectedBenefit: string;
  expectedBenefitMonthly: number | null;
  riskReductionPct: number;
};

export type WhyNotOtherRisk = {
  label: string;
  reason: string;
};

export type BusinessRiskAssessment = {
  executiveBriefing: string;
  categories: CategoryRiskScore[];
  primaryRisk: {
    category: BusinessRiskCategory;
    title: string;
    reason: string;
    businessConsequence: string;
    urgency: CategoryRiskScore["urgency"];
    timeHorizon: string;
    estimatedExposureMonthly: number;
    estimatedExposureDisplay: string;
    confidencePct: number;
    probabilityPct: number;
    recommendedAction: string;
    rankingRationale: string;
    supportingFactors: string[];
    crossBusinessEffects: string[];
    riskTimeline: RiskTimelineEntry[];
    inactionImpact: RiskInactionImpact[];
    /** @deprecated Use estimatedExposureDisplay */
    businessImpact: "Critical" | "High" | "Medium" | "Low";
  };
  secondaryRisk?: {
    category: BusinessRiskCategory;
    label: string;
    title: string;
    reason: string;
    priorityRank: number;
    estimatedExposureDisplay: string;
  };
  whyNotOtherRisks: WhyNotOtherRisk[];
  rankingExplanation?: string;
  recommendationSteps: RiskRecommendationStep[];
  estimatedExposure: {
    items: RiskFinancialExposure[];
    totalMonthly: number;
  };
};

export type BusinessRiskAssessmentInput = {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  attributionDashboard?: AttributionDashboard | null;
  customerIntelligence?: CustomerIntelligenceDashboard | null;
  productIntelligence?: ProductIntelligenceDashboard | null;
  storeHealth?: StoreHealthScore | null;
  hasActiveAds?: boolean;
  dashboard?: DashboardSnapshot;
};

const CATEGORY_LABELS: Record<BusinessRiskCategory, string> = {
  profitability: "Profitability",
  marketing: "Marketing",
  inventory: "Inventory",
  customer_retention: "Customers",
  cash_flow: "Cash Flow",
  attribution: "Tracking",
  operations: "Operations",
};

const PRIMARY_TITLES: Record<BusinessRiskCategory, string> = {
  profitability: "Unprofitable Operations",
  marketing: "Unprofitable Customer Acquisition",
  inventory: "Inventory Shortage",
  customer_retention: "Customer Retention Risk",
  cash_flow: "Cash Flow Pressure",
  attribution: "Attribution Blind Spots",
  operations: "Operational Efficiency Risk",
};

type ScoringContext = BusinessRiskAssessmentInput;

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function impactFromScore(score: number): BusinessRiskAssessment["primaryRisk"]["businessImpact"] {
  if (score >= 85) return "Critical";
  if (score >= 70) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

function urgencyFromScore(score: number): CategoryRiskScore["urgency"] {
  return impactFromScore(score);
}

function trendForCategory(
  category: BusinessRiskCategory,
  score: number,
  urgency: CategoryRiskScore["urgency"],
): { direction: RiskTrendDirection; label: string } {
  if (score >= 70 || urgency === "Critical" || urgency === "High") {
    return { direction: "increasing", label: "⬆ Increasing" };
  }
  if (score >= 45) {
    return { direction: "stable", label: "➡ Stable" };
  }
  return { direction: "improving", label: "⬇ Improving" };
}

function primaryExposureAmount(exposure: RiskFinancialExposure[]): number {
  return exposure.reduce((s, e) => s + e.amountMonthly, 0);
}

function formatExposureDisplay(amount: number | null, label: string): string {
  if (amount == null || amount <= 0) return label;
  return `$${amount.toLocaleString()}/month`;
}

function businessImpactLabelFor(category: BusinessRiskCategory): string {
  const map: Record<BusinessRiskCategory, string> = {
    profitability: "Potential monthly profit loss",
    marketing: "Potential monthly profit loss",
    inventory: "Potential lost revenue",
    customer_retention: "Potential LTV erosion",
    cash_flow: "Working capital at risk",
    attribution: "Decision accuracy risk",
    operations: "Operational profit drag",
  };
  return map[category];
}

function crossEffectsFor(category: BusinessRiskCategory): string[] {
  const map: Record<BusinessRiskCategory, string[]> = {
    profitability: ["Cash Flow", "Forecast Accuracy", "Reinvestment Capacity"],
    marketing: ["Profitability", "Cash Flow", "Forecast Accuracy", "Customer Growth", "Inventory Planning"],
    inventory: ["Revenue", "Marketing Efficiency", "Cash Flow", "Customer Satisfaction"],
    customer_retention: ["LTV", "Marketing ROI", "Forecast Accuracy"],
    cash_flow: ["Profitability", "Inventory Investment", "Marketing Scale"],
    attribution: ["Marketing Decisions", "Budget Allocation", "Forecast Accuracy"],
    operations: ["Profitability", "Customer Experience", "Refund Costs"],
  };
  return map[category];
}

function timelineFor(category: BusinessRiskCategory, urgency: CategoryRiskScore["urgency"]): RiskTimelineEntry[] {
  if (category === "marketing") {
    return [
      { horizon: "Today", consequence: "Advertising efficiency declining." },
      { horizon: "1 Week", consequence: "Higher acquisition costs." },
      { horizon: "30 Days", consequence: "Lower profitability." },
      { horizon: "90 Days", consequence: "Reduced reinvestment capacity." },
    ];
  }
  if (category === "inventory") {
    return [
      { horizon: "Today", consequence: "Demand cannot be fulfilled." },
      { horizon: "1 Week", consequence: "Lost sales and wasted ad spend." },
      { horizon: "30 Days", consequence: "Customer trust erosion." },
      { horizon: "90 Days", consequence: "Competitors capture market share." },
    ];
  }
  if (category === "cash_flow") {
    return [
      { horizon: "Today", consequence: "Working capital tightening." },
      { horizon: "1 Week", consequence: "Less room for growth investment." },
      { horizon: "30 Days", consequence: "Pressure on inventory and marketing." },
      { horizon: "90 Days", consequence: "Reduced strategic flexibility." },
    ];
  }
  if (category === "profitability") {
    return [
      { horizon: "Today", consequence: "Margin pressure visible in P&L." },
      { horizon: "1 Week", consequence: "Losses compound with spend." },
      { horizon: "30 Days", consequence: "Cash reserves erode." },
      { horizon: "90 Days", consequence: "Growth investment constrained." },
    ];
  }
  const base = urgency === "Critical" || urgency === "High" ? "Risk accelerating." : "Risk manageable.";
  return [
    { horizon: "Today", consequence: base },
    { horizon: "1 Week", consequence: "Impact becomes measurable." },
    { horizon: "30 Days", consequence: "Financial drag increases without action." },
    { horizon: "90 Days", consequence: "Harder and costlier to recover." },
  ];
}

function inactionFor(
  category: BusinessRiskCategory,
  exposure: RiskFinancialExposure[],
  input: ScoringContext,
): RiskInactionImpact[] {
  const monthly = primaryExposureAmount(exposure);
  const ctx = analyzeInventoryContext(input.snapshot);

  if (category === "marketing" && monthly > 0) {
    return [{ label: "Estimated unnecessary ad spend", value: `$${Math.round(monthly * 0.95).toLocaleString()}` }];
  }
  if (category === "cash_flow" && monthly > 0) {
    return [{ label: "Additional working capital locked", value: `$${Math.round(monthly * 0.5).toLocaleString()}` }];
  }
  if (category === "inventory") {
    const daysCover = ctx.avgDaysCover != null ? `${Math.round(ctx.avgDaysCover)} days` : "Limited";
    return [
      {
        label: "Inventory cover",
        value: daysCover,
      },
      {
        label: "Expected markdown risk",
        value: ctx.oosPct > 30 ? "8–12%" : "4–6%",
      },
      ...(monthly > 0
        ? [{ label: "Potential lost revenue", value: `$${monthly.toLocaleString()}` }]
        : []),
    ];
  }
  if (monthly > 0) {
    return [{ label: "Estimated financial exposure", value: `$${monthly.toLocaleString()}` }];
  }
  return [{ label: "Estimated opportunity cost", value: "Increasing weekly" }];
}

function businessConsequenceFor(
  category: BusinessRiskCategory,
  input: ScoringContext,
): string {
  if (category === "marketing") {
    return "Customer acquisition currently costs significantly more than your business can profitably sustain. If this trend continues, advertising spend will grow faster than profitable revenue.";
  }
  if (category === "profitability") {
    return "The business is spending more than it earns on each sale cycle. Without margin recovery, growth investments will deepen losses rather than compound returns.";
  }
  if (category === "inventory") {
    return "Customer demand exists but cannot be fulfilled. Continuing to acquire traffic without stock converts marketing spend into wasted acquisition cost.";
  }
  if (category === "cash_flow") {
    return "Cash is leaving the business faster than profitable operations replace it. This limits your ability to invest in inventory, marketing tests, and growth initiatives.";
  }
  if (category === "customer_retention") {
    return "Too many customers buy once and do not return. Rising acquisition costs cannot be offset if lifetime value remains low.";
  }
  return "This risk area requires attention before it compounds into larger financial pressure.";
}

function enrichCategory(
  base: BaseCategoryRiskScore,
  rank: number,
  input: ScoringContext,
): CategoryRiskScore {
  const amount = primaryExposureAmount(base.financialExposure);
  const trend = trendForCategory(base.category, base.score, base.urgency);
  const impactLabel = businessImpactLabelFor(base.category);

  return {
    ...base,
    priorityRank: rank,
    businessConsequence: businessConsequenceFor(base.category, input),
    probabilityPct: Math.min(95, Math.max(45, base.confidencePct - 5 + Math.round(base.score * 0.08))),
    businessImpactLabel: impactLabel,
    businessImpactAmount: amount > 0 ? amount : null,
    businessImpactDisplay: formatExposureDisplay(amount > 0 ? amount : null, impactLabel),
    trendDirection: trend.direction,
    trendLabel: trend.label,
    inactionImpact: inactionFor(base.category, base.financialExposure, input),
    crossBusinessEffects: crossEffectsFor(base.category),
    riskTimeline: timelineFor(base.category, base.urgency),
  };
}

type BaseCategoryRiskScore = Omit<
  CategoryRiskScore,
  | "priorityRank"
  | "businessConsequence"
  | "probabilityPct"
  | "businessImpactLabel"
  | "businessImpactAmount"
  | "businessImpactDisplay"
  | "trendDirection"
  | "trendLabel"
  | "inactionImpact"
  | "crossBusinessEffects"
  | "riskTimeline"
>;

function buildCategory(
  category: BusinessRiskCategory,
  summary: string,
  contributors: RiskScoreContributor[],
  opts: {
    urgency: CategoryRiskScore["urgency"];
    timeHorizon: string;
    confidencePct: number;
    financialExposure: RiskFinancialExposure[];
  },
): BaseCategoryRiskScore {
  return {
    category,
    label: CATEGORY_LABELS[category],
    score: clampScore(contributors.reduce((s, c) => s + c.points, 0)),
    summary,
    contributors,
    ...opts,
  };
}

function topSellerOutOfStock(snapshot: StoreSnapshot): boolean {
  const sorted = [...(snapshot.products ?? [])].sort(
    (a, b) => b.revenue30d - a.revenue30d,
  );
  return sorted[0]?.inventoryQuantity <= 0;
}

function scoreProfitability(input: ScoringContext): BaseCategoryRiskScore {
  const profit = input.profitDashboard;
  const net = profit?.primary.netProfit ?? 0;
  const revenue = profit?.primary.revenue ?? 0;
  const margin = profit?.primary.profitMarginPct ?? 0;
  const adSpend = profit?.primary.adSpend ?? 0;
  const confidence = profit?.confidence.scorePct ?? 92;

  if (revenue > 0 && net < 0) {
    const contributors: RiskScoreContributor[] = [
      { label: "Negative net profit", points: 45 },
      { label: "Positive sales with negative bottom line", points: 30 },
    ];
    if (adSpend > Math.abs(net) * 0.4) {
      contributors.push({ label: "Acquisition spend amplifying losses", points: 15 });
    }
    contributors.push({ label: "Margin compression", points: 8 });

    return buildCategory(
      "profitability",
      "Negative net profit despite positive sales.",
      contributors,
      {
        urgency: "High",
        timeHorizon: "Within 30 days",
        confidencePct: confidence,
        financialExposure: [
          { label: "Monthly profit gap", amountMonthly: Math.abs(net) },
          ...(adSpend > 0
            ? [{ label: "Advertising waste", amountMonthly: Math.round(adSpend * 0.25) }]
            : []),
        ],
      },
    );
  }

  if (margin != null && margin < 5) {
    return buildCategory(
      "profitability",
      "Profit margins are critically thin.",
      [
        { label: "Net margin below 5%", points: 40 },
        { label: "Limited buffer for ad or cost shocks", points: 22 },
        { label: "Pricing or COGS pressure", points: 10 },
      ],
      {
        urgency: "High",
        timeHorizon: "Within 30 days",
        confidencePct: confidence,
        financialExposure: [
          {
            label: "Margin at risk",
            amountMonthly: Math.round(revenue * 0.05),
          },
        ],
      },
    );
  }

  if (margin != null && margin < 12) {
    return buildCategory(
      "profitability",
      "Profit margins are below healthy benchmarks.",
      [
        { label: "Net margin below 12%", points: 28 },
        { label: "Growth may not translate to profit", points: 12 },
        { label: "Cost structure review needed", points: 8 },
      ],
      {
        urgency: "Medium",
        timeHorizon: "30–60 days",
        confidencePct: confidence,
        financialExposure: [],
      },
    );
  }

  return buildCategory(
    "profitability",
    "Profitability is within a healthy range.",
    [{ label: "Positive net profit trend", points: 16 }],
    {
      urgency: "Low",
      timeHorizon: "Ongoing monitoring",
      confidencePct: confidence,
      financialExposure: [],
    },
  );
}

function scoreMarketing(input: ScoringContext): BaseCategoryRiskScore {
  const attribution = input.attributionDashboard;
  const profit = input.profitDashboard;
  const roasGap = attribution?.strategyPlan?.metricsSummary?.roasGapPct;
  const blendedRoas = profit?.blendedRoas?.blendedRoas30d;
  const breakEven = attribution?.strategyPlan?.breakEvenModel?.breakEvenRoas;
  const adSpend = profit?.primary.adSpend ?? 0;
  const confidence = attribution?.strategyPlan?.confidencePct ?? 88;
  const losingCampaigns =
    attribution?.campaigns.filter((c) => c.netProfit < 0 && c.adSpend > 100).length ?? 0;

  if (roasGap != null && roasGap > 0) {
    const contributors: RiskScoreContributor[] = [
      { label: `ROAS ${Math.round(roasGap)}% below break-even`, points: 45 },
      { label: "Prospecting below target", points: 30 },
    ];
    if (losingCampaigns >= 1) {
      contributors.push({
        label: `${losingCampaigns} unprofitable campaign${losingCampaigns > 1 ? "s" : ""}`,
        points: 15,
      });
    }
    contributors.push({ label: "Budget not aligned to contribution margin", points: 8 });

    return buildCategory(
      "marketing",
      roasGap > 35
        ? "Prospecting ROAS remains below break-even."
        : "Paid acquisition efficiency is below target.",
      contributors,
      {
        urgency: "High",
        timeHorizon: "This week",
        confidencePct: confidence,
        financialExposure: adSpend > 0
          ? [{ label: "Advertising waste", amountMonthly: Math.round(adSpend * (roasGap / 100) * 0.6) }]
          : [],
      },
    );
  }

  if (breakEven != null && blendedRoas != null && blendedRoas < breakEven * 0.9) {
    return buildCategory(
      "marketing",
      "Blended ROAS is below estimated break-even.",
      [
        { label: "Blended ROAS below break-even", points: 42 },
        { label: "Channel mix overweight on prospecting", points: 22 },
        { label: "Creative or audience fatigue possible", points: 12 },
      ],
      {
        urgency: "High",
        timeHorizon: "This week",
        confidencePct: confidence,
        financialExposure: adSpend > 0
          ? [{ label: "Advertising waste", amountMonthly: Math.round(adSpend * 0.2) }]
          : [],
      },
    );
  }

  if (losingCampaigns >= 2) {
    return buildCategory(
      "marketing",
      `${losingCampaigns} campaigns are spending without positive return.`,
      [
        { label: `${losingCampaigns} campaigns with negative return`, points: 38 },
        { label: "Budget not reallocated to winners", points: 18 },
        { label: "ROAS monitoring gap", points: 8 },
      ],
      {
        urgency: "Medium",
        timeHorizon: "This week",
        confidencePct: confidence,
        financialExposure: [],
      },
    );
  }

  return buildCategory(
    "marketing",
    "Marketing efficiency is within acceptable range.",
    [{ label: "ROAS at or above break-even", points: 22 }],
    {
      urgency: "Low",
      timeHorizon: "Ongoing monitoring",
      confidencePct: confidence,
      financialExposure: [],
    },
  );
}

function scoreInventory(input: ScoringContext): BaseCategoryRiskScore {
  const ctx = analyzeInventoryContext(input.snapshot);
  const adSpend = input.profitDashboard?.primary.adSpend ?? 0;
  const revenue = input.profitDashboard?.primary.revenue ?? input.snapshot.storeMetrics?.revenue30d ?? 0;
  const hasAds = Boolean(input.hasActiveAds && adSpend > 0);
  const bestsellerOos = topSellerOutOfStock(input.snapshot);

  if (ctx.severity === "critical") {
    const contributors: RiskScoreContributor[] = [
      {
        label: `${Math.round(ctx.oosPct)}% out of stock`,
        points: 50,
      },
    ];
    if (hasAds) contributors.push({ label: "Active advertising", points: 25 });
    if (bestsellerOos) {
      contributors.push({ label: "Best-selling product unavailable", points: 15 });
    }
    contributors.push({
      label: `Inventory coverage = ${ctx.inStockCount === 0 ? 0 : ctx.avgDaysCover ?? 0} days`,
      points: 10,
    });

    const lostRevenue = Math.round(revenue * Math.min(0.5, ctx.oosPct / 100) * 0.4);
    const adWaste = hasAds ? Math.round(adSpend * 0.35) : 0;

    return buildCategory(
      "inventory",
      ctx.inStockCount === 0
        ? "All tracked inventory is currently out of stock."
        : `${Math.round(ctx.oosPct)}% of tracked inventory is out of stock.`,
      contributors,
      {
        urgency: "Critical",
        timeHorizon: "Immediate (0–3 days)",
        confidencePct: ctx.trackedProducts > 0 ? 99 : 70,
        financialExposure: [
          ...(lostRevenue > 0 ? [{ label: "Potential lost revenue", amountMonthly: lostRevenue }] : []),
          ...(adWaste > 0 ? [{ label: "Advertising waste", amountMonthly: adWaste }] : []),
        ],
      },
    );
  }

  if (ctx.severity === "low") {
    return buildCategory(
      "inventory",
      `${Math.round(ctx.oosPct)}% out of stock — stock pressure may limit growth.`,
      [
        { label: `${Math.round(ctx.oosPct)}% out of stock`, points: 32 },
        { label: "Low days of cover on key SKUs", points: 18 },
        ...(hasAds ? [{ label: "Ads may drive traffic to OOS products", points: 12 }] : []),
      ],
      {
        urgency: "High",
        timeHorizon: "Immediate (0–7 days)",
        confidencePct: 94,
        financialExposure: [
          {
            label: "Potential lost revenue",
            amountMonthly: Math.round(revenue * 0.08),
          },
        ],
      },
    );
  }

  return buildCategory(
    "inventory",
    "Inventory levels support current demand.",
    [{ label: "Healthy stock coverage", points: 14 }],
    {
      urgency: "Low",
      timeHorizon: "Ongoing monitoring",
      confidencePct: 96,
      financialExposure: [],
    },
  );
}

function scoreCustomerRetention(input: ScoringContext): BaseCategoryRiskScore {
  const ci = input.customerIntelligence;
  if (!ci) {
    return buildCategory(
      "customer_retention",
      "Customer data is limited — retention risk not fully assessed.",
      [{ label: "Insufficient customer history", points: 28 }],
      {
        urgency: "Medium",
        timeHorizon: "30–60 days",
        confidencePct: 68,
        financialExposure: [],
      },
    );
  }

  const churnFactor = ci.healthBreakdown.factors.find((f) => f.id === "churn");
  const repeatMeta = ci.executiveSummary.repeatPurchaseRate;
  const repeatPct =
    repeatMeta.status === "verified" || repeatMeta.status === "estimated"
      ? parseFloat(String(repeatMeta.value).replace("%", "")) || null
      : null;
  const confidence = ci.healthBreakdown.status === "verified" ? 85 : 72;

  if (churnFactor && churnFactor.score < 40) {
    return buildCategory(
      "customer_retention",
      "High churn risk among active customers.",
      [
        { label: "Churn risk score elevated", points: 38 },
        { label: "Inactive or at-risk segment growing", points: 28 },
        { label: "Repeat rate below benchmark", points: 14 },
      ],
      {
        urgency: "High",
        timeHorizon: "Within 30 days",
        confidencePct: confidence,
        financialExposure: ci.opportunities[0]
          ? [{ label: "Retention recovery opportunity", amountMonthly: ci.opportunities[0].estimatedImpact }]
          : [],
      },
    );
  }

  if (repeatPct != null && repeatPct < 35) {
    return buildCategory(
      "customer_retention",
      "Low repeat purchase rate.",
      [
        { label: `Repeat purchase rate ${repeatPct}%`, points: repeatPct < 25 ? 38 : 28 },
        { label: "One-time buyer concentration", points: 16 },
        { label: "Post-purchase engagement gap", points: 8 },
      ],
      {
        urgency: repeatPct < 25 ? "High" : "Medium",
        timeHorizon: "30–60 days",
        confidencePct: confidence,
        financialExposure: [],
      },
    );
  }

  return buildCategory(
    "customer_retention",
    "Customer retention is stable.",
    [{ label: "Repeat purchase rate healthy", points: 20 }],
    {
      urgency: "Low",
      timeHorizon: "Ongoing monitoring",
      confidencePct: confidence,
      financialExposure: [],
    },
  );
}

function scoreCashFlow(input: ScoringContext): BaseCategoryRiskScore {
  const profit = input.profitDashboard;
  const net = profit?.primary.netProfit ?? 0;
  const adSpend = profit?.primary.adSpend ?? 0;
  const revenue = profit?.primary.revenue ?? 0;
  const confidence = profit?.confidence.scorePct ?? 86;

  const deadStock = input.snapshot.products.filter(
    (p) => p.inventoryQuantity > 15 && p.unitsSold30d <= 2,
  ).length;

  if (net < 0 && adSpend > 0 && revenue > 0 && adSpend > revenue * 0.12) {
    return buildCategory(
      "cash_flow",
      "Ad spend is burning cash faster than the business generates profit.",
      [
        { label: "Negative net profit", points: 38 },
        { label: "Ad spend > 12% of revenue", points: 28 },
        { label: "Cash burn from acquisition", points: 20 },
      ],
      {
        urgency: "High",
        timeHorizon: "Within 30 days",
        confidencePct: confidence,
        financialExposure: [
          { label: "Monthly cash burn", amountMonthly: Math.abs(net) },
          { label: "Advertising waste", amountMonthly: Math.round(adSpend * 0.2) },
        ],
      },
    );
  }

  if (net < 0) {
    return buildCategory(
      "cash_flow",
      "Negative net profit is tightening cash flow.",
      [
        { label: "Operating at a net loss", points: 42 },
        { label: "Limited cash buffer", points: 22 },
        { label: "Fixed costs may exceed contribution", points: 10 },
      ],
      {
        urgency: "Medium",
        timeHorizon: "30–60 days",
        confidencePct: confidence,
        financialExposure: [{ label: "Monthly cash gap", amountMonthly: Math.abs(net) }],
      },
    );
  }

  if (deadStock >= 3) {
    const tiedUp = deadStock * 400;
    return buildCategory(
      "cash_flow",
      "Cash is tied up in slow-moving inventory.",
      [
        { label: `${deadStock} slow-moving SKUs`, points: 32 },
        { label: "Working capital locked in stock", points: 16 },
        { label: "Turnover below target", points: 8 },
      ],
      {
        urgency: "Medium",
        timeHorizon: "30–60 days",
        confidencePct: 78,
        financialExposure: [{ label: "Working capital tied up", amountMonthly: tiedUp }],
      },
    );
  }

  return buildCategory(
    "cash_flow",
    "Cash flow pressure is manageable.",
    [{ label: "Positive operating cash trend", points: 18 }],
    {
      urgency: "Low",
      timeHorizon: "Ongoing monitoring",
      confidencePct: 84,
      financialExposure: [],
    },
  );
}

function scoreAttribution(input: ScoringContext): BaseCategoryRiskScore {
  const attribution = input.attributionDashboard;
  const qualityPct =
    attribution?.strategyPlan?.confidenceBreakdown?.attributionQualityPct ??
    attribution?.confidence?.scorePct;
  const journeyCount = attribution?.sampleJourneys?.length ?? 0;
  const confidence = qualityPct ?? 75;

  if (!attribution || journeyCount < 8) {
    return buildCategory(
      "attribution",
      "Limited attribution data — tracking gaps may affect decisions.",
      [
        { label: "Fewer than 8 sample journeys", points: 22 },
        { label: "Multi-touch paths incomplete", points: 10 },
        { label: "Decision confidence reduced", points: 6 },
      ],
      {
        urgency: "Medium",
        timeHorizon: "This week",
        confidencePct: 72,
        financialExposure: [],
      },
    );
  }

  if (qualityPct != null && qualityPct < 55) {
    return buildCategory(
      "attribution",
      "Attribution confidence is low — verify pixel and UTM coverage.",
      [
        { label: "Attribution quality below 55%", points: 28 },
        { label: "Pixel or UTM gaps likely", points: 16 },
        { label: "Budget decisions less reliable", points: 8 },
      ],
      {
        urgency: "Medium",
        timeHorizon: "This week",
        confidencePct: confidence,
        financialExposure: [],
      },
    );
  }

  return buildCategory(
    "attribution",
    "Minor attribution gaps.",
    [{ label: "Tracking largely complete", points: 18 }],
    {
      urgency: "Low",
      timeHorizon: "Ongoing monitoring",
      confidencePct: confidence,
      financialExposure: [],
    },
  );
}

function scoreOperations(input: ScoringContext): BaseCategoryRiskScore {
  const profit = input.profitDashboard;
  const revenue = profit?.primary.revenue ?? 0;
  const refunds = profit?.primary.refunds ?? 0;
  const refundRate = revenue > 0 ? refunds / revenue : 0;
  const losingSkus =
    input.productIntelligence?.products.filter((p) => p.status === "Losing Money").length ?? 0;
  const criticalFactor = input.storeHealth?.factors.find((f) => f.factor === "critical_issues");

  const contributors: RiskScoreContributor[] = [];
  if (refundRate > 0.05) contributors.push({ label: "Elevated refund rate", points: 32 });
  if (losingSkus >= 2) {
    contributors.push({ label: `${losingSkus} SKUs losing money`, points: 28 });
  }
  if (criticalFactor && criticalFactor.score < 45) {
    contributors.push({ label: "Critical operational flags", points: 22 });
  }

  if (contributors.length === 0) {
    return buildCategory(
      "operations",
      "Operations are running smoothly.",
      [{ label: "No major operational drag", points: 18 }],
      {
        urgency: "Low",
        timeHorizon: "Ongoing monitoring",
        confidencePct: 80,
        financialExposure: [],
      },
    );
  }

  return buildCategory(
    "operations",
    contributors.map((c) => c.label).join(". ") + ".",
    contributors,
    {
      urgency: urgencyFromScore(contributors.reduce((s, c) => s + c.points, 0)),
      timeHorizon: "Within 30 days",
      confidencePct: 78,
      financialExposure: losingSkus >= 2
        ? [{ label: "SKU profit drag", amountMonthly: Math.round(revenue * 0.03) }]
        : [],
    },
  );
}

const RECOMMENDATION_PLAYBOOKS: Record<
  BusinessRiskCategory,
  RiskRecommendationStep[]
> = {
  inventory: [
    {
      step: 1,
      action: "Replenish inventory for your highest-demand products.",
      reason: "Products are unavailable while advertising is still active.",
    },
    {
      step: 2,
      action: "Reduce paid acquisition until inventory recovers.",
      reason:
        "Continuing to buy traffic for unavailable products increases customer acquisition costs without generating revenue.",
    },
    {
      step: 3,
      action: "Enable back-in-stock notifications.",
      reason:
        "Capture demand and recover sales immediately after inventory is replenished.",
    },
  ],
  profitability: [
    {
      step: 1,
      action: "Identify and fix unprofitable SKUs and campaigns.",
      reason: "Negative net profit means revenue is not covering total costs.",
    },
    {
      step: 2,
      action: "Pause spend below break-even ROAS.",
      reason: "Every dollar on unprofitable acquisition deepens the monthly loss.",
    },
    {
      step: 3,
      action: "Shift merchandising toward highest-margin products.",
      reason: "Margin mix improvement is the fastest path back to profitability.",
    },
  ],
  marketing: [
    {
      step: 1,
      action: "Reduce prospecting budget on underperforming campaigns.",
      reason: "Prospecting ROAS is below break-even and burning budget.",
    },
    {
      step: 2,
      action: "Reallocate budget to retargeting and proven channels.",
      reason: "Existing demand converts faster than cold prospecting at current ROAS.",
    },
    {
      step: 3,
      action: "Refresh creatives on fatigued ad sets.",
      reason: "Creative fatigue often drives ROAS decline before audience exhaustion.",
    },
  ],
  customer_retention: [
    {
      step: 1,
      action: "Launch a win-back flow for inactive customers.",
      reason: "Inactive customers represent recoverable revenue at lower CAC.",
    },
    {
      step: 2,
      action: "Add post-purchase sequences for first-time buyers.",
      reason: "Low repeat rate indicates first purchase is not converting to loyalty.",
    },
    {
      step: 3,
      action: "Reward VIP customers to reduce churn.",
      reason: "Top spenders drive disproportionate LTV — protect them first.",
    },
  ],
  cash_flow: [
    {
      step: 1,
      action: "Reduce discretionary ad spend until cash positive.",
      reason: "Cash burn from acquisition is outpacing profit generation.",
    },
    {
      step: 2,
      action: "Liquidate or discount dead inventory.",
      reason: "Freeing tied-up capital improves runway without new revenue.",
    },
    {
      step: 3,
      action: "Review operational costs against revenue trend.",
      reason: "Fixed cost base may need trimming while revenue recovers.",
    },
  ],
  attribution: [
    {
      step: 1,
      action: "Verify pixel and conversion tracking on all ad platforms.",
      reason: "Budget decisions are unreliable without complete conversion data.",
    },
    {
      step: 2,
      action: "Standardize UTM parameters across campaigns.",
      reason: "Inconsistent UTMs create blind spots in channel performance.",
    },
    {
      step: 3,
      action: "Review multi-touch paths before major budget shifts.",
      reason: "Last-click views may over- or under-credit prospecting vs retargeting.",
    },
  ],
  operations: [
    {
      step: 1,
      action: "Investigate elevated refunds and fulfillment issues.",
      reason: "Refunds directly reduce net profit and signal product or CX problems.",
    },
    {
      step: 2,
      action: "Fix or discontinue losing SKUs.",
      reason: "Negative-margin products drag overall profitability.",
    },
    {
      step: 3,
      action: "Review operational costs against revenue trend.",
      reason: "Ops inefficiency compounds when revenue is under pressure.",
    },
  ],
};

function buildSupportingFactors(input: {
  category: BusinessRiskCategory;
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  attributionDashboard?: AttributionDashboard | null;
  hasActiveAds?: boolean;
}): string[] {
  const factors: string[] = [];
  const inventory = analyzeInventoryContext(input.snapshot);
  const revenueTrend = input.snapshot.salesTrends;
  const adSpend = input.profitDashboard?.primary.adSpend ?? 0;
  const revenue = input.profitDashboard?.primary.revenue ?? 0;

  if (input.hasActiveAds && adSpend > 0) factors.push("Advertising is active.");
  if (inventory.oosPct >= 50 || inventory.inStockCount === 0) {
    factors.push("Products are unavailable.");
  }
  if (revenueTrend && revenueTrend.last30Days.revenue > 0) {
    factors.push("Customer demand continues.");
  }
  if (inventory.severity !== "healthy" && revenue > 0) {
    factors.push("Revenue growth is constrained by stock availability.");
  }
  if (input.profitDashboard?.primary.netProfit != null && input.profitDashboard.primary.netProfit < 0) {
    factors.push("Store is operating at a net loss.");
  }
  const roasGap = input.attributionDashboard?.strategyPlan?.metricsSummary?.roasGapPct;
  if (roasGap != null && roasGap > 0) {
    factors.push("Paid acquisition is below break-even ROAS.");
  }
  if (input.category === "customer_retention") {
    factors.push("Repeat purchase rate is below benchmark.");
  }

  return factors.slice(0, 6);
}

function buildRankingExplanation(
  primary: CategoryRiskScore,
  secondary: CategoryRiskScore,
): string {
  const primaryExposure = primary.businessImpactAmount ?? 0;
  const secondaryExposure = secondary.businessImpactAmount ?? 0;

  return `${primary.label} was ranked above ${secondary.label} because it has higher short-term financial impact ($${primaryExposure.toLocaleString()} vs $${secondaryExposure.toLocaleString()}), lower implementation effort, and an immediate optimization opportunity. ${secondary.label} remains important but is expected to evolve over a longer time horizon.`;
}

function buildWhyNotOtherRisks(
  primary: CategoryRiskScore,
  categories: CategoryRiskScore[],
): WhyNotOtherRisk[] {
  return categories
    .filter((c) => c.category !== primary.category && c.score >= 40)
    .slice(0, 3)
    .map((c) => ({
      label: c.label,
      reason:
        (c.businessImpactAmount ?? 0) < (primary.businessImpactAmount ?? 0)
          ? `Lower short-term financial impact ($${(c.businessImpactAmount ?? 0).toLocaleString()} vs $${(primary.businessImpactAmount ?? 0).toLocaleString()}).`
          : `${c.timeHorizon} — important but secondary to ${primary.label} this week.`,
    }));
}

function buildExecutiveBriefing(
  input: BusinessRiskAssessmentInput,
  primary: CategoryRiskScore,
  secondary?: CategoryRiskScore,
): string {
  const revenue = input.profitDashboard?.primary.revenue ?? 0;
  const net = input.profitDashboard?.primary.netProfit ?? 0;
  const growing = revenue > 0 && net >= 0;

  const opening = growing
    ? "Your business is currently growing revenue, but operational efficiency has deteriorated in key areas."
    : net < 0
      ? "Your business is generating revenue, but profitability has fallen below sustainable levels."
      : "Your business shows mixed signals — some areas are healthy while others need immediate attention.";

  const focus =
    primary.category === "marketing"
      ? "Advertising is consuming more budget than your profitability model supports."
      : primary.category === "inventory"
        ? "Inventory availability is limiting your ability to convert demand into revenue."
        : primary.businessConsequence.split(".")[0] + ".";

  const action =
    primary.category === "marketing"
      ? `Addressing ${primary.label.toLowerCase()} efficiency this week is expected to produce the highest financial impact while reducing future cash flow pressure.`
      : `Resolving ${PRIMARY_TITLES[primary.category].toLowerCase()} this week is expected to produce the highest financial impact.`;

  const secondaryNote = secondary
    ? ` Monitor ${secondary.label.toLowerCase()} next — it remains the second priority.`
    : "";

  return `${opening} ${focus} ${action}${secondaryNote}`;
}

function buildPrimaryReason(category: CategoryRiskScore, input: BusinessRiskAssessmentInput): string {
  return category.businessConsequence;
}

function enrichRecommendationSteps(
  steps: Array<{ step: number; action: string; reason: string }>,
  totalExposure: number,
): RiskRecommendationStep[] {
  const timeByStep = ["10 minutes", "45 minutes", "15 minutes"];
  const benefitWeights = [0.38, 0.28, 0.34];
  const riskReductions = [38, 24, 18];

  return steps.map((step, idx) => {
    const benefitMonthly =
      totalExposure > 0 ? Math.round(totalExposure * (benefitWeights[idx] ?? 0.2)) : null;
    return {
      ...step,
      estimatedTime: timeByStep[idx] ?? "30 minutes",
      expectedBenefit:
        benefitMonthly != null ? `+$${benefitMonthly.toLocaleString()}/month` : "Efficiency improvement",
      expectedBenefitMonthly: benefitMonthly,
      riskReductionPct: riskReductions[idx] ?? 15,
    };
  });
}

function resolveRecommendationSteps(
  input: BusinessRiskAssessmentInput,
  primaryCategory: BusinessRiskCategory,
): RiskRecommendationStep[] {
  const playbook = RECOMMENDATION_PLAYBOOKS[primaryCategory];

  if (input.dashboard) {
    const brief = buildUnifiedExecutiveBrief({
      dashboard: input.dashboard,
      snapshot: input.snapshot,
      customerIntelligence: input.customerIntelligence,
    });
    const topAction = brief.highestPriority;
    if (topAction && topAction.source !== primaryCategory && primaryCategory !== "marketing") {
      return playbook;
    }
    if (topAction && (primaryCategory === "marketing" || primaryCategory === "attribution")) {
      return [
        { step: 1, action: topAction.title, reason: topAction.reason },
        playbook[1]!,
        playbook[2]!,
      ];
    }
  }

  return playbook;
}

function mergeEstimatedExposure(
  primary: CategoryRiskScore,
  secondary?: CategoryRiskScore,
): BusinessRiskAssessment["estimatedExposure"] {
  const items: RiskFinancialExposure[] = [...primary.financialExposure];
  for (const item of secondary?.financialExposure ?? []) {
    if (!items.some((i) => i.label === item.label)) {
      items.push(item);
    }
  }
  const totalMonthly = items.reduce((s, i) => s + i.amountMonthly, 0);
  return { items, totalMonthly };
}

export function buildBusinessRiskAssessment(
  input: BusinessRiskAssessmentInput,
): BusinessRiskAssessment {
  const rawCategories = [
    scoreProfitability(input),
    scoreMarketing(input),
    scoreInventory(input),
    scoreCustomerRetention(input),
    scoreCashFlow(input),
    scoreAttribution(input),
    scoreOperations(input),
  ].sort((a, b) => b.score - a.score);

  const categories = rawCategories.map((c, idx) => enrichCategory(c, idx + 1, input));

  const primary = categories[0]!;
  const secondary = categories[1];
  const scoreGap = secondary ? primary.score - secondary.score : 100;

  const secondaryRisk =
    secondary && secondary.score >= 50
      ? {
          category: secondary.category,
          label: CATEGORY_LABELS[secondary.category],
          title:
            secondary.category === "marketing"
              ? "Unprofitable customer acquisition"
              : PRIMARY_TITLES[secondary.category],
          reason: secondary.businessConsequence,
          priorityRank: secondary.priorityRank,
          estimatedExposureDisplay: secondary.businessImpactDisplay,
        }
      : undefined;

  const rankingExplanation =
    secondary && secondary.score >= 50
      ? buildRankingExplanation(primary, secondary)
      : undefined;

  const supportingFactors = buildSupportingFactors({
    category: primary.category,
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
    attributionDashboard: input.attributionDashboard,
    hasActiveAds: input.hasActiveAds,
  });

  const playbookSteps = resolveRecommendationSteps(input, primary.category);
  const estimatedExposure = mergeEstimatedExposure(primary, secondary);
  const recommendationSteps = enrichRecommendationSteps(
    playbookSteps,
    estimatedExposure.totalMonthly,
  );

  const primaryExposure = primary.businessImpactAmount ?? estimatedExposure.totalMonthly;

  return {
    executiveBriefing: buildExecutiveBriefing(input, primary, secondary),
    categories,
    primaryRisk: {
      category: primary.category,
      title: PRIMARY_TITLES[primary.category],
      reason: buildPrimaryReason(primary, input),
      businessConsequence: primary.businessConsequence,
      urgency: primary.urgency,
      timeHorizon: primary.timeHorizon,
      estimatedExposureMonthly: primaryExposure,
      estimatedExposureDisplay: formatExposureDisplay(
        primaryExposure > 0 ? primaryExposure : null,
        businessImpactLabelFor(primary.category),
      ),
      confidencePct: primary.confidencePct,
      probabilityPct: primary.probabilityPct,
      recommendedAction:
        recommendationSteps[0]?.action ?? "Reduce waste before increasing spend.",
      rankingRationale:
        rankingExplanation ??
        `This risk was ranked first because it has the largest expected financial impact over the next seven days.`,
      supportingFactors,
      crossBusinessEffects: primary.crossBusinessEffects,
      riskTimeline: primary.riskTimeline,
      inactionImpact: primary.inactionImpact,
      businessImpact: impactFromScore(primary.score),
    },
    secondaryRisk,
    whyNotOtherRisks: buildWhyNotOtherRisks(primary, categories),
    rankingExplanation,
    recommendationSteps,
    estimatedExposure,
  };
}
