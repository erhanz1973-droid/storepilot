import type { AutopilotContext, AutopilotAlert, AutopilotPriority } from "./types";

function alert(
  partial: Omit<AutopilotAlert, "id"> & { id?: string },
): AutopilotAlert {
  return { ...partial, id: partial.id ?? `alert-${partial.type}-${Date.now()}` };
}

export function buildAutopilotAlerts(ctx: AutopilotContext): AutopilotAlert[] {
  const alerts: AutopilotAlert[] = [];
  const { profitDashboard, productIntelligence, attributionDashboard, snapshot } = ctx;

  if (profitDashboard && snapshot.salesTrends) {
    const prev = snapshot.salesTrends.previous30Days;
    const cur = snapshot.salesTrends.last30Days;
    const profitEst = profitDashboard.primary.netProfit ?? 0;
    const prevProfitEst = prev.revenue * ((profitDashboard.primary.profitMarginPct ?? 0) / 100);
    if (profitEst < prevProfitEst * 0.92) {
      alerts.push(
        alert({
          id: "alert-profit-drop",
          type: "profit_drop",
          severity: "Critical",
          title: "Net profit declined vs prior period",
          reason: `30-day net profit estimated at $${profitEst.toLocaleString()} vs ~$${Math.round(prevProfitEst).toLocaleString()} prior.`,
          businessImpact: "Margin compression may reduce cash available for growth.",
          suggestedAction: "Review COGS, ad spend, and refund-heavy SKUs on Net Profit.",
          confidenceScore: 0.84,
        }),
      );
    }
  }

  const roas = profitDashboard?.blendedRoas?.blendedRoas30d;
  const prevRoas = profitDashboard?.blendedRoas?.periods.find((p) => p.window === "last30d")?.previousRoas;
  if (roas != null && prevRoas != null && roas < prevRoas * 0.85) {
    alerts.push(
      alert({
        id: "alert-roas-drop",
        type: "roas_drop",
        severity: "High",
        title: "Blended ROAS decreased",
        reason: `ROAS dropped from ${prevRoas.toFixed(2)} to ${roas.toFixed(2)}.`,
        businessImpact: "Each ad dollar is generating less revenue.",
        suggestedAction: "Pause underperforming campaigns and review Attribution dashboard.",
        confidenceScore: 0.8,
      }),
    );
  }

  if (snapshot.salesTrends) {
    const wow =
      snapshot.salesTrends.lastWeek.revenue > 0
        ? ((snapshot.salesTrends.thisWeek.revenue - snapshot.salesTrends.lastWeek.revenue) /
            snapshot.salesTrends.lastWeek.revenue) *
          100
        : 0;
    if (wow < -15) {
      alerts.push(
        alert({
          id: "alert-traffic",
          type: "traffic_anomaly",
          severity: "High",
          title: "Weekly revenue anomaly detected",
          reason: `This week revenue is ${Math.abs(Math.round(wow))}% below last week.`,
          businessImpact: "Short-term cash flow and ad efficiency may be affected.",
          suggestedAction: "Check inventory stockouts and campaign delivery.",
          confidenceScore: 0.76,
        }),
      );
    }
  }

  for (const p of productIntelligence?.inventoryRisk.slice(0, 2) ?? []) {
    alerts.push(
      alert({
        id: `alert-inv-${p.productId}`,
        type: "inventory_risk",
        severity: p.daysUntilStockout != null && p.daysUntilStockout <= 7 ? "Critical" : "High",
        title: `Inventory risk — ${p.title}`,
        reason:
          p.daysUntilStockout != null
            ? `~${p.daysUntilStockout} days until stockout at current velocity.`
            : "Slow-moving inventory ties up capital.",
        businessImpact: `Potential lost profit on a ${p.marginPct}% margin SKU.`,
        suggestedAction: p.daysUntilStockout != null ? "Restock immediately." : "Run promotion or bundle.",
        confidenceScore: 0.88,
      }),
    );
  }

  const highRefund = productIntelligence?.highestRefunds[0];
  if (highRefund && highRefund.value > 5) {
    alerts.push(
      alert({
        id: "alert-refund",
        type: "refund_spike",
        severity: "Medium",
        title: `Elevated refunds — ${highRefund.title}`,
        reason: `Refund rate ${highRefund.sublabel ?? `${highRefund.value}%`} on a top SKU.`,
        businessImpact: "Refunds directly reduce net profit.",
        suggestedAction: "Review product quality, sizing, and ad targeting.",
        confidenceScore: 0.72,
      }),
    );
  }

  const fatigued = attributionDashboard?.fatiguedCreatives[0];
  if (fatigued) {
    alerts.push(
      alert({
        id: `alert-fatigue-${fatigued.creativeId}`,
        type: "campaign_fatigue",
        severity: "Medium",
        title: `Creative fatigue — ${fatigued.creativeName}`,
        reason: `CTR ${fatigued.ctr}% with high frequency on ${fatigued.campaignName}.`,
        businessImpact: "ROAS likely to decline if creative is not refreshed.",
        suggestedAction: "Refresh creative or rotate new assets.",
        confidenceScore: 0.74,
      }),
    );
  }

  const losing = productIntelligence?.losingMoney[0];
  if (losing && losing.marginPct < 10) {
    alerts.push(
      alert({
        id: `alert-margin-${losing.productId}`,
        type: "margin_deterioration",
        severity: "High",
        title: `Margin deterioration — ${losing.title}`,
        reason: `SKU losing $${Math.abs(losing.netProfit).toLocaleString()} net with ${losing.marginPct}% margin.`,
        businessImpact: "Negative-margin SKUs drag overall profitability.",
        suggestedAction: "Raise price, reduce ad spend, or discontinue.",
        confidenceScore: 0.86,
      }),
    );
  }

  const priorityOrder: Record<AutopilotPriority, number> = {
    Critical: 0,
    High: 1,
    Medium: 2,
    Low: 3,
  };

  return alerts.sort(
    (a, b) =>
      priorityOrder[a.severity] - priorityOrder[b.severity] ||
      b.confidenceScore - a.confidenceScore,
  );
}
