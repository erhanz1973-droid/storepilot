import { parseRevenueImpact } from "@/lib/approvals/revenue";
import { effortForCategory } from "@/lib/approvals/effort";
import type { BusinessContext } from "@/lib/ai/types";
import { getCategoryLearningStats } from "@/lib/learning/outcomes";
import { simulateDiscount, profitRowToEconomics } from "@/lib/decisions/product-economics";
import { filterSimulationsByPack } from "@/lib/decision-packs/registry";
import type { DecisionPack } from "@/lib/decision-packs/types";
import type {
  Opportunity,
  Recommendation,
  RecommendationCategory,
  SupportingMetric,
} from "@/lib/types";
import {
  SIMULATION_LABELS,
  type ResultBasis,
  type SimulationType,
  type WhatIfSimulationResult,
} from "./what-if-types";

export type { SimulationType, ResultBasis, WhatIfSimulationResult } from "./what-if-types";
export { SIMULATION_LABELS } from "./what-if-types";

const CATEGORY_RISKS: Record<SimulationType, string[]> = {
  increase_price: ["Demand may drop if price elasticity is high", "Competitor pricing may undercut"],
  decrease_price: ["Margin compression without volume lift", "May train customers to wait for discounts"],
  increase_meta_budget: ["ROAS may decay as audience saturates", "Learning phase disruption on major changes"],
  increase_google_budget: ["Search CPC inflation may reduce marginal ROAS", "Budget increases need conversion tracking validation"],
  apply_discount: ["Margin compression if volume lift is insufficient", "May train customers to wait for promotions"],
  pause_campaign: ["Top-of-funnel awareness loss", "Retargeting pool may shrink within 14 days"],
  restock_inventory: ["Supplier lead time may exceed stockout window", "Overstock risk if demand softens"],
  create_bundle: ["Cannibalization of full-price single-SKU sales", "Attach rate assumptions may not hold"],
  add_homepage_feature: ["Homepage changes affect brand positioning", "Seasonal collections may need featured placement"],
};

function weeklyToMonthly(weekly: number): number {
  return Math.round(weekly * 4.33);
}

function profitFromProductDiscount(
  context: BusinessContext,
  hint: string,
  discountPct: number,
): { revenue: number; profit: number; productTitle: string; metrics: SupportingMetric[] } | null {
  const product = matchProduct(context, hint);
  if (!product || !context.profitDashboard) return null;

  const profitRow = (context.profitDashboard.byProduct ?? []).find((row) =>
    row.title.toLowerCase() === product.title.toLowerCase(),
  );
  if (!profitRow) return null;

  const estimate = simulateDiscount(profitRowToEconomics(profitRow), discountPct, context.profitDashboard);
  return {
    revenue: estimate.expectedRevenue,
    profit: estimate.expectedNetProfit,
    productTitle: profitRow.title,
    metrics: [
      { label: "Discount", value: `${Math.round(discountPct * 100)}%` },
      { label: "Expected units (30d)", value: String(Math.round(estimate.expectedUnitsSold)) },
      { label: "Net profit (30d)", value: `$${Math.round(estimate.expectedNetProfit).toLocaleString()}` },
      { label: "COGS source", value: profitRow.costSource },
    ],
  };
}

function marginEstimate(revenue: number, category: RecommendationCategory | Opportunity["category"]): number {
  const marginRates: Record<string, number> = {
    low_inventory: 0.55,
    inventory: 0.55,
    slow_selling: 0.45,
    pricing: 0.45,
    bundle_opportunity: 0.4,
    bundle: 0.4,
    homepage_merchandising: 0.5,
    merchandising: 0.5,
    promotion_opportunity: 0.35,
    customer_retention: 0.35,
    campaign_review: 0.7,
    marketing: 0.7,
  };
  return Math.round(revenue * (marginRates[category] ?? 0.45));
}

function matchCampaign(context: BusinessContext, hint: string) {
  const lower = hint.toLowerCase();
  return (
    context.campaigns.find((c) => lower.includes(c.name.toLowerCase())) ??
    context.campaigns.find((c) => c.roas7d < 1.2) ??
    context.campaigns[0]
  );
}

function matchProduct(context: BusinessContext, hint: string) {
  const lower = hint.toLowerCase();
  return (
    context.lowStockProducts.find((p) => lower.includes(p.title.toLowerCase())) ??
    context.slowProducts.find((p) => lower.includes(p.title.toLowerCase())) ??
    context.topProducts.find((p) => lower.includes(p.title.toLowerCase())) ??
    context.topProducts[0]
  );
}

