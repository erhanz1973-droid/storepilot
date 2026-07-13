import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { ExecutiveMemoryItem } from "@/lib/analytics/executive-ai-behavior";

export type ExecutiveMemoryEventType =
  | "approved"
  | "rejected"
  | "executed"
  | "measured"
  | "milestone"
  | "learned";

export type ExecutiveMemoryEvent = {
  id: string;
  storeId: string;
  eventType: ExecutiveMemoryEventType;
  title: string;
  contextMessage: string | null;
  recommendationId: string | null;
  estimatedImpactMonthly: number | null;
  measuredImpactMonthly: number | null;
  outcomeRating: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

const memoryEvents: ExecutiveMemoryEvent[] = [];

function dayLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export async function recordExecutiveMemoryEvent(input: {
  storeId: string;
  eventType: ExecutiveMemoryEventType;
  title: string;
  contextMessage?: string;
  recommendationId?: string | null;
  estimatedImpactMonthly?: number | null;
  measuredImpactMonthly?: number | null;
  outcomeRating?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}): Promise<ExecutiveMemoryEvent> {
  const row: ExecutiveMemoryEvent = {
    id: crypto.randomUUID(),
    storeId: input.storeId,
    eventType: input.eventType,
    title: input.title.trim().slice(0, 240),
    contextMessage: input.contextMessage?.trim() || null,
    recommendationId: input.recommendationId ?? null,
    estimatedImpactMonthly: input.estimatedImpactMonthly ?? null,
    measuredImpactMonthly: input.measuredImpactMonthly ?? null,
    outcomeRating: input.outcomeRating ?? null,
    metadata: input.metadata ?? {},
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("executive_memory_events").insert({
      id: row.id,
      store_id: row.storeId,
      event_type: row.eventType,
      title: row.title,
      context_message: row.contextMessage,
      recommendation_id: row.recommendationId,
      estimated_impact_monthly: row.estimatedImpactMonthly,
      measured_impact_monthly: row.measuredImpactMonthly,
      outcome_rating: row.outcomeRating,
      metadata: row.metadata,
      occurred_at: row.occurredAt,
      created_at: row.createdAt,
    });
    if (error) {
      // Table may not be migrated yet — keep memory fallback so product doesn't break.
      console.warn("[executive-memory] persist failed:", error.message);
      memoryEvents.push(row);
      return row;
    }
    return row;
  }

  memoryEvents.push(row);
  return row;
}

export async function listExecutiveMemoryEvents(
  storeId: string,
  limit = 20,
): Promise<ExecutiveMemoryEvent[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("executive_memory_events")
      .select("*")
      .eq("store_id", storeId)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[executive-memory] list failed:", error.message);
      return memoryEvents
        .filter((e) => e.storeId === storeId)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, limit);
    }
    return (data ?? []).map((r) => ({
      id: r.id as string,
      storeId: r.store_id as string,
      eventType: r.event_type as ExecutiveMemoryEventType,
      title: r.title as string,
      contextMessage: (r.context_message as string | null) ?? null,
      recommendationId: (r.recommendation_id as string | null) ?? null,
      estimatedImpactMonthly:
        r.estimated_impact_monthly != null ? Number(r.estimated_impact_monthly) : null,
      measuredImpactMonthly:
        r.measured_impact_monthly != null ? Number(r.measured_impact_monthly) : null,
      outcomeRating: (r.outcome_rating as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      occurredAt: r.occurred_at as string,
      createdAt: r.created_at as string,
    }));
  }

  return memoryEvents
    .filter((e) => e.storeId === storeId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}

/** Map persisted events → Executive Memory UI items (measured impact preferred). */
export function executiveMemoryEventsToItems(
  events: ExecutiveMemoryEvent[],
): ExecutiveMemoryItem[] {
  return events.slice(0, 8).map((event) => {
    const measured = event.measuredImpactMonthly;
    const estimated = event.estimatedImpactMonthly;
    const monthly = measured ?? estimated ?? 0;
    const daily = Math.max(0, Math.round(Math.abs(monthly) / 30));
    const isPositive =
      event.eventType === "measured"
        ? (measured ?? 0) >= 0 && event.outcomeRating !== "needs_improvement"
        : event.eventType === "approved" ||
          event.eventType === "executed" ||
          event.eventType === "learned" ||
          event.eventType === "milestone";

    const status: ExecutiveMemoryItem["status"] =
      event.eventType === "rejected"
        ? "ignored"
        : event.eventType === "measured" || event.eventType === "milestone"
          ? "completed"
          : event.eventType === "approved" || event.eventType === "executed"
            ? "completed"
            : "pending";

    const statusLabel =
      event.eventType === "measured"
        ? measured != null
          ? `Measured ${dayLabel(event.occurredAt)} — $${Math.round(Math.abs(measured)).toLocaleString()}/mo`
          : `Measured ${dayLabel(event.occurredAt)}`
        : event.eventType === "approved"
          ? `Approved ${dayLabel(event.occurredAt)}`
          : event.eventType === "rejected"
            ? `Rejected ${dayLabel(event.occurredAt)}`
            : event.eventType === "executed"
              ? `Executed ${dayLabel(event.occurredAt)}`
              : event.eventType === "learned"
                ? `AI learned ${dayLabel(event.occurredAt)}`
                : `Update ${dayLabel(event.occurredAt)}`;

    return {
      id: event.id,
      title: event.title,
      recommendedAt: event.occurredAt,
      recommendedLabel: dayLabel(event.occurredAt),
      status,
      statusLabel,
      dailyImpact: daily || 1,
      impactLabel:
        measured != null
          ? `${isPositive ? "+" : "-"}$${daily.toLocaleString()}/day measured`
          : estimated != null
            ? `${isPositive ? "+" : "-"}$${daily.toLocaleString()}/day estimated`
            : event.eventType === "learned"
              ? "Learning update"
              : "Impact pending",
      impactPrefix: isPositive ? "+" : "-",
      contextMessage:
        event.contextMessage ??
        (event.eventType === "measured"
          ? "AI measured the business outcome of this recommendation."
          : event.eventType === "learned"
            ? "AI updated future recommendations from merchant feedback / outcomes."
            : "Tracked in Executive Memory."),
      actionLabel:
        status === "pending" || event.eventType === "rejected"
          ? undefined
          : event.eventType === "measured"
            ? undefined
            : undefined,
    };
  });
}

/** @internal */
export function __clearExecutiveMemoryForTests(): void {
  memoryEvents.length = 0;
}
