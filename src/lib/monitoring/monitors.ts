import type { AIEvent, MonitorContext } from "./types";

function now(): string {
  return new Date().toISOString();
}

export function runRevenueMonitor(ctx: MonitorContext): AIEvent[] {
  const events: AIEvent[] = [];
  const rollups = ctx.snapshot.profitRollups;
  const trends = ctx.snapshot.salesTrends;

  if (rollups && rollups.yesterday.revenue > 0) {
    const prior = rollups.today.revenue * 0.92 || rollups.yesterday.revenue;
    const pct = prior > 0 ? ((rollups.yesterday.revenue - prior) / prior) * 100 : 0;
    if (Math.abs(pct) >= 5) {
      events.push({
        id: "mon-revenue-yesterday",
        type: "revenue_change",
        severity: pct < -10 ? "critical" : pct < 0 ? "warning" : "info",
        title: pct < 0 ? `Revenue dropped ${Math.abs(pct).toFixed(0)}% yesterday` : `Revenue increased ${pct.toFixed(0)}% yesterday`,
        description:
          pct < 0
            ? "Yesterday's revenue underperformed the recent daily baseline."
            : "Yesterday outperformed the recent daily baseline.",
        evidence: [
          { label: "Yesterday revenue", value: `$${Math.round(rollups.yesterday.revenue).toLocaleString()}` },
          { label: "Change", value: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`, trend: pct >= 0 ? "up" : "down" },
        ],
        recommendation:
          pct < -10
            ? "Review Google and Meta campaign delivery and check for stockouts on top SKUs."
            : "Monitor whether the lift sustains through the week before scaling ad spend.",
        confidencePct: 88,
        createdAt: now(),
        monitor: "Revenue Monitor",
        actionAvailable: false,
      });
    }
  }

  if (trends && trends.lastWeek.revenue > 0) {
    const wow =
      ((trends.thisWeek.revenue - trends.lastWeek.revenue) / trends.lastWeek.revenue) * 100;
    if (wow <= -12) {
      events.push({
        id: "mon-revenue-wow",
        type: "revenue_change",
        severity: wow <= -20 ? "critical" : "warning",
        title: `Weekly revenue down ${Math.abs(wow).toFixed(0)}%`,
        description: "This week's revenue trails last week significantly.",
        evidence: [
          { label: "This week", value: `$${Math.round(trends.thisWeek.revenue).toLocaleString()}` },
          { label: "Last week", value: `$${Math.round(trends.lastWeek.revenue).toLocaleString()}` },
          { label: "WoW", value: `${wow.toFixed(1)}%`, trend: "down" },
        ],
        recommendation: "Check conversion rate, ad spend efficiency, and returning customer volume.",
        confidencePct: 85,
        createdAt: now(),
        monitor: "Revenue Monitor",
        actionAvailable: false,
      });
    }
  }

  return events;
}

export function runRoasMonitor(ctx: MonitorContext): AIEvent[] {
  const events: AIEvent[] = [];
  const blended = ctx.profitDashboard?.blendedRoas;
  const google = ctx.snapshot.googleAdsSnapshot;

  if (blended?.blendedRoas30d != null) {
    const period = blended.periods.find((p) => p.window === "last30d");
    const prev = period?.previousRoas;
    if (prev != null && blended.blendedRoas30d < prev * 0.9) {
      const drop = ((blended.blendedRoas30d - prev) / prev) * 100;
      events.push({
        id: "mon-roas-blended",
        type: "roas_change",
        severity: blended.blendedRoas30d < 1.2 ? "critical" : "warning",
        title: `Blended ROAS fell to ${blended.blendedRoas30d.toFixed(2)}`,
        description: `ROAS declined ${Math.abs(drop).toFixed(0)}% vs the prior 30-day period.`,
        evidence: [
          { label: "Current ROAS", value: blended.blendedRoas30d.toFixed(2), trend: "down" },
          { label: "Prior ROAS", value: prev.toFixed(2) },
          { label: "30d ad spend", value: `$${Math.round(period?.adSpend ?? 0).toLocaleString()}` },
        ],
        recommendation: "Pause zero-conversion campaigns and reallocate budget to top performers.",
        confidencePct: blended.confidence.level === "High" ? 92 : 78,
        futureAction: "reduce_budget",
        actionAvailable: false,
        createdAt: now(),
        monitor: "ROAS Monitor",
      });
    }
  }

  if (google && google.campaigns.length > 0) {
    const searchCampaigns = google.campaigns.filter((c) => c.type === "search" && c.status === "ENABLED");
    const targetRoas = 2.0;
    for (const c of searchCampaigns) {
      const spend = c.spend7d ?? 0;
      const rev = c.revenue7d ?? 0;
      const roas = spend > 0 ? rev / spend : 0;
      if (spend >= 200 && roas < targetRoas * 0.75) {
        events.push({
          id: `mon-google-roas-${c.id}`,
          type: "roas_change",
          severity: roas < 1 ? "critical" : "warning",
          title: `Google Search ROAS below target on ${c.name}`,
          description: `ROAS ${roas.toFixed(2)} is below the ${targetRoas.toFixed(1)} target.`,
          evidence: [
            { label: "7d ROAS", value: roas.toFixed(2), trend: "down" },
            { label: "7d spend", value: `$${spend.toLocaleString()}` },
            { label: "Target", value: targetRoas.toFixed(1) },
          ],
          recommendation: `Review search terms and pause underperforming ad groups on ${c.name}.`,
          confidencePct: 90,
          futureAction: "reduce_budget",
          actionAvailable: false,
          createdAt: now(),
          monitor: "ROAS Monitor",
        });
        break;
      }
    }
  }

  return events;
}

export function runInventoryMonitor(ctx: MonitorContext): AIEvent[] {
  const events: AIEvent[] = [];
  const risks = ctx.productIntelligence?.inventoryRisk ?? [];

  for (const p of risks.slice(0, 3)) {
    if (p.daysUntilStockout == null || p.daysUntilStockout > 7) continue;
    events.push({
      id: `mon-inventory-${p.productId}`,
      type: "inventory_risk",
      severity: p.daysUntilStockout <= 5 ? "critical" : "warning",
      title:
        p.daysUntilStockout <= 0
          ? `${p.title} is out of stock today`
          : p.daysUntilStockout <= 1
            ? `${p.title} — less than 24 hours remaining`
            : p.daysUntilStockout <= 5
              ? `${p.title} will be out of stock within ${p.daysUntilStockout} days`
              : `Low inventory: ${p.title}`,
      description: `${p.inventory} units on hand at current sell-through velocity.`,
      evidence: [
        { label: "Days until stockout", value: String(p.daysUntilStockout) },
        { label: "Units on hand", value: String(p.inventory) },
        { label: "30d units sold", value: String(p.unitsSold) },
      ],
      recommendation: `Reorder ${p.title} before stockout to avoid lost revenue.`,
      confidencePct: p.daysUntilStockout <= 3 ? 94 : 82,
      estimatedImpact: {
        monthlyRevenue: Math.round(p.revenue * 0.15),
        label: `Risk of lost sales on ${p.title}`,
      },
      futureAction: "restock_product",
      actionAvailable: false,
      createdAt: now(),
      monitor: "Inventory Monitor",
    });
  }

  return events;
}

export function runCampaignMonitor(ctx: MonitorContext): AIEvent[] {
  const events: AIEvent[] = [];

  for (const c of ctx.snapshot.campaigns ?? []) {
    if (c.status !== "ACTIVE") continue;
    const spend = c.spend7d ?? 0;
    const revenue = c.revenue7d ?? 0;
    if (spend >= 400 && revenue === 0) {
      events.push({
        id: `mon-campaign-zero-${c.id}`,
        type: "campaign_issue",
        severity: spend >= 500 ? "critical" : "warning",
        title: `${c.name} spent $${spend.toLocaleString()} without conversions`,
        description: "Active campaign with zero attributed purchases in the last 7 days.",
        evidence: [
          { label: "7d spend", value: `$${spend.toLocaleString()}` },
          { label: "Conversions", value: "0", trend: "down" },
          { label: "CTR", value: `${(c.ctr7d ?? 0).toFixed(2)}%` },
        ],
        recommendation: `Pause ${c.name} and audit creative, audience, and landing page.`,
        confidencePct: 95,
        futureAction: "pause_campaign",
        actionAvailable: false,
        estimatedImpact: { monthlyProfit: Math.round(spend * 4.33 * 0.7), label: `Recover ~$${Math.round(spend * 4.33 * 0.7)}/mo inefficient spend` },
        createdAt: now(),
        monitor: "Campaign Monitor",
      });
    }
  }

  const google = ctx.snapshot.googleAdsSnapshot;
  if (google) {
    for (const c of google.campaigns) {
      if (c.status !== "ENABLED") continue;
      const spend = c.spend7d ?? 0;
      const conv = c.conversions7d ?? 0;
      if (spend >= 400 && conv === 0) {
        events.push({
          id: `mon-google-campaign-${c.id}`,
          type: "campaign_issue",
          severity: "critical",
          title: `Campaign ${c.name} has spent $${spend.toLocaleString()} without conversions`,
          description: "Google Ads campaign with zero conversions in 7 days.",
          evidence: [
            { label: "7d spend", value: `$${spend.toLocaleString()}` },
            { label: "Conversions", value: "0" },
            { label: "Type", value: c.type },
          ],
          recommendation: `Pause ${c.name} and review keywords and search terms.`,
          confidencePct: 95,
          futureAction: "pause_campaign",
          actionAvailable: false,
          createdAt: now(),
          monitor: "Campaign Monitor",
        });
        break;
      }
    }
  }

  return events;
}

export function runCustomerMonitor(ctx: MonitorContext): AIEvent[] {
  const events: AIEvent[] = [];
  const acq = ctx.attributionDashboard?.acquisition;
  if (!acq) return events;

  const total = acq.newCustomers + acq.returningCustomers;
  if (total < 10) return events;

  const returningPct = (acq.returningCustomers / total) * 100;
  if (returningPct < 25 && acq.returningCustomerRevenue > 0) {
    const revShare =
      acq.returningCustomerRevenue /
      Math.max(acq.returningCustomerRevenue + acq.newCustomerRevenue, 1);
    if (revShare < 0.2) {
      events.push({
        id: "mon-customer-returning",
        type: "customer_change",
        severity: returningPct < 18 ? "critical" : "warning",
        title: `Returning customers at ${returningPct.toFixed(0)}% of orders`,
        description: "Repeat purchase share is below healthy benchmarks for DTC brands.",
        evidence: [
          { label: "Returning customers", value: String(acq.returningCustomers), trend: "down" },
          { label: "New customers", value: String(acq.newCustomers) },
          { label: "Returning revenue", value: `$${Math.round(acq.returningCustomerRevenue).toLocaleString()}` },
        ],
        recommendation: "Launch a win-back email flow and review post-purchase experience.",
        confidencePct: 80,
        futureAction: "create_email_campaign",
        actionAvailable: false,
        createdAt: now(),
        monitor: "Customer Monitor",
      });
    }
  }

  return events;
}

export function runMarketingEfficiencyMonitor(ctx: MonitorContext): AIEvent[] {
  const events: AIEvent[] = [];
  const campaigns = ctx.snapshot.campaigns ?? [];

  for (const c of campaigns) {
    if (c.status !== "ACTIVE" || (c.spend7d ?? 0) < 100 || (c.impressions7d ?? 0) < 1000) continue;
    const cpm = (c.spend7d / c.impressions7d) * 1000;
    const accountAvgCpm =
      campaigns.reduce((s, x) => s + (x.impressions7d > 0 ? (x.spend7d / x.impressions7d) * 1000 : 0), 0) /
      Math.max(campaigns.filter((x) => x.impressions7d > 0).length, 1);
    if (accountAvgCpm > 0 && cpm >= accountAvgCpm * 1.28) {
      const cpmIncrease = ((cpm - accountAvgCpm) / accountAvgCpm) * 100;
      if (cpmIncrease >= 20) {
        const roas = c.revenue7d > 0 && c.spend7d > 0 ? c.revenue7d / c.spend7d : 0;
        events.push({
          id: `mon-meta-cpm-${c.id}`,
          type: "marketing_efficiency",
          severity: cpmIncrease >= 28 ? "critical" : "warning",
          title: `Advertising efficiency declined on ${c.name}`,
          description:
            "Customer acquisition became more expensive — delivery costs rose while returns may not keep pace.",
          evidence: [
            { label: "ROAS (7d)", value: roas > 0 ? roas.toFixed(2) : "—", trend: roas < 1 ? "down" : "flat" },
            { label: "CPM", value: `$${cpm.toFixed(2)}`, trend: "up" },
            { label: "CPM vs avg", value: `+${cpmIncrease.toFixed(0)}%` },
            { label: "Frequency", value: (c.frequency7d ?? 0).toFixed(1) },
          ],
          recommendation: "Refresh creatives or expand audiences before scaling budget.",
          confidencePct: 86,
          futureAction: "reduce_budget",
          actionAvailable: false,
          createdAt: now(),
          monitor: "Marketing Efficiency Monitor",
        });
        break;
      }
    }
  }

  return events;
}

export function runPredictionMonitor(ctx: MonitorContext): AIEvent[] {
  return ctx.predictiveInsights
    .filter((p) => p.severity === "critical" || p.severity === "warning")
    .slice(0, 3)
    .map((p) => ({
      id: `mon-pred-${p.id}`,
      type: "prediction_alert" as const,
      severity: p.severity === "critical" ? ("critical" as const) : ("warning" as const),
      title: p.title,
      description: p.prediction,
      evidence: p.supportingData.map((d) => ({ label: d.label, value: d.value })),
      recommendation:
        p.possibleActions?.[0]?.label ??
        "Review this forecast in Predictive Intelligence and act before the horizon date.",
      confidencePct: p.confidencePct,
      createdAt: now(),
      monitor: "Predictive Monitor",
      actionAvailable: false,
      futureAction: p.possibleActions?.[0]?.futureAction,
    }));
}

export function runOpportunityMonitor(ctx: MonitorContext): AIEvent[] {
  return ctx.opportunities
    .filter((o) => o.severity === "critical")
    .slice(0, 2)
    .map((o) => ({
      id: `mon-opp-${o.id}`,
      type: "opportunity_detected" as const,
      severity: "critical" as const,
      title: o.title,
      description: o.description,
      evidence: o.supportingMetrics.slice(0, 4),
      recommendation: o.recommendation,
      confidencePct: o.confidence,
      estimatedImpact: {
        monthlyRevenue: o.expectedImpact.revenueMonthly,
        monthlyProfit: o.expectedImpact.profitMonthly,
        label: o.expectedImpact.label,
      },
      futureAction: o.futureAction,
      actionAvailable: false,
      createdAt: now(),
      monitor: "Opportunity Engine",
    }));
}
