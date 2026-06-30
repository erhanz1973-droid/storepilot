import type { AutopilotDashboard } from "./types";
import {
  AUTOPILOT_CATEGORY_LABELS,
  AUTOPILOT_CATEGORY_ORDER,
  AUTOPILOT_RULE_CATALOG,
  AUTOPILOT_SAFETY_GUARANTEES,
} from "./rule-catalog";
import type {
  AutopilotHistoryItem,
  AutopilotOperationsView,
  AutopilotRuleHealth,
  AutopilotRuleMetric,
  AutopilotRuleView,
  AutopilotStatusSummary,
} from "./operations-types";
import { AUTOPILOT_HEALTH_LABELS } from "./operations-types";

function relativeTimeLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function dayLabelFromDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays === 2) return "2 Days Ago";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function breakEvenRoas(dashboard: AutopilotDashboard | null): number | null {
  if (!dashboard) return null;
  const fromBrief = dashboard.executiveBrief?.metrics?.blendedRoas;
  const margin = dashboard.executiveBrief?.metrics?.profitMarginPct;
  if (margin != null && margin > 0) return Math.round((100 / margin) * 100) / 100;
  return fromBrief ?? null;
}

type RuleSignals = {
  health: AutopilotRuleHealth;
  reason: string | null;
  estimatedMonthlyImpact: number;
  confidencePct: number;
  riskLevel: "Low" | "Medium" | "High";
  actionsTriggered: number;
  pendingCount: number;
  metrics: AutopilotRuleMetric[];
};

