import type { ProductAttributionProfile } from "@/lib/attribution/product-types";
import type { ProductIntelligenceProfile } from "./types";
import type { ProductLifecycleStage } from "./lifecycle";

export type ProductMerchandisingInsight = {
  id: string;
  severity: "info" | "warning" | "opportunity";
  text: string;
};

export function buildMerchandisingInsights(
  profile: ProductIntelligenceProfile,
  attr: ProductAttributionProfile | null,
  lifecycle: ProductLifecycleStage,
  bundlePartnerTitle?: string,
): ProductMerchandisingInsight[] {
  const insights: ProductMerchandisingInsight[] = [];
  const organic = attr?.sources.organic ?? 0;
  const paid = (attr?.sources.meta ?? 0) + (attr?.sources.google ?? 0);
  const dailyAd = profile.adCost > 0 ? profile.adCost / 30 : 0;

  if (
    profile.daysUntilStockout != null &&
    profile.daysUntilStockout <= 7 &&
    profile.netProfit > 0
  ) {
    insights.push({
      id: "stockout-soon",
      severity: "warning",
      text: `Inventory will run out in ~${Math.ceil(profile.daysUntilStockout)} days at current velocity.`,
    });
  }

  if (profile.inventory === 0 && dailyAd > 0) {
    insights.push({
      id: "oos-ads",
      severity: "warning",
      text: `Advertising spend (~$${Math.round(dailyAd)}/day) exceeds inventory availability — no sales can occur.`,
    });
  }

  if (organic > paid * 1.4 && profile.adCost > profile.grossProfit * 0.35 && profile.isLosingMoney) {
    insights.push({
      id: "organic-vs-paid",
      severity: "opportunity",
      text: "Strong organic demand but paid ads destroy margin — reduce paid promotion.",
    });
  }

  if (profile.isHiddenWinner || (profile.productRoas != null && profile.productRoas >= 2.5)) {
    insights.push({
      id: "scale-ads",
      severity: "opportunity",
      text: `ROAS ${profile.productRoas?.toFixed(2) ?? "—"} with ${profile.marginPct}% margin — candidate for more ad budget.`,
    });
  }

  if (bundlePartnerTitle && profile.inventoryRisk === "overstock") {
    insights.push({
      id: "bundle",
      severity: "opportunity",
      text: `Bundle with ${bundlePartnerTitle} to accelerate sell-through.`,
    });
  }

  if (
    profile.marginPct >= 28 &&
    profile.trends.revenueGrowthPct != null &&
    profile.trends.revenueGrowthPct > -3 &&
    profile.trends.revenueGrowthPct < 8
  ) {
    insights.push({
      id: "price-increase",
      severity: "opportunity",
      text: "Stable demand with healthy margin — a 5% price increase carries low demand risk.",
    });
  }

  if (profile.inventoryRisk === "dead" && profile.inventory > 40) {
    const carrying = Math.round(profile.inventory * (profile.cogs / Math.max(profile.unitsSold, 1)) * 0.08);
    insights.push({
      id: "carrying-cost",
      severity: "warning",
      text: `Dead stock ties up ~$${carrying.toLocaleString()}/month in carrying cost — clearance or bundle.`,
    });
  }

  if (lifecycle === "Winning" && profile.trends.revenueGrowthPct != null && profile.trends.revenueGrowthPct > 15) {
    insights.push({
      id: "winning-momentum",
      severity: "info",
      text: `Winning SKU with revenue up ${profile.trends.revenueGrowthPct}% — protect inventory and ad efficiency.`,
    });
  }

  return insights.slice(0, 4);
}
