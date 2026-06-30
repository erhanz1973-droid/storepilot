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
  score: number;
  summary: string;
  contributors: RiskScoreContributor[];
  urgency: "Critical" | "High" | "Medium" | "Low";
  timeHorizon: string;
  confidencePct: number;
  financialExposure: RiskFinancialExposure[];
};

export type RiskRecommendationStep = {
  step: number;
  action: string;
  reason: string;
};

export type BusinessRiskAssessment = {
  categories: CategoryRiskScore[];
  primaryRisk: {
    category: BusinessRiskCategory;
    title: string;
    reason: string;
    businessImpact: "Critical" | "High" | "Medium" | "Low";
    confidencePct: number;
    supportingFactors: string[];
  };
  secondaryRisk?: {
    category: BusinessRiskCategory;
    label: string;
    title: string;
    reason: string;
  };
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
): CategoryRiskScore {
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

function scoreProfitability(input: ScoringContext): CategoryRiskScore {
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

function scoreMarketing(input: ScoringContext): CategoryRiskScore {
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

function scoreInventory(input: ScoringContext): CategoryRiskScore {
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

function scoreCustomerRetention(input: ScoringContext): CategoryRiskScore {
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

function scoreCashFlow(input: ScoringContext): CategoryRiskScore {
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
        financialExposure: [],
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

function scoreAttribution(input: ScoringContext): CategoryRiskScore {
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

function scoreOperations(input: ScoringContext): CategoryRiskScore {
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
  const key = `${primary.category}:${secondary.category}`;

  const explanations: Record<string, string> = {
    "inventory:profitability":
      "Inventory ranked first because advertising cannot generate additional sales while products remain unavailable. Profitability ranked second because improving inventory availability is expected to improve advertising efficiency.",
    "inventory:marketing":
      "Inventory ranked first because paid traffic cannot convert when products are unavailable. Marketing ranked second because acquisition efficiency will recover once stock is restored.",
    "profitability:marketing":
      "Profitability ranked first because the business is operating at a net loss. Marketing ranked second because inefficient acquisition is a primary driver of that loss.",
    "profitability:cash_flow":
      "Profitability ranked first because negative net profit is the core financial issue. Cash flow ranked second because the loss is actively consuming working capital.",
    "marketing:profitability":
      "Marketing ranked first because acquisition is below break-even and actively wasting budget. Profitability ranked second because fixing ROAS is the fastest path to restoring margin.",
    "cash_flow:profitability":
      "Cash flow ranked first because the business is burning cash faster than it generates profit. Profitability ranked second because restoring margin will stabilize cash.",
  };

  if (explanations[key]) return explanations[key]!;

  return `${primary.label} ranked first (score ${primary.score}) because ${primary.summary.charAt(0).toLowerCase()}${primary.summary.slice(1)} ${secondary.label} ranked second (score ${secondary.score}) because ${secondary.summary.charAt(0).toLowerCase()}${secondary.summary.slice(1)}`;
}

function buildPrimaryReason(category: CategoryRiskScore, input: BusinessRiskAssessmentInput): string {
  if (category.category === "inventory" && category.score >= 85) {
    return "All tracked inventory is currently out of stock. Continuing paid acquisition may increase advertising costs without generating additional revenue.";
  }

  const execIssue = input.attributionDashboard?.strategyPlan.executiveSummary?.primaryIssue;
  if (category.category === "marketing" && execIssue) return execIssue;

  if (category.category === "profitability" && (input.profitDashboard?.primary.netProfit ?? 0) < 0) {
    const net = input.profitDashboard!.primary.netProfit!;
    const revenue = input.profitDashboard!.primary.revenue;
    return `Net profit is negative at $${Math.abs(net).toLocaleString()} on $${revenue.toLocaleString()} revenue — the business is spending more than it earns.`;
  }

  return category.summary;
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
  const categories = [
    scoreProfitability(input),
    scoreMarketing(input),
    scoreInventory(input),
    scoreCustomerRetention(input),
    scoreCashFlow(input),
    scoreAttribution(input),
    scoreOperations(input),
  ].sort((a, b) => b.score - a.score);

  const primary = categories[0]!;
  const secondary = categories[1];
  const scoreGap = secondary ? primary.score - secondary.score : 100;

  const secondaryRisk =
    secondary && secondary.score >= 50 && scoreGap <= 12
      ? {
          category: secondary.category,
          label: CATEGORY_LABELS[secondary.category],
          title:
            secondary.category === "marketing"
              ? "Unprofitable customer acquisition"
              : PRIMARY_TITLES[secondary.category],
          reason: secondary.summary,
        }
      : undefined;

  const rankingExplanation =
    secondary && scoreGap <= 12 && secondary.score >= 50
      ? buildRankingExplanation(primary, secondary)
      : undefined;

  const supportingFactors = buildSupportingFactors({
    category: primary.category,
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
    attributionDashboard: input.attributionDashboard,
    hasActiveAds: input.hasActiveAds,
  });

  const recommendationSteps = resolveRecommendationSteps(input, primary.category);
  const estimatedExposure = mergeEstimatedExposure(primary, secondary);

  return {
    categories,
    primaryRisk: {
      category: primary.category,
      title: PRIMARY_TITLES[primary.category],
      reason: buildPrimaryReason(primary, input),
      businessImpact: impactFromScore(primary.score),
      confidencePct: primary.confidencePct,
      supportingFactors,
    },
    secondaryRisk,
    rankingExplanation,
    recommendationSteps,
    estimatedExposure,
  };
}
