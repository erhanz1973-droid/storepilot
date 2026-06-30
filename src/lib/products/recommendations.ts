import type { ProductAttributionProfile } from "@/lib/attribution/product-types";
import type { ProductIntelligenceProfile } from "@/lib/products/types";

export type ProductRecommendationBadge =
  | "increase_budget"
  | "pause_advertising"
  | "optimize_advertising"
  | "create_bundle"
  | "restock"
  | "discount"
  | "price_increase"
  | "reduce_carrying_cost"
  | "healthy"
  | "monitor";

export const RECOMMENDATION_BADGE_LABELS: Record<ProductRecommendationBadge, string> = {
  increase_budget: "Increase Budget",
  pause_advertising: "Pause Advertising",
  optimize_advertising: "Optimize Advertising",
  create_bundle: "Create Bundle",
  restock: "Restock",
  discount: "Discount",
  price_increase: "Increase Price",
  reduce_carrying_cost: "Reduce Carrying Cost",
  healthy: "Healthy",
  monitor: "Monitor",
};

export type ProductDisplayStatus =
  | "Winner"
  | "Healthy"
  | "Scaling"
  | "Low Margin"
  | "Over Advertised"
  | "Dead Inventory"
  | "Out of Stock"
  | "Losing Money";

export type ProductHealthTier = "Healthy" | "Needs Attention" | "Critical";

export type ProductRecommendation = {
  badge: ProductRecommendationBadge;
  label: string;
  summary: string;
  reasoning: string[];
  action: string;
  aiExplanation: string;
  expectedMonthlyImpact: number;
  confidencePct: number;
};

export function healthTier(score: number): ProductHealthTier {
  if (score >= 70) return "Healthy";
  if (score >= 40) return "Needs Attention";
  return "Critical";
}

