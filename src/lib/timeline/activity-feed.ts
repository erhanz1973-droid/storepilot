import type { AutopilotAlert } from "@/lib/autopilot/types";
import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";
import type { Recommendation } from "@/lib/types";

export type ActivityFeedEntry = {
  id: string;
  timestamp: string;
  relativeLabel: string;
  event: string;
  category:
    | "roas"
    | "inventory"
    | "campaign"
    | "opportunity"
    | "recommendation"
    | "alert"
    | "sync";
  severity?: "info" | "warning" | "critical" | "success";
  detail?: string;
};

function relativeLabel(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return "Now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function offsetTimestamp(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60000).toISOString();
}

export function buildActivityFeed(input: {
  syncedAt: string;
  opportunities: CommerceOpportunity[];
  activeRecommendations: Recommendation[];
  alerts: AutopilotAlert[];
  roasChange?: { direction: "up" | "down"; value: number } | null;
}): ActivityFeedEntry[] {
  const now = new Date();
  const entries: ActivityFeedEntry[] = [];

  if (input.roasChange) {
    entries.push({
      id: "feed-roas",
      timestamp: offsetTimestamp(120),
      relativeLabel: relativeLabel(offsetTimestamp(120), now),
      event:
        input.roasChange.direction === "up"
          ? `Google ROAS increased to ${input.roasChange.value.toFixed(2)}.`
          : `ROAS decreased to ${input.roasChange.value.toFixed(2)}.`,
      category: "roas",
      severity: input.roasChange.direction === "up" ? "success" : "warning",
    });
  }

  for (const alert of input.alerts.slice(0, 4)) {
    const mins = alert.type === "inventory_risk" ? 120 : alert.type === "campaign_fatigue" ? 30 : 180;
    const ts = offsetTimestamp(mins);
    entries.push({
      id: `feed-alert-${alert.id}`,
      timestamp: ts,
      relativeLabel: relativeLabel(ts, now),
      event: alert.title,
      category: alert.type.includes("inventory") ? "inventory" : alert.type.includes("campaign") ? "campaign" : "alert",
      severity: alert.severity === "Critical" ? "critical" : "warning",
      detail: alert.reason,
    });
  }

  for (const rec of input.activeRecommendations
    .filter((r) => r.category === "campaign_review")
    .slice(0, 3)) {
    const ts = rec.createdAt;
    entries.push({
      id: `feed-rec-${rec.id}`,
      timestamp: ts,
      relativeLabel: relativeLabel(ts, now),
      event: rec.title.replace(/^[^:]+:\s*/, ""),
      category: "campaign",
      severity: rec.severity === "critical" ? "critical" : "warning",
      detail: rec.reason.slice(0, 120),
    });
  }

  const newOpps = input.opportunities.filter((o) => o.severity === "critical" || o.severity === "high");
  if (newOpps.length > 0) {
    entries.push({
      id: "feed-new-opps",
      timestamp: input.syncedAt,
      relativeLabel: "Now",
      event: `${newOpps.length} new opportunit${newOpps.length === 1 ? "y" : "ies"} found.`,
      category: "opportunity",
      severity: "info",
    });
  }

  for (const opp of input.opportunities.slice(0, 3)) {
    entries.push({
      id: `feed-opp-${opp.id}`,
      timestamp: opp.createdAt,
      relativeLabel: relativeLabel(opp.createdAt, now),
      event: opp.title,
      category: "opportunity",
      severity: opp.severity === "critical" ? "critical" : "info",
      detail: opp.recommendation,
    });
  }

  entries.push({
    id: "feed-sync",
    timestamp: input.syncedAt,
    relativeLabel: relativeLabel(input.syncedAt, now),
    event: "Store analyzed — insights updated.",
    category: "sync",
    severity: "info",
  });

  return entries
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);
}
