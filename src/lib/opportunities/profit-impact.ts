import type { OpportunityCategory } from "@/lib/types";

/** Convert expected revenue lift to expected net profit lift */
export function revenueToNetProfitImpact(
  revenueImpact: number,
  category: OpportunityCategory,
  storeNetMarginPct?: number,
): number {
  if (revenueImpact <= 0) return 0;

  if (category === "marketing" || category === "advertising_efficiency" || category === "product_growth" || category === "marketing_attribution") {
    // Marketing opps are often efficiency gains (saved spend) or incremental ROAS profit
    return Math.round(revenueImpact * 0.55);
  }

  const marginRate =
    storeNetMarginPct != null && storeNetMarginPct > 0
      ? storeNetMarginPct / 100
      : 0.38;

  return Math.round(revenueImpact * marginRate);
}

export function formatNetProfitImpact(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
