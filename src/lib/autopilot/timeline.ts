import type { Recommendation } from "@/lib/types";
import type { TimelineEntry } from "./types";

export function buildDecisionTimeline(
  recommendations: Recommendation[],
  storeSyncedAt: string,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const now = new Date();

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayLabel = days[d.getDay()];
    const date = d.toISOString().slice(0, 10);

    const dayRecs = recommendations.filter((r) => {
      const created = r.createdAt.slice(0, 10);
      const measured = r.measuredAt?.slice(0, 10);
      const completed = r.completedAt?.slice(0, 10);
      return created === date || measured === date || completed === date;
    });

    for (const rec of dayRecs.slice(0, 2)) {
      const status = rec.status ?? "pending";
      let eventStatus: TimelineEntry["status"] = "pending";
      if (status === "approved" || status === "implemented") eventStatus = "accepted";
      if (status === "ignored") eventStatus = "rejected";
      if (status === "measured") eventStatus = "measured";

      entries.push({
        id: `tl-${rec.id}-${date}`,
        date,
        dayLabel,
        event: rec.title.replace(/^[^:]+:\s*/, ""),
        outcome:
          rec.outcomeSummary ??
          (rec.predictionAccuracy != null
            ? `Prediction accuracy ${rec.predictionAccuracy}%`
            : undefined),
        status: eventStatus,
        impactPct:
          rec.predictionAccuracy != null && rec.predictionAccuracy > 70
            ? Math.round(rec.predictionAccuracy / 10)
            : undefined,
      });
    }
  }

  if (entries.length === 0) {
    entries.push({
      id: "tl-sync",
      date: storeSyncedAt.slice(0, 10),
      dayLabel: days[new Date(storeSyncedAt).getDay()],
      event: "Store analyzed — recommendations generated",
      status: "info",
    });
  }

  const measured = recommendations
    .filter((r) => r.status === "measured" && r.outcomeSummary)
    .slice(0, 3);

  for (const rec of measured) {
    if (entries.some((e) => e.id.includes(rec.id))) continue;
    entries.push({
      id: `tl-outcome-${rec.id}`,
      date: rec.measuredAt?.slice(0, 10) ?? rec.createdAt.slice(0, 10),
      dayLabel: days[new Date(rec.measuredAt ?? rec.createdAt).getDay()],
      event: rec.title.replace(/^[^:]+:\s*/, ""),
      outcome: rec.outcomeSummary,
      status: "measured",
      impactPct: rec.predictionAccuracy ?? undefined,
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
}