async function applyHistoricalBasis(
  result: Omit<WhatIfSimulationResult, "basis" | "basisNote">,
  category: RecommendationCategory,
  storeId: string,
): Promise<WhatIfSimulationResult> {
  const stats = await getCategoryLearningStats(storeId);
  const catStats = stats.find((s) => s.category === category);

  if (!catStats || catStats.sampleSize < 2) {
    return {
      ...result,
      basis: "prediction",
      basisNote:
        "Model-based forecast from current store metrics. No sufficient measured outcomes for this category yet.",
    };
  }

  const adjustedRevenue = Math.round(
    result.expectedMonthlyRevenue * (catStats.avgRealizationPct / 100),
  );
  const adjustedProfit = Math.round(
    result.expectedMonthlyProfit * (catStats.avgRealizationPct / 100),
  );

  return {
    ...result,
    expectedMonthlyRevenue: adjustedRevenue,
    expectedMonthlyProfit: adjustedProfit,
    confidence: Math.min(0.95, result.confidence * 0.9 + (catStats.avgAccuracyPct / 100) * 0.1),
    basis: "measured_historical",
    basisNote: `Blended with ${catStats.sampleSize} measured outcomes in this category (avg ${catStats.avgRealizationPct}% of predicted impact).`,
    historicalSampleSize: catStats.sampleSize,
    historicalRealizationPct: catStats.avgRealizationPct,
  };
}

export function getAvailableSimulations(input: {
  recommendation?: Recommendation;
  opportunity?: Opportunity;
  decisionPack?: DecisionPack;
}): SimulationType[] {
  const rec = input.recommendation;
  const opp = input.opportunity;
  let types: SimulationType[] = [];

  if (rec) {
    switch (rec.category) {
      case "low_inventory":
        types = ["restock_inventory"];
        break;
      case "slow_selling":
        types = ["apply_discount", "create_bundle", "increase_price", "decrease_price"];
        break;
      case "bundle_opportunity":
        types = ["create_bundle"];
        break;
      case "homepage_merchandising":
        types = ["add_homepage_feature"];
        break;
      case "promotion_opportunity":
        types = ["decrease_price"];
        break;
      case "campaign_review":
        types = rec.title.toLowerCase().includes("scale")
          ? ["increase_meta_budget"]
          : ["pause_campaign", "increase_meta_budget"];
        break;
      default:
        types = [];
    }
  } else if (opp) {
    switch (opp.category) {
      case "inventory":
        types = ["restock_inventory"];
        break;
      case "pricing":
        types = ["increase_price", "decrease_price"];
        break;
      case "bundle":
        types = ["create_bundle"];
        break;
      case "merchandising":
        types = ["add_homepage_feature"];
        break;
      case "marketing":
        types = opp.title.toLowerCase().includes("scale")
          ? ["increase_meta_budget"]
          : ["pause_campaign", "increase_meta_budget"];
        break;
      case "customer_retention":
        types = ["decrease_price"];
        break;
      default:
        types = [];
    }
  }

  if (input.decisionPack) {
    return filterSimulationsByPack(types, input.decisionPack);
  }
  return types;
}

