import type { FutureActionType } from "@/lib/insights/actions";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { AttributionDashboard } from "@/lib/attribution/models";
import type { InventoryForecastRow } from "@/lib/autopilot/types";

export type PredictiveAction = {
  label: string;
  detail: string;
  futureAction?: FutureActionType;
};

export type PredictiveInsight = {
  id: string;
  type:
    | "revenue_forecast"
    | "profit_forecast"
    | "stockout_risk"
    | "campaign_profitability"
    | "roas_forecast"
    | "inventory_depletion"
    | "cash_flow";
  title: string;
  prediction: string;
  confidencePct: number;
  horizonDays: number;
  severity: "info" | "warning" | "critical";
  supportingData: { label: string; value: string }[];
  primaryFactors: string[];
  possibleActions: PredictiveAction[];
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function buildPredictiveInsights(input: {
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard | null;
  attributionDashboard: AttributionDashboard | null;
  inventoryForecasts: InventoryForecastRow[];
}): PredictiveInsight[] {
  const insights: PredictiveInsight[] = [];
  const rev = input.profitDashboard?.primary.revenue ?? input.snapshot.storeMetrics.revenue30d;
  const profit = input.profitDashboard?.primary.netProfit ?? rev * 0.35;
  const spend = input.profitDashboard?.primary.adSpend ?? 0;
  const roas = input.profitDashboard?.blendedRoas?.blendedRoas30d ?? null;

  const trend =
    input.snapshot.salesTrends &&
    input.snapshot.salesTrends.previous30Days.revenue > 0
      ? input.snapshot.salesTrends.last30Days.revenue /
        input.snapshot.salesTrends.previous30Days.revenue
      : 1;

  const rev7d = Math.round((rev / 30) * 7 * trend);
  const profit7d = Math.round((profit / 30) * 7 * trend);

  insights.push({
    id: "pred-revenue-7d",
    type: "revenue_forecast",
    title: "Estimated revenue (next 7 days)",
    prediction: `$${rev7d.toLocaleString()}`,
    confidencePct: input.snapshot.profitRollups ? 82 : 58,
    horizonDays: 7,
    severity: "info",
    supportingData: [
      { label: "30d revenue", value: `$${Math.round(rev).toLocaleString()}` },
      { label: "Trend factor", value: `${Math.round(trend * 100)}%` },
    ],
    primaryFactors: [
      trend >= 1 ? "Positive 30d revenue trend" : "Negative 30d revenue trend",
      `Base run-rate $${Math.round(rev / 30).toLocaleString()}/day`,
    ],
    possibleActions: [
      { label: "Scale winning campaigns", detail: "Increase budget on campaigns with ROAS above target", futureAction: "increase_budget" },
      { label: "Review underperformers", detail: "Pause campaigns dragging blended efficiency", futureAction: "pause_campaign" },
    ],
  });

  insights.push({
    id: "pred-profit-7d",
    type: "profit_forecast",
    title: "Expected profit (next 7 days)",
    prediction: `$${profit7d.toLocaleString()}`,
    confidencePct: input.profitDashboard ? 80 : 55,
    horizonDays: 7,
    severity: profit7d < 0 ? "warning" : "info",
    supportingData: [
      { label: "30d net profit", value: `$${Math.round(profit).toLocaleString()}` },
      { label: "Margin", value: `${input.profitDashboard?.primary.profitMarginPct?.toFixed(1) ?? "—"}%` },
    ],
    primaryFactors: [
      `Revenue trend factor ${Math.round(trend * 100)}%`,
      spend > 0 ? `Ad spend $${Math.round(spend).toLocaleString()}/30d` : "No ad spend synced",
    ],
    possibleActions: [
      { label: "Reduce ad waste", detail: "Trim spend on sub-1.0 ROAS campaigns", futureAction: "reduce_budget" },
    ],
  });

  const stockouts = input.inventoryForecasts.filter((r) => r.risk === "stockout");
  if (stockouts.length > 0) {
    const worst = stockouts[0];
    insights.push({
      id: `pred-stockout-${worst.productId}`,
      type: "stockout_risk",
      title: `Risk of stockout: ${worst.title}`,
      prediction: `${worst.daysRemaining ?? "?"} days of inventory remaining`,
      confidencePct: worst.daysRemaining != null ? clamp(90 - worst.daysRemaining * 3) : 65,
      horizonDays: Math.ceil(worst.daysRemaining ?? 14),
      severity: (worst.daysRemaining ?? 99) <= 7 ? "critical" : "warning",
      supportingData: [
        { label: "Units on hand", value: String(worst.inventory) },
        { label: "Lost revenue risk", value: `$${worst.lostRevenueRisk.toLocaleString()}` },
      ],
      primaryFactors: [
        `${worst.daysRemaining ?? "?"} days of inventory at current velocity`,
        `Lost revenue risk $${worst.lostRevenueRisk.toLocaleString()}`,
      ],
      possibleActions: [
        { label: "Restock now", detail: `Reorder ${worst.title} before stockout`, futureAction: "restock_product" },
      ],
    });
  }

  const campaigns = input.snapshot.campaigns ?? [];
  const losingCampaigns = campaigns.filter(
    (c) => c.status === "ACTIVE" && c.roas7d != null && c.roas7d < 1,
  );
  if (losingCampaigns.length > 0) {
    const worst = losingCampaigns.sort((a, b) => (a.roas7d ?? 0) - (b.roas7d ?? 0))[0];
    insights.push({
      id: `pred-campaign-${worst.id}`,
      type: "campaign_profitability",
      title: `Campaign likely to lose profitability: ${worst.name}`,
      prediction: `ROAS ${(worst.roas7d ?? 0).toFixed(2)} — spending exceeds attributed revenue`,
      confidencePct: 78,
      horizonDays: 7,
      severity: "critical",
      supportingData: [
        { label: "7d spend", value: `$${(worst.spend7d ?? 0).toLocaleString()}` },
        { label: "7d revenue", value: `$${(worst.revenue7d ?? 0).toLocaleString()}` },
      ],
      primaryFactors: [
        `ROAS ${(worst.roas7d ?? 0).toFixed(2)} below breakeven`,
        `Active spend $${(worst.spend7d ?? 0).toLocaleString()}/7d`,
      ],
      possibleActions: [
        { label: "Pause campaign", detail: `Stop delivery on ${worst.name}`, futureAction: "pause_campaign" },
        { label: "Reduce budget", detail: "Cut spend until ROAS recovers", futureAction: "reduce_budget" },
      ],
    });
  }

  if (roas != null) {
    const projectedRoas = Math.round(roas * (0.95 + (trend - 1) * 0.3) * 100) / 100;
    insights.push({
      id: "pred-roas-7d",
      type: "roas_forecast",
      title: "Expected ROAS next week",
      prediction: projectedRoas.toFixed(2),
      confidencePct: 72,
      horizonDays: 7,
      severity: projectedRoas < 1.5 ? "warning" : "info",
      supportingData: [
        { label: "Current 30d ROAS", value: roas.toFixed(2) },
        { label: "Trend adjustment", value: trend >= 1 ? "Positive" : "Negative" },
      ],
      primaryFactors: [
        `Current blended ROAS ${roas.toFixed(2)}`,
        trend >= 1 ? "Revenue trend supports ROAS" : "Revenue softness may pressure ROAS",
      ],
      possibleActions: [
        { label: "Reallocate budget", detail: "Shift spend from low to high ROAS campaigns", futureAction: "increase_budget" },
      ],
    });
  }

  for (const row of stockouts.slice(0, 2)) {
    if (row.daysRemaining == null) continue;
    insights.push({
      id: `pred-depletion-${row.productId}`,
      type: "inventory_depletion",
      title: `Expected inventory depletion: ${row.title}`,
      prediction: row.recommendedPurchaseDate
        ? `Reorder by ${row.recommendedPurchaseDate}`
        : `Depletes in ~${row.daysRemaining} days`,
      confidencePct: 75,
      horizonDays: Math.ceil(row.daysRemaining),
      severity: row.daysRemaining <= 10 ? "warning" : "info",
      supportingData: [
        { label: "Days remaining", value: String(row.daysRemaining) },
        { label: "Lost profit risk", value: `$${row.lostProfitRisk.toLocaleString()}` },
      ],
      primaryFactors: [
        `Depletion in ~${row.daysRemaining} days`,
        row.recommendedPurchaseDate ? `Reorder by ${row.recommendedPurchaseDate}` : "Velocity exceeds supply",
      ],
      possibleActions: [
        { label: "Place reorder", detail: `Restock ${row.title}`, futureAction: "restock_product" },
      ],
    });
  }

  const cashFlow7d = Math.round(profit7d - spend * (7 / 30));
  insights.push({
    id: "pred-cashflow-7d",
    type: "cash_flow",
    title: "Expected cash flow (next 7 days)",
    prediction: `${cashFlow7d >= 0 ? "+" : ""}$${cashFlow7d.toLocaleString()}`,
    confidencePct: 68,
    horizonDays: 7,
    severity: cashFlow7d < 0 ? "warning" : "info",
    supportingData: [
      { label: "Est. profit", value: `$${profit7d.toLocaleString()}` },
      { label: "Ad spend (prorated)", value: `$${Math.round(spend * (7 / 30)).toLocaleString()}` },
    ],
    primaryFactors: [
      `Projected profit $${profit7d.toLocaleString()}`,
      `Ad spend prorated $${Math.round(spend * (7 / 30)).toLocaleString()}`,
    ],
    possibleActions: cashFlow7d < 0
      ? [{ label: "Cut inefficient spend", detail: "Pause sub-target ROAS campaigns", futureAction: "pause_campaign" }]
      : [{ label: "Reinvest surplus", detail: "Scale top campaigns with headroom", futureAction: "increase_budget" }],
  });

  return insights;
}