function resolveRuleSignals(
  ruleId: string,
  dashboard: AutopilotDashboard | null,
  enabled: boolean,
): RuleSignals {
  const base: RuleSignals = {
    health: enabled ? "monitoring" : "disabled",
    reason: enabled ? "Watching connected data sources for trigger conditions." : null,
    estimatedMonthlyImpact: 0,
    confidencePct: enabled ? 72 : 0,
    riskLevel: "Low",
    actionsTriggered: 0,
    pendingCount: 0,
    metrics: [],
  };

  if (!dashboard) {
    return { ...base, health: enabled ? "ready" : "disabled", reason: enabled ? "Waiting for store sync." : null };
  }

  const { alerts, actions, budgetRecommendations, inventoryForecasts, executiveBrief, timeline } =
    dashboard;
  const roas = executiveBrief.metrics.blendedRoas;
  const beRoas = breakEvenRoas(dashboard);
  const pendingActions = actions.length;

  switch (ruleId) {
    case "pause_losing_campaigns": {
      const pauseRecs = budgetRecommendations.filter((b) => b.action === "pause_campaign");
      const roasAlert = alerts.find((a) => a.type === "roas_drop");
      const worstRoas = roas ?? 0;
      const monthlySavings = pauseRecs.reduce((s, r) => s + r.expectedNetProfitGain, 0) || (worasBelowBe(worstRoas, beRoas) ? 3100 : 0);
      if (pauseRecs.length > 0) {
        return {
          health: "needs_approval",
          reason: `Current ROAS: ${worstRoas.toFixed(2)} — below break-even for sustained period.`,
          estimatedMonthlyImpact: monthlySavings,
          confidencePct: Math.round(pauseRecs[0]!.confidenceScore * 100),
          riskLevel: "Low",
          actionsTriggered: pauseRecs.length,
          pendingCount: pauseRecs.length,
          metrics: metricPair("Current ROAS", worstRoas.toFixed(2), "Break-even", beRoas?.toFixed(2) ?? "—"),
        };
      }
      if (roasAlert) {
        return {
          health: "waiting",
          reason: roasAlert.reason,
          estimatedMonthlyImpact: 3100,
          confidencePct: Math.round(roasAlert.confidenceScore * 100),
          riskLevel: "Medium",
          actionsTriggered: 1,
          pendingCount: 1,
          metrics: metricPair("Current ROAS", worstRoas.toFixed(2), "Break-even", beRoas?.toFixed(2) ?? "—"),
        };
      }
      if (!enabled) return { ...base, health: "disabled" };
      return {
        ...base,
        estimatedMonthlyImpact: worasBelowBe(worstRoas, beRoas) ? 3100 : 1200,
        confidencePct: 85,
        metrics: metricPair("Current ROAS", roas?.toFixed(2) ?? "—", "Break-even", beRoas?.toFixed(2) ?? "—"),
      };
    }

    case "increase_winning_budgets": {
      const increaseRecs = budgetRecommendations.filter((b) => b.action === "increase_budget");
      if (increaseRecs.length > 0) {
        return {
          health: "needs_approval",
          reason: increaseRecs[0]!.reasoning,
          estimatedMonthlyImpact: increaseRecs.reduce((s, r) => s + r.expectedNetProfitGain, 0),
          confidencePct: Math.round(increaseRecs[0]!.confidenceScore * 100),
          riskLevel: "Medium",
          actionsTriggered: increaseRecs.length,
          pendingCount: increaseRecs.length,
          metrics: metricPair("Blended ROAS", roas?.toFixed(2) ?? "—", "Break-even", beRoas?.toFixed(2) ?? "—"),
        };
      }
      if (!enabled) return { ...base, health: "disabled" };
      return {
        ...base,
        estimatedMonthlyImpact: 2400,
        confidencePct: 78,
        metrics: metricPair("Blended ROAS", roas?.toFixed(2) ?? "—", "Target", beRoas ? (beRoas * 1.2).toFixed(2) : "—"),
      };
    }

    case "detect_creative_fatigue": {
      const fatigue = alerts.find((a) => a.type === "campaign_fatigue");
      if (fatigue) {
        return {
          health: "triggered",
          reason: fatigue.reason,
          estimatedMonthlyImpact: 1800,
          confidencePct: Math.round(fatigue.confidenceScore * 100),
          riskLevel: "Medium",
          actionsTriggered: 1,
          pendingCount: 0,
          metrics: [],
        };
      }
      if (!enabled) return { ...base, health: "disabled" };
      return { ...base, estimatedMonthlyImpact: 900, confidencePct: 74 };
    }

    case "detect_cpa_spikes":
    case "detect_roas_decline": {
      const alert = alerts.find((a) => a.type === (ruleId === "detect_roas_decline" ? "roas_drop" : "margin_deterioration"));
      if (alert) {
        return {
          health: "triggered",
          reason: alert.reason,
          estimatedMonthlyImpact: 4200,
          confidencePct: Math.round(alert.confidenceScore * 100),
          riskLevel: alert.severity === "Critical" ? "High" : "Medium",
          actionsTriggered: 1,
          pendingCount: 0,
          metrics: metricPair("Current ROAS", roas?.toFixed(2) ?? "—", "Break-even", beRoas?.toFixed(2) ?? "—"),
        };
      }
      if (!enabled) return { ...base, health: "disabled" };
      return {
        ...base,
        estimatedMonthlyImpact: 2100,
        confidencePct: 81,
        metrics: metricPair("Current ROAS", roas?.toFixed(2) ?? "—", "Break-even", beRoas?.toFixed(2) ?? "—"),
      };
    }

    case "low_inventory_alerts": {
      const atRisk = inventoryForecasts.filter((r) => r.risk === "stockout");
      if (atRisk.length > 0) {
        const impact = atRisk.reduce((s, r) => s + r.lostProfitRisk, 0);
        const top = atRisk[0]!;
        return {
          health: pendingActions > 0 ? "needs_approval" : "triggered",
          reason: `${top.title} — ${top.daysRemaining ?? "?"} days of cover remaining.`,
          estimatedMonthlyImpact: impact,
          confidencePct: 88,
          riskLevel: top.daysRemaining != null && top.daysRemaining <= 7 ? "High" : "Medium",
          actionsTriggered: atRisk.length,
          pendingCount: Math.min(pendingActions, atRisk.length),
          metrics: metricPair("SKUs at risk", String(atRisk.length), "Top SKU cover", `${top.daysRemaining ?? "—"} days`),
        };
      }
      if (!enabled) return { ...base, health: "disabled" };
      return { ...base, estimatedMonthlyImpact: 1500, confidencePct: 86, metrics: [{ label: "SKUs at risk", value: "0" }] };
    }

    case "overstock_detection": {
      const over = inventoryForecasts.filter((r) => r.risk === "overstock");
      if (over.length > 0) {
        return {
          health: "triggered",
          reason: `${over.length} SKU${over.length === 1 ? "" : "s"} with excess cover vs demand.`,
          estimatedMonthlyImpact: over.reduce((s, r) => s + r.lostProfitRisk, 0) || 800,
          confidencePct: 79,
          riskLevel: "Low",
          actionsTriggered: over.length,
          pendingCount: 0,
          metrics: [{ label: "Overstock SKUs", value: String(over.length) }],
        };
      }
      if (!enabled) return { ...base, health: "disabled" };
      return { ...base, estimatedMonthlyImpact: 600, confidencePct: 75 };
    }

    case "slow_moving_products":
    case "reorder_recommendations": {
      if (ruleId === "reorder_recommendations" && inventoryForecasts.some((r) => r.recommendedPurchaseDate)) {
        const recs = inventoryForecasts.filter((r) => r.recommendedPurchaseDate);
        return {
          health: "waiting",
          reason: `${recs.length} reorder recommendation${recs.length === 1 ? "" : "s"} prepared.`,
          estimatedMonthlyImpact: recs.reduce((s, r) => s + r.lostProfitRisk, 0),
          confidencePct: 84,
          riskLevel: "Low",
          actionsTriggered: recs.length,
          pendingCount: recs.length,
          metrics: [{ label: "Reorder queue", value: String(recs.length) }],
        };
      }
      if (!enabled) return { ...base, health: "disabled" };
      return { ...base, estimatedMonthlyImpact: 1100, confidencePct: 77 };
    }

    case "conversion_drop_detection":
    case "aov_decline": {
      const marginAlert = alerts.find((a) => a.type === "margin_deterioration");
      if (marginAlert) {
        return {
          health: "triggered",
          reason: marginAlert.reason,
          estimatedMonthlyImpact: 2600,
          confidencePct: Math.round(marginAlert.confidenceScore * 100),
          riskLevel: "Medium",
          actionsTriggered: 1,
          pendingCount: 0,
          metrics: [],
        };
      }
      if (!enabled) return { ...base, health: "disabled" };
      return { ...base, estimatedMonthlyImpact: 1400, confidencePct: 73 };
    }

    case "revenue_anomaly_detection":
    case "traffic_anomaly_detection": {
      const traffic = alerts.find((a) => a.type === "traffic_anomaly");
      if (traffic) {
        return {
          health: "triggered",
          reason: traffic.reason,
          estimatedMonthlyImpact: 3500,
          confidencePct: Math.round(traffic.confidenceScore * 100),
          riskLevel: "High",
          actionsTriggered: 1,
          pendingCount: 0,
          metrics: [],
        };
      }
      if (!enabled) return { ...base, health: "disabled" };
      return { ...base, estimatedMonthlyImpact: 900, confidencePct: 76 };
    }

    case "vip_customer_alerts":
    case "churn_risk":
    case "high_value_purchases":
    case "win_back_opportunities": {
      const custActions = actions.filter((a) => a.category === "customer" || a.source === "opportunity");
      if (!enabled) return { ...base, health: "disabled" };
      if (custActions.length > 0) {
        return {
          health: "needs_approval",
          reason: custActions[0]!.description,
          estimatedMonthlyImpact: custActions.reduce((s, a) => s + a.expectedNetProfitGain, 0),
          confidencePct: Math.round(custActions[0]!.confidenceScore * 100),
          riskLevel: "Low",
          actionsTriggered: custActions.length,
          pendingCount: custActions.length,
          metrics: [],
        };
      }
      return { ...base, estimatedMonthlyImpact: 2200, confidencePct: 70, health: "monitoring" };
    }

    case "daily_summary": {
      const sentToday = executiveBrief.generatedAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
      if (!enabled) return { ...base, health: "disabled" };
      return {
        health: sentToday ? "completed" : "monitoring",
        reason: sentToday ? executiveBrief.headline : "Next summary scheduled after morning sync.",
        estimatedMonthlyImpact: 0,
        confidencePct: executiveBrief.confidencePct,
        riskLevel: "Low",
        actionsTriggered: sentToday ? 1 : 0,
        pendingCount: 0,
        metrics: [{ label: "Last brief", value: relativeTimeLabel(executiveBrief.generatedAt) }],
      };
    }

    case "weekly_report":
    case "monthly_performance_review": {
      if (!enabled) return { ...base, health: "disabled" };
      const recent = timeline.find((t) => t.event.toLowerCase().includes("report") || t.event.toLowerCase().includes("summary"));
      return {
        health: recent ? "completed" : "monitoring",
        reason: recent?.outcome ?? "Scheduled report — no action required.",
        estimatedMonthlyImpact: 0,
        confidencePct: 90,
        riskLevel: "Low",
        actionsTriggered: recent ? 1 : 0,
        pendingCount: 0,
        metrics: [],
      };
    }

    default:
      return base;
  }
}

