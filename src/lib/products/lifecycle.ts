import {
  classifyInventoryAging,
  type InventoryAgingThresholds,
} from "@/lib/inventory/aging";
import type { ProductIntelligenceProfile } from "./types";

export type ProductLifecycleStage =
  | "New Product"
  | "Needs Attention"
  | "Slow Moving"
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
  > & {
    createdAt?: string | null;
    firstInventoryAt?: string | null;
  },
  agingOptions?: {
    industry?: string | null;
    thresholds?: Partial<InventoryAgingThresholds>;
  },
): ProductLifecycleStage {
  const aging = classifyInventoryAging({
    createdAt: profile.createdAt,
    firstInventoryAt: profile.firstInventoryAt,
    inventoryQuantity: profile.inventory,
    unitsSold30d: profile.unitsSold,
    industry: agingOptions?.industry,
    thresholds: agingOptions?.thresholds,
  });

  if (aging === "new_product") return "New Product";
  if (aging === "needs_attention") return "Needs Attention";
  if (aging === "slow_moving") return "Slow Moving";
  if (aging === "dead_inventory" || profile.inventoryRisk === "dead") {
    return "Dead Inventory";
  }

  if (profile.inventory === 0) {
    return profile.unitsSold >= 10 ? "Declining" : "Needs Attention";
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
