import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ForecastScenario, ProfitForecast } from "./types";

function project(
  baseRevenue: number,
  baseProfit: number,
  baseRoas: number | null,
  baseSpend: number,
  days: number,
  multiplier: number,
): ForecastScenario {
  const scale = (days / 30) * multiplier;
  const revenue = Math.round(baseRevenue * scale * 100) / 100;
  const profit = Math.round(baseProfit * scale * 100) / 100;
  const spend = Math.round(baseSpend * scale * 100) / 100;
  const roas = spend > 0 ? Math.round((revenue / spend) * 100) / 100 : baseRoas;
  return {
    revenue,
    profit,
    roas,
    cashFlow: Math.round((profit - spend * 0.1) * 100) / 100,
  };
}

export function buildProfitForecasts(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null,
): ProfitForecast[] {
  const rev = profitDashboard?.primary.revenue ?? snapshot.storeMetrics.revenue30d;
  const profit = profitDashboard?.primary.netProfit ?? rev * 0.35;
  const spend = profitDashboard?.primary.adSpend ?? 0;
  const roas = profitDashboard?.blendedRoas?.blendedRoas30d ?? null;

  const trend =
    snapshot.salesTrends && snapshot.salesTrends.previous30Days.revenue > 0
      ? snapshot.salesTrends.last30Days.revenue / snapshot.salesTrends.previous30Days.revenue
      : 1;

  const horizons: (7 | 30 | 90)[] = [7, 30, 90];
  const confidence = snapshot.profitRollups ? 78 : 55;

  return horizons.map((horizonDays) => ({
    horizonDays,
    optimistic: project(rev, profit, roas, spend, horizonDays, Math.min(1.25, trend * 1.12)),
    expected: project(rev, profit, roas, spend, horizonDays, trend),
    conservative: project(rev, profit, roas, spend, horizonDays, Math.max(0.75, trend * 0.88)),
    confidencePct: confidence - (horizonDays === 90 ? 15 : horizonDays === 7 ? 0 : 5),
  }));
}

export function buildInventoryForecasts(
  products: StoreSnapshot["products"],
  netMarginPct: number,
): import("./types").InventoryForecastRow[] {
  const margin = netMarginPct > 0 ? netMarginPct / 100 : 0.38;

  return products
    .map((p) => {
      const daily = p.unitsSold30d / 30;
      const daysRemaining = daily > 0 ? Math.round((p.inventoryQuantity / daily) * 10) / 10 : null;
      let risk: import("./types").InventoryForecastRow["risk"] = "healthy";
      if (daysRemaining != null && daysRemaining <= 14 && daily > 0) risk = "stockout";
      else if (p.inventoryQuantity > 60 && p.unitsSold30d < 15) risk = "overstock";

      const lostRevenue =
        risk === "stockout" && daysRemaining != null
          ? Math.round(daily * p.price * Math.min(daysRemaining, 14) * 100) / 100
          : 0;

      const purchaseDate =
        risk === "stockout" && daysRemaining != null
          ? new Date(Date.now() + Math.max(0, (daysRemaining - 7) * 86400000)).toISOString().slice(0, 10)
          : null;

      return {
        productId: p.id,
        title: p.title,
        inventory: p.inventoryQuantity,
        daysRemaining,
        risk,
        recommendedPurchaseDate: purchaseDate,
        lostRevenueRisk: lostRevenue,
        lostProfitRisk: Math.round(lostRevenue * margin * 100) / 100,
      };
    })
    .filter((r) => r.risk !== "healthy" || r.lostRevenueRisk > 0)
    .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))
    .slice(0, 10);
}