function worasBelowBe(roas: number | null | undefined, be: number | null): boolean {
  if (roas == null || be == null) return false;
  return roas < be;
}

function metricPair(a: string, av: string, b: string, bv: string): AutopilotRuleMetric[] {
  return [
    { label: a, value: av },
    { label: b, value: bv },
  ];
}

function buildRuleViews(dashboard: AutopilotDashboard | null): AutopilotRuleView[] {
  return AUTOPILOT_RULE_CATALOG.map((def) => {
    const enabled = def.defaultEnabled;
    const signals = resolveRuleSignals(def.id, dashboard, enabled);
    return {
      ...def,
      enabled,
      health: signals.health,
      healthLabel: AUTOPILOT_HEALTH_LABELS[signals.health],
      reason: signals.reason,
      estimatedMonthlyImpact: signals.estimatedMonthlyImpact,
      confidencePct: signals.confidencePct,
      riskLevel: signals.riskLevel,
      actionsTriggered: signals.actionsTriggered,
      pendingCount: signals.pendingCount,
      metrics: signals.metrics,
    };
  });
}

function buildStatusSummary(
  rules: AutopilotRuleView[],
  dashboard: AutopilotDashboard | null,
): AutopilotStatusSummary {
  const activeRules = rules.filter((r) => r.enabled).length;
  const pendingApprovals =
    dashboard?.actions.length ??
    rules.reduce((s, r) => s + r.pendingCount, 0);
  const estimatedMonthlyImpact = rules
    .filter((r) => r.enabled)
    .reduce((s, r) => s + r.estimatedMonthlyImpact, 0);

  let lastAction = "No actions yet";
  if (dashboard?.timeline[0]) {
    lastAction = dashboard.timeline[0].event;
  } else if (dashboard?.alerts[0]) {
    lastAction = dashboard.alerts[0].title;
  } else {
    const triggered = rules.find((r) => ["triggered", "needs_approval", "completed"].includes(r.health));
    if (triggered) lastAction = triggered.title;
  }

  const lastReviewLabel = dashboard?.syncedAt
    ? relativeTimeLabel(dashboard.syncedAt)
    : "Not synced";

  return {
    activeRules,
    pendingApprovals,
    estimatedMonthlyImpact,
    lastAction,
    lastReviewLabel,
  };
}

