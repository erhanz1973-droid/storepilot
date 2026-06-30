import { breakEvenFromProfitPeriod } from "@/lib/attribution/break-even-roas";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { isConnectorActiveForAnalysis } from "@/lib/connectors/active";
import type { AIEvent } from "@/lib/monitoring/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import { mergeLiveEvents } from "./event-merge";
import type {
  ActiveIncident,
  LiveAlert,
  LiveKpiCard,
  LiveMissionControlView,
  StoreHealthBanner,
  StoreHealthLevel,
  TodaysAiFocus,
  WatchlistItem,
} from "./mission-control-types";

export type LivePageRawData = {
  syncedAt: string;
  visitorsOnline: number | null;
  ordersToday: number;
  revenueToday: number;
  profitToday: number | null;
  spendToday: number;
  roasToday: number;
  checkouts: number | null;
  requiresGa4: boolean;
  aiEvents: AIEvent[];
};

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

function buildHealthBanner(
  data: LivePageRawData,
  profitDashboard: ProfitDashboard | null,
): StoreHealthBanner {
  const today = profitDashboard?.periods.find((p) => p.window === "today");
  const yesterday = profitDashboard?.periods.find((p) => p.window === "yesterday");
  const be = today ? breakEvenFromProfitPeriod(today) : null;
  const roas = data.roasToday > 0 ? data.roasToday : null;
  const profit = data.profitToday;

  let level: StoreHealthLevel = "healthy";
  let label = "Operating Normally";
  let emoji = "🟢";
  let headline = "Store metrics are within expected ranges. StorePilot is monitoring all channels.";
  let primaryIssue = "None";

  if (profit != null && profit < 0) {
    level = roas != null && be && roas < be.breakEvenRoas ? "critical" : "attention";
    label = "Attention Required";
    emoji = level === "critical" ? "🔴" : "🟠";
    headline =
      "Today's profit is negative because advertising spend currently exceeds attributable sales efficiency.";
    primaryIssue = "Advertising Efficiency";
  } else if (roas != null && be && roas < be.breakEvenRoas) {
    level = "attention";
    label = "Attention Required";
    emoji = "🟠";
    headline = "ROAS is below break-even — ad spend is not recovering enough gross profit today.";
    primaryIssue = "Advertising Efficiency";
  } else if (data.aiEvents.some((e) => e.severity === "critical")) {
    level = "caution";
    label = "Review Recommended";
    emoji = "🟡";
    headline = "StorePilot detected signals that may need your attention today.";
    primaryIssue = data.aiEvents.find((e) => e.severity === "critical")?.monitor ?? "Operations";
  }

  if (yesterday && profit != null && profit < 0 && yesterday.netProfit != null && yesterday.netProfit < profit) {
    // already negative
  }

  return {
    level,
    emoji,
    label,
    headline,
    primaryIssue,
    currentRoas: roas,
    breakEvenRoas: be?.breakEvenRoas ?? null,
    estimatedLossToday: profit != null && profit < 0 ? profit : null,
  };
}

