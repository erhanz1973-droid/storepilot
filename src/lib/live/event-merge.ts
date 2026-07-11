import type { AIEvent, AIEventSeverity } from "@/lib/monitoring/types";

export type LiveEventPriority = "critical" | "warning" | "positive" | "info";

export type MergedLiveEvent = {
  id: string;
  priority: LiveEventPriority;
  title: string;
  subtitle?: string;
  description: string;
  detectedLabel: string;
  confidencePct: number;
  recommendedActions: string[];
  evidence: { label: string; value: string }[];
  viewHref?: string;
  sourceEventIds: string[];
};

const SEVERITY_TO_PRIORITY: Record<AIEventSeverity, LiveEventPriority> = {
  critical: "critical",
  warning: "warning",
  info: "info",
};

function normalizeMergeKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\d+(\.\d+)?%?/g, "")
    .replace(/\$[\d,]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCampaignName(title: string): string | null {
  const onMatch = title.match(/\bon\s+(.+)$/i);
  if (onMatch) return onMatch[1]!.trim();
  const colonMatch = title.match(/^[^:]+:\s*(.+)$/);
  if (colonMatch && title.toLowerCase().includes("campaign")) return colonMatch[1]!.trim();
  if (title.toLowerCase().includes("google search")) return "Google Search";
  return null;
}

function isPositiveEvent(event: AIEvent): boolean {
  if (event.title.toLowerCase().includes("increased") && !event.title.toLowerCase().includes("cpm")) {
    return true;
  }
  if (event.type === "opportunity_detected") return true;
  return false;
}

function priorityForEvent(event: AIEvent): LiveEventPriority {
  if (isPositiveEvent(event) && event.severity === "info") return "positive";
  return SEVERITY_TO_PRIORITY[event.severity];
}

function relativeDetectedLabel(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
}

function parseRecommendedActions(recommendation: string): string[] {
  return recommendation
    .split(/(?:\.|;|\band\b)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 3);
}

export function mergeLiveEvents(events: AIEvent[]): MergedLiveEvent[] {
  const groups = new Map<string, AIEvent[]>();

  for (const event of events) {
    const campaign = extractCampaignName(event.title);
    const key = campaign
      ? `campaign:${campaign.toLowerCase()}`
      : normalizeMergeKey(event.title);
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  const merged: MergedLiveEvent[] = [];

  for (const [, group] of groups) {
    const primary = group.reduce((best, e) => {
      const rank = { critical: 0, warning: 1, info: 2 };
      if (rank[e.severity] < rank[best.severity]) return e;
      if (e.confidencePct > best.confidencePct) return e;
      return best;
    });

    const campaign = extractCampaignName(primary.title);
    const roasEvidence = primary.evidence.find((e) => /roas/i.test(e.label));

    let title = primary.title;
    if (campaign && group.length > 1) {
      title = campaign;
    } else if (campaign && roasEvidence) {
      title = `${campaign} — ROAS below target (${roasEvidence.value})`;
    }

    const priority = group.some((e) => e.severity === "critical")
      ? "critical"
      : group.some((e) => e.severity === "warning")
        ? "warning"
        : priorityForEvent(primary);

    merged.push({
      id: `merged-${primary.id}`,
      priority,
      title,
      subtitle: campaign && group.length === 1 ? undefined : primary.title,
      description: primary.description,
      detectedLabel: relativeDetectedLabel(
        group.reduce((latest, e) => (e.createdAt > latest ? e.createdAt : latest), primary.createdAt),
      ),
      confidencePct: Math.round(
        group.reduce((s, e) => s + e.confidencePct, 0) / group.length,
      ),
      recommendedActions: parseRecommendedActions(primary.recommendation),
      evidence: primary.evidence.slice(0, 4),
      viewHref: primary.type === "campaign_issue" || primary.type === "roas_change"
        ? "/analytics/marketing"
        : primary.type === "inventory_risk"
          ? "/analytics/inventory"
          : "/decisions",
      sourceEventIds: group.map((e) => e.id),
    });
  }

  const priorityRank: Record<LiveEventPriority, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    positive: 3,
  };

  return merged.sort(
    (a, b) =>
      priorityRank[a.priority] - priorityRank[b.priority] ||
      b.confidencePct - a.confidencePct,
  );
}