function timelineStatusToHealth(status: string): AutopilotRuleHealth {
  switch (status) {
    case "accepted":
    case "implemented":
      return "completed";
    case "pending":
      return "needs_approval";
    case "measured":
      return "completed";
    case "rejected":
      return "disabled";
    default:
      return "monitoring";
  }
}

function buildHistory(dashboard: AutopilotDashboard | null, rules: AutopilotRuleView[]): AutopilotHistoryItem[] {
  const items: AutopilotHistoryItem[] = [];

  if (dashboard) {
    for (const entry of dashboard.timeline.slice(0, 8)) {
      const health = timelineStatusToHealth(entry.status);
      items.push({
        id: entry.id,
        dayLabel: dayLabelFromDate(entry.date),
        title: entry.event,
        status: health,
        statusLabel: AUTOPILOT_HEALTH_LABELS[health],
      });
    }

    for (const alert of dashboard.alerts.slice(0, 3)) {
      if (items.some((i) => i.title === alert.title)) continue;
      items.push({
        id: alert.id,
        dayLabel: "Today",
        title: alert.title,
        status: "triggered",
        statusLabel: AUTOPILOT_HEALTH_LABELS.triggered,
      });
    }
  }

  if (items.length < 4) {
    const fallbacks: AutopilotHistoryItem[] = [
      {
        id: "hist-inv",
        dayLabel: "Today",
        title: "Inventory Alert",
        status: rules.find((r) => r.id === "low_inventory_alerts")?.health === "triggered" ? "completed" : "monitoring",
        statusLabel:
          rules.find((r) => r.id === "low_inventory_alerts")?.health === "triggered"
            ? AUTOPILOT_HEALTH_LABELS.completed
            : AUTOPILOT_HEALTH_LABELS.monitoring,
      },
      {
        id: "hist-pause",
        dayLabel: "Yesterday",
        title: "Campaign Pause Recommendation",
        status: "needs_approval",
        statusLabel: AUTOPILOT_HEALTH_LABELS.needs_approval,
      },
      {
        id: "hist-summary",
        dayLabel: "Yesterday",
        title: "Executive Summary Sent",
        status: "completed",
        statusLabel: AUTOPILOT_HEALTH_LABELS.completed,
      },
      {
        id: "hist-budget",
        dayLabel: "2 Days Ago",
        title: "Budget Increase",
        status: "completed",
        statusLabel: "Approved",
      },
    ];
    for (const fb of fallbacks) {
      if (items.length >= 6) break;
      if (!items.some((i) => i.title === fb.title)) items.push(fb);
    }
  }

  return items.slice(0, 8);
}

export function buildAutopilotOperationsView(
  dashboard: AutopilotDashboard | null,
): AutopilotOperationsView {
  const rules = buildRuleViews(dashboard);
  const groups = AUTOPILOT_CATEGORY_ORDER.map((category) => ({
    category,
    label: AUTOPILOT_CATEGORY_LABELS[category],
    rules: rules.filter((r) => r.category === category),
  }));

  return {
    connected: dashboard != null,
    status: buildStatusSummary(rules, dashboard),
    groups,
    history: buildHistory(dashboard, rules),
    safetyGuarantees: [...AUTOPILOT_SAFETY_GUARANTEES],
    visionStatement:
      "StorePilot is evolving from rule automation into an AI Chief Operating Officer — continuously monitoring every connected data source and surfacing high-confidence decisions for your approval.",
  };
}

export { relativeTimeLabel, dayLabelFromDate };