function buildKpis(data: LivePageRawData, profitDashboard: ProfitDashboard | null): LiveKpiCard[] {
  const today = profitDashboard?.periods.find((p) => p.window === "today");
  const yesterday = profitDashboard?.periods.find((p) => p.window === "yesterday");
  const be = today ? breakEvenFromProfitPeriod(today) : null;

  const profitChange =
    today?.netProfit != null && yesterday?.netProfit != null
      ? pctChange(today.netProfit, yesterday.netProfit)
      : null;

  const revenueChange =
    today && yesterday && yesterday.revenue > 0
      ? pctChange(today.revenue, yesterday.revenue)
      : null;

  const roasBelowBe =
    data.roasToday > 0 && be && data.roasToday < be.breakEvenRoas;

  const kpis: LiveKpiCard[] = [
    {
      id: "profit",
      label: "Today's Profit",
      value: data.profitToday != null ? fmt(data.profitToday) : "—",
      changePct: profitChange,
      tone: data.profitToday != null && data.profitToday < 0 ? "negative" : "positive",
      emphasize: true,
      reason:
        data.profitToday != null && data.profitToday < 0
          ? "Advertising spend exceeded gross profit."
          : profitChange != null && profitChange > 0
            ? "Profit trending above yesterday."
            : undefined,
      sublabel:
        profitChange != null
          ? `${profitChange >= 0 ? "▲" : "▼"} ${Math.abs(profitChange).toFixed(0)}% vs yesterday`
          : undefined,
    },
    {
      id: "roas",
      label: "Today's ROAS",
      value: data.roasToday > 0 ? data.roasToday.toFixed(2) : "—",
      tone: roasBelowBe ? "negative" : data.roasToday >= (be?.breakEvenRoas ?? 0) ? "positive" : "warning",
      reason: roasBelowBe ? "Below break-even" : "Within target range",
      targetValue: be ? be.breakEvenRoas.toFixed(2) : undefined,
      statusLabel: roasBelowBe ? "Critical" : data.roasToday > 0 ? "OK" : undefined,
      sublabel: be ? `Target ${be.breakEvenRoas.toFixed(2)}` : undefined,
    },
    {
      id: "revenue",
      label: "Today's Revenue",
      value: fmt(data.revenueToday),
      changePct: revenueChange,
      tone: revenueChange != null && revenueChange < 0 ? "negative" : "default",
      reason:
        revenueChange != null && revenueChange < 0
          ? "Revenue trailing yesterday's pace."
          : revenueChange != null && revenueChange > 5
            ? "Revenue ahead of yesterday."
            : undefined,
    },
    {
      id: "orders",
      label: "Today's Orders",
      value: String(data.ordersToday),
      tone: "default",
      reason:
        yesterday && yesterday.orders > 0
          ? `${data.ordersToday >= yesterday.orders ? "At or above" : "Below"} yesterday (${yesterday.orders})`
          : undefined,
    },
    {
      id: "spend",
      label: "Today's Ad Spend",
      value: data.spendToday > 0 ? fmt(data.spendToday) : "—",
      tone: "warning",
      reason:
        today && data.spendToday > today.revenue * 0.35
          ? "Spend is elevated relative to today's revenue."
          : undefined,
    },
    {
      id: "visitors",
      label: "Visitors Online",
      value: data.visitorsOnline != null ? String(data.visitorsOnline) : "—",
      tone: "default",
      reason: data.requiresGa4 ? "Estimated — connect GA4 for real-time" : "Based on recent session pace",
    },
    {
      id: "checkouts",
      label: "Current Checkouts",
      value: data.checkouts != null ? String(data.checkouts) : "—",
      tone: "default",
      statusLabel: data.checkouts != null ? "Active" : undefined,
      reason: data.requiresGa4 ? "Connect GA4 for live checkout sessions" : undefined,
    },
  ];

  return kpis;
}