export async function runWhatIfSimulation(
  context: BusinessContext,
  params: {
    simulationType: SimulationType;
    recommendation?: Recommendation;
    opportunity?: Opportunity;
    priceChangePct?: number;
    budgetChangePct?: number;
    restockPct?: number;
  },
): Promise<WhatIfSimulationResult | null> {
  const rec = params.recommendation;
  const opp = params.opportunity;
  const hint = rec?.title ?? opp?.title ?? "";
  const category = rec?.category ?? mapOppCategory(opp?.category) ?? "low_inventory";
  const baseImpact =
    rec != null
      ? parseRevenueImpact(rec.expectedImpact)
      : opp?.estimatedMonthlyRevenueImpact ?? 0;

  const id = `${params.simulationType}-${rec?.id ?? opp?.id ?? "anon"}-${Date.now()}`;
  let draft: Omit<WhatIfSimulationResult, "basis" | "basisNote"> | null = null;

  switch (params.simulationType) {
    case "restock_inventory": {
      const product = matchProduct(context, hint);
      if (!product) return null;
      const pct = params.restockPct ?? 0.25;
      const inventory = product.inventory;
      const velocity =
        "unitsSold30d" in product
          ? (product as { unitsSold30d: number }).unitsSold30d / 30
          : 4;
      const addedUnits = Math.round(inventory * pct);
      const monthlyRevenue = weeklyToMonthly(Math.round(velocity * addedUnits * 0.7 * 89));

      draft = {
        id,
        simulationType: "restock_inventory",
        label: SIMULATION_LABELS.restock_inventory,
        summary: `Restocking ~${addedUnits} units (${Math.round(pct * 100)}% increase) on ${product.title} could capture demand before stockout.`,
        expectedMonthlyRevenue: monthlyRevenue || baseImpact,
        expectedMonthlyProfit: marginEstimate(monthlyRevenue || baseImpact, category),
        confidence: 0.74,
        risks: CATEGORY_RISKS.restock_inventory,
        implementationEffort: "Low",
        metrics: [
          { label: "Current inventory", value: String(inventory) },
          { label: "Added units", value: String(addedUnits) },
          { label: "Daily velocity", value: velocity.toFixed(1) },
        ],
      };
      break;
    }

    case "increase_price":
    case "decrease_price": {
      const product = matchProduct(context, hint);
      const pct = params.priceChangePct ?? (params.simulationType === "increase_price" ? 0.05 : -0.1);
      const monthlyBase =
        product && "revenue30d" in product
          ? (product as { revenue30d: number }).revenue30d
          : baseImpact * 4;
      const elasticity = params.simulationType === "increase_price" ? -0.8 : 1.2;
      const volumeChange = pct * elasticity;
      const revenueChange = monthlyBase * (pct + volumeChange);
      const monthlyRevenue = Math.max(0, Math.round(revenueChange));

      draft = {
        id,
        simulationType: params.simulationType,
        label: SIMULATION_LABELS[params.simulationType],
        summary: `${params.simulationType === "increase_price" ? "Raising" : "Lowering"} price ${Math.abs(Math.round(pct * 100))}% on ${product?.title ?? "target SKU"} with modeled elasticity.`,
        expectedMonthlyRevenue: monthlyRevenue || Math.round(baseImpact * 0.8),
        expectedMonthlyProfit: marginEstimate(monthlyRevenue || baseImpact, category),
        confidence: params.simulationType === "increase_price" ? 0.62 : 0.68,
        risks: CATEGORY_RISKS[params.simulationType],
        implementationEffort: "Medium",
        metrics: [
          { label: "Price change", value: `${pct > 0 ? "+" : ""}${Math.round(pct * 100)}%` },
          { label: "Volume impact (est.)", value: `${Math.round(volumeChange * 100)}%` },
        ],
      };
      break;
    }

    case "increase_meta_budget": {
      if (!context.hasActiveAdsConnector) {
        return {
          id,
          simulationType: "increase_meta_budget",
          label: SIMULATION_LABELS.increase_meta_budget,
          summary: "Connect Meta Ads to model budget scaling scenarios.",
          basis: "prediction",
          basisNote: "No ad platform connected.",
          expectedMonthlyRevenue: 0,
          expectedMonthlyProfit: 0,
          confidence: 1,
          risks: [],
          implementationEffort: "Medium",
          metrics: [],
        };
      }
      const campaign = matchCampaign(context, hint);
      if (!campaign) return null;
      const pct = params.budgetChangePct ?? 0.2;
      const incrementalWeekly = Math.round(campaign.spend7d * pct * campaign.roas7d);
      const monthlyRevenue = weeklyToMonthly(incrementalWeekly);

      draft = {
        id,
        simulationType: "increase_meta_budget",
        label: SIMULATION_LABELS.increase_meta_budget,
        summary: `Increasing ${campaign.name} budget ${Math.round(pct * 100)}% at current ROAS ${campaign.roas7d.toFixed(2)}.`,
        expectedMonthlyRevenue: monthlyRevenue || baseImpact,
        expectedMonthlyProfit: marginEstimate(monthlyRevenue || baseImpact, category),
        confidence: campaign.roas7d >= 2 ? 0.76 : 0.58,
        risks: CATEGORY_RISKS.increase_meta_budget,
        implementationEffort: "Medium",
        metrics: [
          { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2) },
          { label: "Budget increase", value: `+${Math.round(pct * 100)}%` },
          { label: "7-day spend", value: `$${campaign.spend7d}` },
          { label: "Expected purchases/wk", value: String(Math.round(incrementalWeekly / Math.max(context.storeMetrics.aov30d, 1))) },
        ],
      };
      break;
    }

    case "increase_google_budget": {
      const googleCamp = context.attributionDashboard?.campaigns.find(
        (c) => c.channelId === "google_ads" || c.campaignName.toLowerCase().includes("search"),
      );
      const spend7 = googleCamp?.adSpend ?? context.profitDashboard?.primary.adSpend ?? 0;
      const rev7 = googleCamp?.revenue ?? spend7 * (context.profitDashboard?.blendedRoas?.blendedRoas30d ?? 1.5);
      const roas = spend7 > 0 ? rev7 / (spend7 / 4.33) : 0;
      const pct = params.budgetChangePct ?? 0.2;
      const weeklySpend = spend7 / 4.33;
      const incrementalWeekly = Math.round(weeklySpend * pct * Math.max(roas, 0.5));
      const monthlyRevenue = weeklyToMonthly(incrementalWeekly);
      const campName = googleCamp?.campaignName ?? "Google Search";

      draft = {
        id,
        simulationType: "increase_google_budget",
        label: SIMULATION_LABELS.increase_google_budget,
        summary: `Increasing Google budget ${Math.round(pct * 100)}% on ${campName} at modeled ROAS ${roas.toFixed(2)}.`,
        expectedMonthlyRevenue: monthlyRevenue || baseImpact,
        expectedMonthlyProfit: marginEstimate(monthlyRevenue || baseImpact, category),
        confidence: roas >= 2 ? 0.74 : 0.56,
        risks: CATEGORY_RISKS.increase_google_budget,
        implementationEffort: "Medium",
        metrics: [
          { label: "Modeled ROAS", value: roas.toFixed(2) },
          { label: "Budget increase", value: `+${Math.round(pct * 100)}%` },
          { label: "Monthly ad spend", value: `$${Math.round(spend7).toLocaleString()}` },
          { label: "Expected ROAS", value: (roas * 0.92).toFixed(2) },
        ],
      };
      break;
    }

    case "apply_discount": {
      const discountPct = params.priceChangePct != null ? Math.abs(params.priceChangePct) : 0.15;
      const skuEstimate = profitFromProductDiscount(context, hint, discountPct);

      if (skuEstimate) {
        draft = {
          id,
          simulationType: "apply_discount",
          label: SIMULATION_LABELS.apply_discount,
          summary: `Applying ${Math.round(discountPct * 100)}% off on ${skuEstimate.productTitle} using SKU-level COGS and velocity.`,
          expectedMonthlyRevenue: skuEstimate.revenue,
          expectedMonthlyProfit: skuEstimate.profit,
          confidence: 0.72,
          risks: CATEGORY_RISKS.apply_discount,
          implementationEffort: "Medium",
          metrics: skuEstimate.metrics,
        };
        break;
      }

      const monthlyBase = context.storeMetrics.revenue30d;
      const volumeLift = discountPct * 1.4;
      const revenueChange = monthlyBase * (volumeLift - discountPct);
      const monthlyRevenue = Math.round(Math.max(0, revenueChange));
      const marginRate = (context.profitDashboard?.primary.profitMarginPct ?? 38) / 100;
      const marginAfter = marginRate * (1 - discountPct);
      const monthlyProfit = Math.round(monthlyRevenue * marginAfter);

      draft = {
        id,
        simulationType: "apply_discount",
        label: SIMULATION_LABELS.apply_discount,
        summary: `Applying a ${Math.round(discountPct * 100)}% storewide discount with modeled ${Math.round(volumeLift * 100)}% order lift.`,
        expectedMonthlyRevenue: monthlyRevenue,
        expectedMonthlyProfit: monthlyProfit,
        confidence: 0.64,
        risks: CATEGORY_RISKS.apply_discount,
        implementationEffort: "Medium",
        metrics: [
          { label: "Discount", value: `${Math.round(discountPct * 100)}%` },
          { label: "Expected orders lift", value: `+${Math.round(volumeLift * 100)}%` },
          { label: "Margin impact", value: `${Math.round(marginRate * 100)}% → ${Math.round(marginAfter * 100)}%` },
        ],
      };
      break;
    }

    case "pause_campaign": {
      if (!context.hasActiveAdsConnector) return null;
      const campaign = matchCampaign(context, hint);
      if (!campaign) return null;
      const weeklyRecovery =
        campaign.roas7d < 1
          ? Math.round(campaign.spend7d - campaign.revenue7d)
          : -Math.round(campaign.revenue7d * 0.25);
      const monthlyRevenue = weeklyToMonthly(Math.max(0, weeklyRecovery));

      draft = {
        id,
        simulationType: "pause_campaign",
        label: SIMULATION_LABELS.pause_campaign,
        summary:
          campaign.roas7d < 1
            ? `Pausing ${campaign.name} recovers inefficient spend (ROAS ${campaign.roas7d.toFixed(2)}).`
            : `Pausing ${campaign.name} may reduce retargeting revenue despite ROAS ${campaign.roas7d.toFixed(2)}.`,
        expectedMonthlyRevenue: monthlyRevenue || baseImpact,
        expectedMonthlyProfit: marginEstimate(Math.max(0, monthlyRevenue), category),
        confidence: campaign.roas7d < 1 ? 0.84 : 0.65,
        risks: CATEGORY_RISKS.pause_campaign,
        implementationEffort: "High",
        metrics: [
          { label: "7-day spend", value: `$${campaign.spend7d}` },
          { label: "7-day revenue", value: `$${campaign.revenue7d}` },
          { label: "ROAS", value: campaign.roas7d.toFixed(2), trend: "down" },
        ],
      };
      break;
    }

    case "create_bundle": {
      const monthlyRevenue = baseImpact || Math.round(context.storeMetrics.orders30d * 0.12 * context.storeMetrics.aov30d * 0.1);
      draft = {
        id,
        simulationType: "create_bundle",
        label: SIMULATION_LABELS.create_bundle,
        summary: "Bundling complementary SKUs to lift AOV without deep discounting.",
        expectedMonthlyRevenue: monthlyRevenue,
        expectedMonthlyProfit: marginEstimate(monthlyRevenue, category),
        confidence: 0.7,
        risks: CATEGORY_RISKS.create_bundle,
        implementationEffort: "Medium",
        metrics: [
          { label: "Store AOV", value: `$${context.storeMetrics.aov30d.toFixed(2)}` },
          { label: "Orders (30d)", value: String(context.storeMetrics.orders30d) },
        ],
      };
      break;
    }

    case "add_homepage_feature": {
      const monthlyRevenue = baseImpact || Math.round(context.storeMetrics.revenue30d * 0.08);
      draft = {
        id,
        simulationType: "add_homepage_feature",
        label: SIMULATION_LABELS.add_homepage_feature,
        summary: "Featuring a top-performing collection on the homepage to lift discovery and conversion.",
        expectedMonthlyRevenue: monthlyRevenue,
        expectedMonthlyProfit: marginEstimate(monthlyRevenue, category),
        confidence: 0.78,
        risks: CATEGORY_RISKS.add_homepage_feature,
        implementationEffort: "Low",
        metrics: [
          { label: "Conversion rate", value: `${context.storeMetrics.conversionRate30d}%` },
          { label: "Store revenue (30d)", value: `$${context.storeMetrics.revenue30d.toLocaleString()}` },
        ],
      };
      break;
    }
  }

  if (!draft) return null;
  return applyHistoricalBasis(draft, category as RecommendationCategory, context.storeId);
}

function mapOppCategory(
  category?: Opportunity["category"],
): RecommendationCategory | undefined {
  if (!category) return undefined;
  const map: Record<Opportunity["category"], RecommendationCategory> = {
    inventory: "low_inventory",
    pricing: "slow_selling",
    bundle: "bundle_opportunity",
    merchandising: "homepage_merchandising",
    marketing: "campaign_review",
    advertising_efficiency: "campaign_review",
    product_growth: "promotion_opportunity",
    marketing_attribution: "campaign_review",
    customer_retention: "promotion_opportunity",
  };
  return map[category];
}

/** Back-compat for Ask AI chat */
export function simulationToLegacyResult(sim: WhatIfSimulationResult) {
  return {
    scenario: sim.label,
    summary: sim.summary,
    estimatedImpact: `+$${sim.expectedMonthlyRevenue.toLocaleString()}/month revenue · +$${sim.expectedMonthlyProfit.toLocaleString()}/month profit (${sim.basis === "measured_historical" ? "historical blend" : "prediction"})`,
    metrics: sim.metrics,
    confidence: sim.confidence,
  };
}
