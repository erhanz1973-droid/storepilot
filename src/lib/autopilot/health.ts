import type { ProfitDashboard } from "@/lib/profit/types";
import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import type { AttributionDashboard } from "@/lib/attribution/models";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ExecutiveHealthBreakdown, ExecutiveHealthScore } from "./types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeExecutiveHealthScore(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null,
  productIntelligence: ProductIntelligenceDashboard | null,
  attributionDashboard: AttributionDashboard | null,
  storeHealthScore: number,
): ExecutiveHealthScore {
  const reasons: string[] = [];

  const margin = profitDashboard?.primary.profitMarginPct ?? 0;
  const profitability = clamp(margin * 2.5);
  if (margin < 15) reasons.push(`Profit margin at ${margin}% is below healthy threshold.`);

  const trends = snapshot.salesTrends;
  let growth = 70;
  if (trends) {
    const revChange =
      trends.previous30Days.revenue > 0
        ? ((trends.last30Days.revenue - trends.previous30Days.revenue) /
            trends.previous30Days.revenue) *
          100
        : 0;
    growth = clamp(50 + revChange * 2);
    if (revChange > 5) reasons.push(`Revenue grew ${Math.round(revChange)}% vs prior 30 days (+growth).`);
    else if (revChange < -5) reasons.push(`Revenue declined ${Math.abs(Math.round(revChange))}% vs prior 30 days.`);
  }

  const roas = profitDashboard?.blendedRoas?.blendedRoas30d;
  const marketing = clamp(
    roas != null ? Math.min(100, roas * 35) : attributionDashboard ? 55 : 40,
  );
  if (roas != null && roas < 1.5) reasons.push(`Blended ROAS ${roas.toFixed(2)} suggests ad efficiency needs review.`);

  const invRisk = productIntelligence?.inventoryRisk.length ?? 0;
  const inventory = clamp(100 - invRisk * 12);
  if (invRisk > 0) reasons.push(`${invRisk} SKUs flagged for inventory risk.`);

  const cac = attributionDashboard?.acquisition.cac;
  const acquisition = clamp(cac != null && cac > 0 ? Math.max(20, 100 - cac / 2) : 60);

  const retRatio =
    attributionDashboard && attributionDashboard.acquisition.newCustomers > 0
      ? attributionDashboard.acquisition.returningCustomers /
        (attributionDashboard.acquisition.newCustomers + attributionDashboard.acquisition.returningCustomers)
      : 0.35;
  const retention = clamp(40 + retRatio * 80);

  const refundRate =
    productIntelligence && productIntelligence.products.length > 0
      ? productIntelligence.products.reduce((s, p) => s + p.refundRatePct, 0) /
        productIntelligence.products.length
      : 2;
  const operations = clamp(100 - refundRate * 8 - (100 - storeHealthScore) * 0.3);

  const breakdown: ExecutiveHealthBreakdown = {
    profitability,
    growth,
    marketing,
    inventory,
    acquisition,
    retention,
    operations,
  };

  const score = clamp(
    profitability * 0.25 +
      growth * 0.15 +
      marketing * 0.2 +
      inventory * 0.1 +
      acquisition * 0.1 +
      retention * 0.1 +
      operations * 0.1,
  );

  let label: ExecutiveHealthScore["label"] = "Fair";
  if (score >= 80) label = "Excellent";
  else if (score >= 65) label = "Good";
  else if (score < 45) label = "At Risk";

  if (reasons.length === 0) {
    reasons.push("All core dimensions within normal ranges.");
  }

  return { score, label, breakdown, changeReasons: reasons.slice(0, 4) };
}