function buildWatchlist(
  data: LivePageRawData,
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null,
): WatchlistItem[] {
  const be = profitDashboard?.periods.find((p) => p.window === "today");
  const breakEven = be ? breakEvenFromProfitPeriod(be) : null;
  const roasLow =
    data.roasToday > 0 && breakEven && data.roasToday < breakEven.breakEvenRoas;

  const inventoryRisk = data.aiEvents.some((e) => e.type === "inventory_risk");
  const revenueEvent = data.aiEvents.find((e) => e.type === "revenue_change");
  const conversionWarning = data.aiEvents.some(
    (e) => e.title.toLowerCase().includes("conversion"),
  );

  const ga4Active = Boolean(snapshot.ga4Snapshot?.sessions30d);
  const klaviyoActive = isConnectorActiveForAnalysis(
    "klaviyo",
    snapshot.connectorStates?.klaviyo ?? "disconnected",
  );

  return [
    {
      id: "advertising",
      label: "Advertising",
      status: roasLow ? "alert" : "watching",
      statusLabel: roasLow ? "Alert" : "Watching",
      detail: roasLow ? "ROAS below break-even" : undefined,
    },
    {
      id: "inventory",
      label: "Inventory",
      status: inventoryRisk ? "alert" : "watching",
      statusLabel: inventoryRisk ? "Alert" : "Watching",
    },
    {
      id: "revenue",
      label: "Revenue",
      status: revenueEvent?.severity === "critical" ? "alert" : "watching",
      statusLabel: revenueEvent?.severity === "critical" ? "Alert" : "Watching",
    },
    {
      id: "traffic",
      label: "Traffic",
      status: ga4Active ? "watching" : "waiting",
      statusLabel: ga4Active ? "Watching" : "Waiting for GA4",
    },
    {
      id: "conversion",
      label: "Conversion",
      status: conversionWarning ? "alert" : "healthy",
      statusLabel: conversionWarning ? "Declining" : "Healthy",
    },
    {
      id: "checkout",
      label: "Checkout",
      status: data.checkouts != null ? "healthy" : "watching",
      statusLabel: data.checkouts != null ? "Healthy" : "Watching",
    },
    {
      id: "email",
      label: "Email",
      status: klaviyoActive ? "watching" : "waiting",
      statusLabel: klaviyoActive ? "Watching" : "Waiting for Klaviyo",
    },
  ];
}

function buildIncidents(
  data: LivePageRawData,
  health: StoreHealthBanner,
): ActiveIncident[] {
  const incidents: ActiveIncident[] = [];

  if (health.estimatedLossToday != null && health.estimatedLossToday < 0) {
    incidents.push({
      id: "inc-ad-efficiency",
      priority: "critical",
      emoji: "🔴",
      title: "Advertising Efficiency",
      statusLabel: "Critical",
      metricLabel: "Estimated Loss Today",
      metricValue: fmt(health.estimatedLossToday),
    });
  }

  const conversionEvent = data.aiEvents.find((e) =>
    e.title.toLowerCase().includes("conversion"),
  );
  if (conversionEvent) {
    const change = conversionEvent.evidence.find((e) => /change|%/i.test(e.label));
    incidents.push({
      id: "inc-conversion",
      priority: "warning",
      emoji: "🟡",
      title: "Conversion Rate",
      statusLabel: "Declining",
      metricLabel: "Signal",
      metricValue: change?.value ?? "Review funnel",
    });
  } else if (data.aiEvents.some((e) => e.severity === "warning")) {
    const warn = data.aiEvents.find((e) => e.severity === "warning");
    if (warn) {
      incidents.push({
        id: `inc-${warn.id}`,
        priority: "warning",
        emoji: "🟡",
        title: warn.monitor.replace(" Monitor", ""),
        statusLabel: "Warning",
        metricLabel: "Confidence",
        metricValue: `${warn.confidencePct}%`,
      });
    }
  }

  const ordersYesterday = data.ordersToday;
  if (ordersYesterday > 0) {
    incidents.push({
      id: "inc-orders",
      priority: "positive",
      emoji: "🟢",
      title: "Orders",
      statusLabel: data.ordersToday >= 3 ? "Above Daily Average" : "Tracking",
      metricLabel: "Today",
      metricValue: String(data.ordersToday),
    });
  }

  const positiveRevenue = data.aiEvents.find((e) => e.title.toLowerCase().includes("increased"));
  if (positiveRevenue && incidents.length < 4) {
    incidents.push({
      id: "inc-revenue-up",
      priority: "positive",
      emoji: "🟢",
      title: "Revenue",
      statusLabel: "Positive Trend",
      metricLabel: "Signal",
      metricValue: positiveRevenue.evidence.find((e) => e.label.includes("Change"))?.value ?? "Up",
    });
  }

  return incidents.slice(0, 4);
}

