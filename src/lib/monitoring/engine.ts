import {
  runCampaignMonitor,
  runCustomerMonitor,
  runInventoryMonitor,
  runMarketingEfficiencyMonitor,
  runOpportunityMonitor,
  runPredictionMonitor,
  runRevenueMonitor,
  runRoasMonitor,
} from "./monitors";
import type { AIEvent, MonitorContext } from "./types";

const SEVERITY_RANK: Record<AIEvent["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function runContinuousMonitors(ctx: MonitorContext): AIEvent[] {
  const events: AIEvent[] = [
    ...runRevenueMonitor(ctx),
    ...runRoasMonitor(ctx),
    ...runInventoryMonitor(ctx),
    ...runCampaignMonitor(ctx),
    ...runCustomerMonitor(ctx),
    ...runMarketingEfficiencyMonitor(ctx),
    ...runPredictionMonitor(ctx),
    ...runOpportunityMonitor(ctx),
  ];

  const seen = new Set<string>();
  return events
    .filter((e) => {
      if (seen.has(e.title)) return false;
      seen.add(e.title);
      return true;
    })
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        b.confidencePct - a.confidencePct,
    );
}

export function aiEventsToActivityFeed(events: AIEvent[]): import("@/lib/timeline/activity-feed").ActivityFeedEntry[] {
  const now = new Date();
  return events.map((e, i) => ({
    id: e.id,
    timestamp: e.createdAt,
    relativeLabel: i === 0 ? "Now" : i < 3 ? "Recently" : "Today",
    event: e.title,
    category:
      e.type === "roas_change"
        ? "roas"
        : e.type === "inventory_risk"
          ? "inventory"
          : e.type === "campaign_issue"
            ? "campaign"
            : e.type === "opportunity_detected"
              ? "opportunity"
              : "alert",
    severity:
      e.severity === "critical"
        ? "critical"
        : e.severity === "warning"
          ? "warning"
          : "info",
    detail: `${e.description} · ${e.recommendation} · Confidence ${e.confidencePct}%`,
  }));
}
