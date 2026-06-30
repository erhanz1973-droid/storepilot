import type {
  ProfitConfidence,
  ProfitInputId,
  ProfitMetricMeta,
  ProfitStatus,
} from "@/lib/profit/types";
import { PROFIT_INPUT_LABELS } from "@/lib/profit/types";

export function buildProfitMetricMeta(
  value: number | null,
  confidence: ProfitConfidence,
): ProfitMetricMeta {
  return {
    value: confidence.status === "unavailable" ? null : value,
    status: confidence.status,
    confidence: confidence.scorePct,
    missingInputs: confidence.missingInputs,
  };
}

export function profitStatusLabel(status: ProfitStatus): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "estimated":
      return "Estimated";
    case "unavailable":
      return "Not Available";
  }
}

export function profitKpiLabel(base: string, meta: ProfitMetricMeta): string {
  if (meta.status === "unavailable") return "Profit";
  if (meta.status === "estimated") return `Est. ${base}`;
  return base;
}

export function formatMissingInputsList(ids: ProfitInputId[]): string {
  if (ids.length === 0) return "";
  return ids.map((id) => PROFIT_INPUT_LABELS[id]).join(", ");
}

export function profitAiDisclaimer(confidence: ProfitConfidence): string | null {
  if (confidence.status === "verified") return null;
  if (confidence.status === "unavailable") {
    return "Profit cannot be calculated until required cost data is configured.";
  }
  const missing = formatMissingInputsList(confidence.missingInputs);
  if (!missing) return confidence.notice;
  return `Estimated profit excludes or approximates: ${missing}. ${confidence.notice ?? ""}`.trim();
}
