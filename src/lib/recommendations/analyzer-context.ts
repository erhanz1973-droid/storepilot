import type { StoreSnapshot } from "@/lib/connectors/types";
import type { StoreBusinessGoals } from "@/lib/business-goals/types";
import type { ProfitDashboard } from "@/lib/profit/types";

export type InventoryPressure = "low" | "normal" | "high";

/** Context passed through the goal-aware decision pipeline. */
export type RecommendationAnalyzerContext = {
  businessGoals?: StoreBusinessGoals;
  profitMarginPct?: number;
  inventoryPressure?: InventoryPressure;
};

export function assessInventoryPressure(snapshot: StoreSnapshot): InventoryPressure {
  const products = snapshot.products ?? [];
  if (products.length === 0) return "normal";

  const overstocked = products.filter((p) => p.inventoryQuantity >= 40).length;
  const ratio = overstocked / products.length;
  if (ratio >= 0.35) return "high";
  if (ratio <= 0.1) return "low";
  return "normal";
}

export function buildAnalyzerContext(input: {
  snapshot: StoreSnapshot;
  businessGoals?: StoreBusinessGoals;
  profitDashboard?: ProfitDashboard | null;
}): RecommendationAnalyzerContext {
  const margin =
    input.profitDashboard?.primary?.profitMarginPct ??
    input.profitDashboard?.periods?.find((p) => p.window === "last30d")?.profitMarginPct;

  return {
    businessGoals: input.businessGoals,
    profitMarginPct: margin != null ? Number(margin) : undefined,
    inventoryPressure: assessInventoryPressure(input.snapshot),
  };
}
