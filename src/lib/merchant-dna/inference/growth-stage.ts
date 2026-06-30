import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import type { BusinessModel } from "@/lib/business-model/types";
import type { GrowthStage } from "../types";

export type DnaInferenceContext = {
  storeId: string;
  businessModel: BusinessModel;
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  productIntelligence?: ProductIntelligenceDashboard | null;
};

export function inferGrowthStage(ctx: DnaInferenceContext): GrowthStage {
  const orders = ctx.snapshot.storeMetrics?.orders30d ?? 0;
  const revenue = ctx.snapshot.storeMetrics?.revenue30d ?? 0;
  const trends = ctx.snapshot.salesTrends;
  let revenueTrend = 0;
  if (trends?.thisWeek?.revenue && trends?.lastWeek?.revenue) {
    revenueTrend =
      ((trends.thisWeek.revenue - trends.lastWeek.revenue) / trends.lastWeek.revenue) * 100;
  }
  const roas = ctx.profitDashboard?.blendedRoas?.blendedRoas30d ?? 0;
  const margin = ctx.profitDashboard?.primary.profitMarginPct ?? 0;
  const productCount = ctx.snapshot.products.length;

  if (revenueTrend < -8 && orders > 20) return "declining";
  if (orders < 30 && revenue < 5000) return "startup";
  if (revenue >= 50000 && roas >= 1.8 && margin >= 25) return "scaling";
  if (productCount >= 80 && orders >= 200 && Math.abs(revenueTrend) < 5) return "mature";
  if (revenueTrend >= 5 || orders >= 50) return "growing";
  return "startup";
}

export const GROWTH_STAGE_PRIORITIES: Record<
  GrowthStage,
  { focus: string; boostTopics: string[]; suppressTopics: string[] }
> = {
  startup: {
    focus: "Customer acquisition",
    boostTopics: ["campaign_scaling", "winning_products", "marketing_efficiency", "landing_page"],
    suppressTopics: ["inventory_clearance", "warehouse_optimization"],
  },
  growing: {
    focus: "Revenue acceleration",
    boostTopics: ["product_scaling", "roas_optimization", "winning_products", "bundles"],
    suppressTopics: [],
  },
  scaling: {
    focus: "Profit optimization",
    boostTopics: ["roas_optimization", "price_optimization", "marketing_efficiency", "customer_ltv"],
    suppressTopics: ["dead_inventory"],
  },
  mature: {
    focus: "Efficiency and retention",
    boostTopics: ["customer_retention", "churn_risk", "price_optimization", "bundles"],
    suppressTopics: ["product_scaling"],
  },
  declining: {
    focus: "Cash preservation",
    boostTopics: ["inventory_clearance", "cash_flow", "product_kill_list", "high_cpa"],
    suppressTopics: ["campaign_scaling", "product_scaling"],
  },
};
