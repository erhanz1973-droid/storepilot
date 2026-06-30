import type { OutcomeRecord } from "@/lib/learning/outcome-types";
import { buildOutcomeDisplayMetrics } from "@/lib/learning/metrics";
import { OutcomeCard } from "./OutcomeCard";

export function OutcomeRecordsList({ records }: { records: OutcomeRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        No outcomes tracked yet. Approve and execute a recommendation to start measuring business
        impact.
      </p>
    );
  }

  return (
    <div className="stack">
      {records.map((record) => {
        const displayMetrics =
          record.measureStatus === "completed" && record.kpiDeltas
            ? buildOutcomeDisplayMetrics(
                record.actionType,
                record.kpiDeltas,
                record.actualMonthlyImpact ?? 0,
              )
            : [];

        return (
          <OutcomeCard
            key={record.id}
            title={record.title}
            outcome={{
              measureStatus: record.measureStatus,
              measureDueAt: record.measureDueAt,
              measuredAt: record.measuredAt,
              measurementWindowDays: record.measurementWindowDays,
              outcomeRating: record.outcomeRating ?? undefined,
              outcomeSummary: record.outcomeSummary,
              aiVerdict: record.aiVerdict,
              confidenceLabel: record.confidenceLabel,
              predictionAccuracy: record.predictionAccuracy,
              displayMetrics,
            }}
          />
        );
      })}
    </div>
  );
}