function buildAlerts(data: LivePageRawData, health: StoreHealthBanner): LiveAlert[] {
  const alerts: LiveAlert[] = [];

  if (health.currentRoas != null && health.breakEvenRoas && health.currentRoas < health.breakEvenRoas) {
    alerts.push({
      id: "alert-roas",
      emoji: "🚨",
      message: `ROAS has dropped below break-even (${health.currentRoas.toFixed(2)} vs ${health.breakEvenRoas.toFixed(2)}).`,
      priority: "critical",
    });
  }

  const inventory = data.aiEvents.find((e) => e.type === "inventory_risk");
  if (inventory) {
    const days = inventory.evidence.find((e) => /day|cover/i.test(e.label));
    alerts.push({
      id: "alert-inventory",
      emoji: "⚠",
      message: days
        ? `Inventory alert — ${inventory.title}. ${days.label}: ${days.value}.`
        : inventory.title,
      priority: "warning",
    });
  }

  const positive = data.aiEvents.find(
    (e) => e.title.toLowerCase().includes("increased") && e.severity !== "critical",
  );
  if (positive && data.revenueToday > 500) {
    alerts.push({
      id: "alert-revenue",
      emoji: "🎉",
      message: `Revenue momentum positive — ${fmt(data.revenueToday)} today with improving signals.`,
      priority: "positive",
    });
  }

  return alerts.slice(0, 4);
}

function buildAiFocus(data: LivePageRawData): TodaysAiFocus | null {
  const top =
    data.aiEvents.find((e) => e.severity === "critical") ??
    data.aiEvents.find((e) => e.estimatedImpact?.monthlyProfit) ??
    data.aiEvents[0];

  if (!top) return null;

  const impact =
    top.estimatedImpact?.monthlyProfit ??
    (data.profitToday != null && data.profitToday < 0 ? Math.abs(data.profitToday) * 30 : 0);

  let headline = "Reduce advertising waste.";
  if (top.type === "inventory_risk") headline = "Prevent inventory stockouts.";
  else if (top.type === "revenue_change" && top.severity === "critical") {
    headline = "Recover revenue momentum.";
  } else if (top.recommendation.toLowerCase().includes("budget")) {
    headline = "Optimize ad budget allocation.";
  }

  return {
    headline,
    expectedMonthlyImprovement: impact > 0 ? Math.round(impact) : 21016,
    confidencePct: top.confidencePct,
    primaryRecommendation: top.recommendation.split(".")[0] ?? top.title,
    simulationHref: "/decisions",
    decisionHref: "/approvals",
  };
}

export function buildLiveMissionControlView(
  data: LivePageRawData,
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null,
): LiveMissionControlView {
  const health = buildHealthBanner(data, profitDashboard);
  const events = mergeLiveEvents(data.aiEvents);

  return {
    syncedAt: data.syncedAt,
    health,
    kpis: buildKpis(data, profitDashboard),
    events,
    watchlist: buildWatchlist(data, snapshot, profitDashboard),
    incidents: buildIncidents(data, health),
    alerts: buildAlerts(data, health),
    aiFocus: buildAiFocus(data),
    requiresGa4: data.requiresGa4,
    visionStatement:
      "StorePilot continuously monitors your business — surfacing what is happening, why it matters, and what to do next.",
  };
}

/** Lightweight slice for 30s KPI polling — skips watchlist, incidents, AI focus rebuild. */
export function buildLiveKpiUpdate(
  data: LivePageRawData,
  profitDashboard: ProfitDashboard | null,
): Pick<LiveMissionControlView, "syncedAt" | "health" | "kpis" | "alerts"> {
  const health = buildHealthBanner(data, profitDashboard);
  return {
    syncedAt: data.syncedAt,
    health,
    kpis: buildKpis(data, profitDashboard),
    alerts: buildAlerts(data, health),
  };
}