export function displayStatus(
  profile: ProductIntelligenceProfile,
  attr?: ProductAttributionProfile | null,
): ProductDisplayStatus {
  if (profile.inventory === 0) return "Out of Stock";
  if (profile.inventory > 20 && profile.unitsSold < 3) return "Dead Inventory";
  if (profile.isLosingMoney) {
    const organic = attr?.sources.organic ?? 0;
    const meta = attr?.sources.meta ?? 0;
    if (organic > meta && profile.adCost > 0) return "Over Advertised";
    return "Losing Money";
  }
  if (profile.isHero || (profile.netProfit > 0 && profile.marginPct >= 35 && profile.unitsSold >= 15)) {
    return "Winner";
  }
  if (profile.isHiddenWinner || (profile.productRoas != null && profile.productRoas >= 2.5)) {
    return "Scaling";
  }
  if (profile.marginPct < 20) return "Low Margin";
  return "Healthy";
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function deriveProductRecommendation(
  profile: ProductIntelligenceProfile,
  attr?: ProductAttributionProfile | null,
  bundlePartnerTitle?: string,
): ProductRecommendation {
  const organic = attr?.sources.organic ?? 0;
  const paid = (attr?.sources.meta ?? 0) + (attr?.sources.google ?? 0);
  const dailyAd = profile.dailyAdSpend > 0 ? profile.dailyAdSpend : profile.adCost / 30;
  const daysOos = profile.daysOutOfStock ?? (profile.inventory === 0 ? 4 : null);

  if (profile.inventory === 0 && dailyAd > 0) {
    const impact = Math.round(dailyAd * 30);
    const reasoning = [
      `This product has been out of stock for ${daysOos ?? 4} days.`,
      `Meta Ads continue spending approximately ${formatMoney(dailyAd)}/day.`,
      "No sales can occur while inventory is unavailable.",
    ];
    const action = "Pause advertising until inventory is replenished.";
    return {
      badge: "pause_advertising",
      label: RECOMMENDATION_BADGE_LABELS.pause_advertising,
      summary: action,
      reasoning,
      action,
      aiExplanation: `${reasoning.join(" ")} ${action} Estimated monthly savings: +${formatMoney(impact)}.`,
      expectedMonthlyImpact: impact,
      confidencePct: 92,
    };
  }

  if (profile.inventoryRisk === "low_stock" && profile.netProfit > 0) {
    const impact = Math.round(profile.netProfit * 0.4);
    const reasoning = [
      `Only ${profile.inventory} units remain (~${profile.daysUntilStockout} days of cover).`,
      `${profile.unitsSold} units sold in 30 days at ${profile.marginPct}% margin.`,
      `Last sale was ${profile.lastSaleDaysAgo ?? 1} day(s) ago — demand is active.`,
    ];
    const action = "Restock before stockout to protect revenue.";
    return {
      badge: "restock",
      label: RECOMMENDATION_BADGE_LABELS.restock,
      summary: action,
      reasoning,
      action,
      aiExplanation: `${profile.title} is profitable but inventory is running low. ${action} Estimated monthly impact: +${formatMoney(impact)}.`,
      expectedMonthlyImpact: impact,
      confidencePct: 86,
    };
  }

  if (
    profile.isLosingMoney &&
    profile.adCost > 0 &&
    (organic > paid || profile.adCost > profile.grossProfit * 0.5)
  ) {
    const impact = Math.round(Math.abs(profile.netProfit) * 0.4 + profile.adCost * 0.15);
    const productRoas = profile.productRoas?.toFixed(2) ?? "—";
    const reasoning = organic > paid
      ? [
          `Organic revenue (${formatMoney(organic)}) exceeds paid (${formatMoney(paid)}).`,
          `Paid ads add ${formatMoney(profile.adCost)}/month while net profit is ${formatMoney(profile.netProfit)}.`,
          "This SKU performs well organically but paid efficiency needs improvement.",
        ]
      : [
          `${profile.title} loses ${formatMoney(Math.abs(profile.netProfit))} net per month.`,
          `Advertising consumes ${formatMoney(profile.adCost)} with ROAS ${productRoas}.`,
          "Paid spend is not recovering product-level margin yet.",
        ];
    const action =
      "Reduce ad budget by 20–30%, improve targeting, and refresh creatives before pausing entirely.";
    return {
      badge: "optimize_advertising",
      label: RECOMMENDATION_BADGE_LABELS.optimize_advertising,
      summary: action,
      reasoning,
      action,
      aiExplanation: `${reasoning.join(" ")} ${action} Estimated monthly improvement: +${formatMoney(impact)}.`,
      expectedMonthlyImpact: impact,
      confidencePct: attr?.confidencePct ?? 80,
    };
  }

  if (
    (profile.isHiddenWinner || (profile.marginPct >= 30 && (profile.productRoas ?? 0) >= 2)) &&
    profile.netProfit > 0
  ) {
    const impact = Math.round(profile.netProfit * 0.25);
    const reasoning = [
      `${profile.marginPct}% margin with product ROAS ${profile.productRoas?.toFixed(2) ?? "—"}.`,
      `${formatMoney(profile.revenue)} revenue on ${formatMoney(profile.adCost)} ad spend.`,
      profile.isHiddenWinner ? "Under-invested in paid channels relative to margin." : "Strong paid efficiency with room to scale.",
    ];
    const action = "Increase Meta/Google budget on campaigns featuring this SKU.";
    return {
      badge: "increase_budget",
      label: RECOMMENDATION_BADGE_LABELS.increase_budget,
      summary: action,
      reasoning,
      action,
      aiExplanation: `${action} Estimated monthly profit uplift: +${formatMoney(impact)}.`,
      expectedMonthlyImpact: impact,
      confidencePct: attr?.confidencePct ?? 78,
    };
  }

  if (profile.inventoryRisk === "dead" || profile.inventoryRisk === "overstock") {
    const isDead = profile.inventoryRisk === "dead";
    const impact = isDead
      ? Math.round(profile.inventory * (profile.cogs / Math.max(profile.unitsSold, 1)) * 0.08)
      : Math.round(profile.revenue * 0.08);
    const reasoning = isDead
      ? [
          `${profile.inventory} units on hand with only ${profile.unitsSold} sold in 30 days.`,
          "Capital is tied up in non-moving inventory.",
          "Carrying cost erodes working capital each month.",
        ]
      : [
          `${profile.inventory} units in stock vs ${profile.unitsSold} sold — slow sell-through.`,
          bundlePartnerTitle
            ? `Pair with ${bundlePartnerTitle} to lift AOV.`
            : "Bundle with a bestseller to accelerate velocity.",
          "Overstock increases storage and markdown risk.",
        ];
    const action = isDead
      ? "Run clearance pricing or bundle to recover capital."
      : `Create bundle with ${bundlePartnerTitle ?? "a bestseller"}.`;
    return {
      badge: isDead ? "reduce_carrying_cost" : "create_bundle",
      label: isDead
        ? RECOMMENDATION_BADGE_LABELS.reduce_carrying_cost
        : RECOMMENDATION_BADGE_LABELS.create_bundle,
      summary: action,
      reasoning,
      action,
      aiExplanation: `${action} Estimated monthly impact: +${formatMoney(impact)}.`,
      expectedMonthlyImpact: impact,
      confidencePct: 74,
    };
  }

  if (
    profile.marginPct >= 28 &&
    profile.netProfit > 0 &&
    profile.trends.revenueGrowthPct != null &&
    profile.trends.revenueGrowthPct > -5 &&
    profile.trends.revenueGrowthPct < 10 &&
    profile.inventoryRisk === "none"
  ) {
    const impact = Math.round(profile.revenue * 0.05 * (profile.marginPct / 100));
    const reasoning = [
      `Stable demand with ${profile.marginPct}% margin.`,
      `Revenue trend: ${profile.salesTrendLabel}.`,
      "Price elasticity appears low — small increase unlikely to hurt volume.",
    ];
    const action = "Increase product price by 5%.";
    return {
      badge: "price_increase",
      label: RECOMMENDATION_BADGE_LABELS.price_increase,
      summary: action,
      reasoning,
      action,
      aiExplanation: `${action} Estimated monthly profit uplift: +${formatMoney(impact)}.`,
      expectedMonthlyImpact: impact,
      confidencePct: 71,
    };
  }

  if (profile.netProfit > 0 && profile.healthScore >= 70) {
    return {
      badge: "healthy",
      label: RECOMMENDATION_BADGE_LABELS.healthy,
      summary: "Maintain current strategy",
      reasoning: [
        `${profile.marginPct}% margin and health score ${profile.healthScore}/100.`,
        `${profile.lifecycleStage} lifecycle stage with stable trends.`,
      ],
      action: "No immediate action required — continue monitoring weekly.",
      aiExplanation: `${profile.title} is performing well. ${profile.lifecycleStage} SKU with ${profile.marginPct}% margin.`,
      expectedMonthlyImpact: 0,
      confidencePct: 88,
    };
  }

  const impact = Math.round(Math.max(0, profile.netProfit * 0.1));
  const action = "Review margin and ad efficiency weekly.";
  return {
    badge: "monitor",
    label: RECOMMENDATION_BADGE_LABELS.monitor,
    summary: action,
    reasoning: [
      `Margin ${profile.marginPct}%, ROAS ${profile.productRoas?.toFixed(2) ?? "—"}.`,
      `Health score ${profile.healthScore}/100 (${profile.healthLabel}).`,
    ],
    action,
    aiExplanation: `${profile.title} needs monitoring — watch for margin or ad efficiency changes.`,
    expectedMonthlyImpact: impact,
    confidencePct: 65,
  };
}
