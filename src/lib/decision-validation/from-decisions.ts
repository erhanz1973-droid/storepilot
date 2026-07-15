import type { DecisionItem } from "@/lib/decisions/center";
import { buildDecisionValidationReport } from "./report";
import type { DecisionValidationReport } from "./types";

/**
 * Map measured Decision Center items into DecisionValidationReports for rollups.
 */
export function validationReportsFromDecisionItems(
  decisions: DecisionItem[],
): DecisionValidationReport[] {
  const reports: DecisionValidationReport[] = [];

  for (const d of decisions) {
    const outcome = d.outcome;
    if (!outcome) continue;
    if (outcome.measureStatus !== "measured" && outcome.predictionAccuracy == null) continue;

    const accepted =
      d.status === "accepted" ||
      d.status === "resolved" ||
      (d.outcome?.measureStatus === "measured" && d.status !== "ignored");

    // Prefer parsed profit from display metrics when available
    const profitMetric = outcome.displayMetrics.find((m) =>
      /profit|net|impact|\$/i.test(m.label),
    );
    const actualFromMetric = profitMetric
      ? Number(String(profitMetric.value).replace(/[^0-9.-]/g, ""))
      : null;

    const predictedNet =
      typeof d.estimatedImpactLabel === "string"
        ? parseApproxMonthly(d.estimatedImpactLabel)
        : null;

    // If we only have predictionAccuracy %, reconstruct a plausible actual
    // when actual dollars missing — prefer not to invent; keep actual null.
    const actualNet =
      actualFromMetric != null && Number.isFinite(actualFromMetric)
        ? actualFromMetric
        : null;

    reports.push(
      buildDecisionValidationReport({
        decisionId: d.id,
        title: d.summary,
        recommendationAccepted: accepted,
        predicted: {
          netProfitMonthly: predictedNet,
          businessRecoveryMonthly: null,
          confidencePct: d.confidencePct,
        },
        actual:
          outcome.measuredAt || actualNet != null || outcome.predictionAccuracy != null
            ? {
                netProfitDeltaMonthly: actualNet,
                measuredAt: outcome.measuredAt ?? outcome.measureDueAt,
                measurementWindowDays: outcome.measurementWindowDays,
              }
            : null,
      }),
    );
  }

  return reports;
}

function parseApproxMonthly(label: string): number | null {
  const profit = label.match(/\$\s*([\d,]+(?:\.\d+)?)\s*\/\s*mo[^\)]*profit/i);
  if (profit) return Number(profit[1].replace(/,/g, ""));
  const any = label.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (any) return Number(any[1].replace(/,/g, ""));
  return null;
}
