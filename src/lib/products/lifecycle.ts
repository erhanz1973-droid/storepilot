import type { ProductIntelligenceProfile } from "./types";

export type ProductLifecycleStage =
  | "Launching"
  | "Growing"
  | "Winning"
  | "Stable"
  | "Declining"
  | "Dead Inventory";

export function computeProductLifecycleStage(
  profile: Pick<
    ProductIntelligenceProfile,
    | "unitsSold"
    | "revenue"
    | "inventory"
    | "netProfit"
    | "marginPct"
    | "isHero"
    | "isHiddenWinner"
    | "inventoryRisk"
    | "trends"
    | "isLosingMoney"
  >,
): ProductLifecycleStage {
  if (profile.inventoryRisk === "dead" || (profile.inventory > 20 && profile.unitsSold < 3)) {
    return "Dead Inventory";
  }
  if (profile.inventory === 0) {
    return profile.unitsSold >= 10 ? "Declining" : "Dead Inventory";
  }
  if (profile.isHero || (profile.netProfit > 0 && profile.marginPct >= 35 && profile.unitsSold >= 40)) {
    return "Winning";
  }
  if (
    profile.isHiddenWinner ||
    (profile.trends.revenueGrowthPct != null && profile.trends.revenueGrowthPct > 12)
  ) {
    return "Growing";
  }
  if (profile.unitsSold > 0 && profile.unitsSold <= 8 && profile.revenue > 0) {
    return "Launching";
  }
  if (profile.trends.revenueGrowthPct != null && profile.trends.revenueGrowthPct < -8) {
    return "Declining";
  }
  if (profile.isLosingMoney && profile.unitsSold >= 5) {
    return "Declining";
  }
  return "Stable";
}
