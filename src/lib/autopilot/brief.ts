import type { AutopilotAction, ExecutiveDailyBrief, StoreBriefMetrics } from "./types";
import type { AutopilotContext } from "./types";

export function buildExecutiveDailyBrief(
  ctx: AutopilotContext,
  actions: AutopilotAction[],
  executiveHealthScore: number,
): ExecutiveDailyBrief {
  const { profitDashboard, productIntelligence, attributionDashboard, topOpportunities } = ctx;

  const metrics: StoreBriefMetrics = {
    revenue30d: profitDashboard?.primary.revenue ?? ctx.snapshot.storeMetrics.revenue30d,
    netProfit30d: profitDashboard?.primary.netProfit ?? 0,
    profitMarginPct: profitDashboard?.primary.profitMarginPct ?? 0,
    blendedRoas: profitDashboard?.blendedRoas?.blendedRoas30d ?? null,
    cac: attributionDashboard?.acquisition.cac ?? null,
    bestProduct: productIntelligence?.products[0]?.title ?? null,
    worstProduct: productIntelligence?.losingMoney[0]?.title ?? null,
    inventoryRiskCount: productIntelligence?.inventoryRisk.length ?? 0,
    advertisingChange:
      attributionDashboard?.attributionOpportunities[0]?.title ??
      (profitDashboard?.blendedRoas?.isAdvertisingProfitable
        ? "Advertising profitable — monitor scale opportunities"
        : "Review ad efficiency"),
    newOpportunityCount: topOpportunities.length,
  };

  const sections = [
    {
      label: "Revenue & Profit",
      content: `$${metrics.revenue30d.toLocaleString()} revenue · $${metrics.netProfit30d.toLocaleString()} net profit (${metrics.profitMarginPct}% margin)`,
    },
    {
      label: "Marketing",
      content: `Blended ROAS ${metrics.blendedRoas?.toFixed(2) ?? "—"} · CAC ${metrics.cac != null ? `$${metrics.cac}` : "—"}`,
    },
    {
      label: "Products",
      content: `Best: ${metrics.bestProduct ?? "—"} · Watch: ${metrics.worstProduct ?? "none losing money"}`,
    },
    {
      label: "Inventory",
      content:
        metrics.inventoryRiskCount > 0
          ? `${metrics.inventoryRiskCount} SKUs need attention`
          : "No critical inventory risks",
    },
    {
      label: "Advertising",
      content: metrics.advertisingChange ?? "No changes flagged",
    },
    {
      label: "Opportunities",
      content: `${metrics.newOpportunityCount} profit actions ranked by net impact`,
    },
  ];

  const topAction = actions[0]?.title ?? null;
  const headline =
    topAction != null
      ? `Focus today: ${topAction}`
      : executiveHealthScore >= 70
        ? "Store is healthy — optimize top profit levers"
        : "Address critical alerts to protect profit";

  return {
    title: "Today's Store Brief",
    generatedAt: new Date().toISOString(),
    headline,
    metrics,
    sections,
    topAction,
    confidencePct: Math.min(95, 60 + (profitDashboard ? 20 : 0) + (attributionDashboard ? 10 : 0)),
  };
}
