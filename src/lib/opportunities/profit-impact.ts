/**
 * @deprecated Import formulaRevenueToNetProfit from `@/lib/calculations/formulas`
 */
import type { OpportunityCategory } from "@/lib/types";
import { formulaRevenueToNetProfit } from "@/lib/calculations/formulas";

const MARKETING_CATEGORIES = new Set<OpportunityCategory>([
  "marketing",
  "advertising_efficiency",
  "product_growth",
  "marketing_attribution",
]);

/** Convert expected revenue lift to expected net profit lift */
export function revenueToNetProfitImpact(
  revenueImpact: number,
  category: OpportunityCategory,
  storeNetMarginPct?: number,
): number {
  return formulaRevenueToNetProfit(revenueImpact, {
    isMarketingEfficiency: MARKETING_CATEGORIES.has(category),
    storeNetMarginPct,
  });
}

export function formatNetProfitImpact(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
