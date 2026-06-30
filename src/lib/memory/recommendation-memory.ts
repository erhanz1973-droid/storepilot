import {
  applyFatigueToPriorityScore,
  computeFatigueAdjustment,
  type FatigueRecord,
} from "@/lib/learning/fatigue";
import type { OpportunityHistoryRecord } from "@/lib/opportunities/history";
import type { Recommendation } from "@/lib/types";
import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";

export type RecommendationMemoryStatus =
  | "detected"
  | "viewed"
  | "accepted"
  | "ignored"
  | "resolved"
  | "expired"
  | "repeated";

export type RecommendationMemoryRecord = {
  key: string;
  title: string;
  status: RecommendationMemoryStatus;
  ignoreCount: number;
  lastSeenAt?: string;
  category?: string;
};

export function buildMemoryIndex(input: {
  opportunityHistory: OpportunityHistoryRecord[];
  recommendations: Recommendation[];
}): Map<string, RecommendationMemoryRecord> {
  const index = new Map<string, RecommendationMemoryRecord>();

  for (const row of input.opportunityHistory) {
    index.set(row.opportunityKey, {
      key: row.opportunityKey,
      title: row.title,
      status: mapHistoryStatus(row.status, row.ignoreCount),
      ignoreCount: row.ignoreCount,
      lastSeenAt: row.detectedAt,
      category: row.category,
    });
  }

  for (const rec of input.recommendations) {
    const key = `rec:${rec.id}`;
    const status = rec.status ?? "pending";
    index.set(key, {
      key,
      title: rec.title,
      status:
        status === "ignored"
          ? "ignored"
          : status === "approved" || status === "implemented"
            ? "accepted"
            : status === "completed" || status === "measured"
              ? "resolved"
              : status === "snoozed"
                ? "viewed"
                : "detected",
      ignoreCount: status === "ignored" ? 1 : 0,
      lastSeenAt: rec.createdAt,
      category: rec.category,
    });
  }

  return index;
}

function mapHistoryStatus(
  status: OpportunityHistoryRecord["status"],
  ignoreCount: number,
): RecommendationMemoryStatus {
  if (ignoreCount >= 2) return "repeated";
  switch (status) {
    case "ignored":
      return "ignored";
    case "resolved":
      return "resolved";
    case "expired":
      return "expired";
    case "viewed":
      return "viewed";
    default:
      return "detected";
  }
}

export function applyMemoryToOpportunity(
  opp: CommerceOpportunity,
  memory: Map<string, RecommendationMemoryRecord>,
): CommerceOpportunity {
  const mem = memory.get(opp.id) ?? memory.get(`opp:${opp.category}:${opp.title.slice(0, 40)}`);
  if (!mem) return opp;

  const fatigueRecord: FatigueRecord = {
    dedupeKey: mem.key,
    category: "campaign_review",
    ignoreCount: mem.ignoreCount,
    lastIgnoredAt: mem.status === "ignored" ? mem.lastSeenAt : undefined,
    positiveOutcomes: mem.status === "resolved" ? 1 : 0,
  };
  const adjustment = computeFatigueAdjustment(fatigueRecord);
  if (adjustment.suppress) {
    return { ...opp, priorityScore: 0, confidence: Math.round(opp.confidence * 0.85) };
  }

  return {
    ...opp,
    priorityScore: applyFatigueToPriorityScore(opp.priorityScore, adjustment),
    confidence: Math.round(opp.confidence * adjustment.confidenceMultiplier),
  };
}

export function summarizeMemory(memory: Map<string, RecommendationMemoryRecord>) {
  const records = [...memory.values()];
  return {
    total: records.length,
    ignored: records.filter((r) => r.status === "ignored" || r.status === "repeated").length,
    accepted: records.filter((r) => r.status === "accepted").length,
    resolved: records.filter((r) => r.status === "resolved").length,
    expired: records.filter((r) => r.status === "expired").length,
    repeated: records.filter((r) => r.status === "repeated").length,
  };
}
