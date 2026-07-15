import { classifyDiscrepancy } from "../integrity/external-crosscheck";
import {
  DEFAULT_ABS_EPSILON,
  DEFAULT_MAX_FRESHNESS_HOURS,
  DEFAULT_REALITY_TOLERANCE,
  isFresh,
  statusIsTrusted,
} from "./freshness";
import type {
  RealityKpiResult,
  RealitySourceObservation,
  RealityValidationReport,
  StorePilotKpiSnapshot,
  ValidationStatus,
} from "./types";
import { buildFinancialTrustScore } from "./trust-score";
import { buildRecommendationGate } from "./recommendation-gate";

export type ReconcileRealityOpts = {
  merchantId?: string;
  window?: string;
  generatedAt?: string;
  nowMs?: number;
  maxFreshnessHours?: number;
  defaultRelTolerance?: number;
};

function emptyStatusCounts(): Record<ValidationStatus, number> {
  return {
    verified: 0,
    within_tolerance: 0,
    needs_investigation: 0,
    missing_source: 0,
    cannot_validate: 0,
  };
}

function resolveStatus(input: {
  storepilot: number | null;
  observation: RealitySourceObservation | undefined;
  nowMs: number;
  maxFreshnessHours: number;
  defaultRelTolerance: number;
  lastSyncedAt?: string | null;
}): Pick<
  RealityKpiResult,
  | "status"
  | "reason"
  | "discrepancyCategory"
  | "differenceAbs"
  | "differencePct"
  | "sourceValue"
  | "source"
  | "sourceObservedAt"
  | "trusted"
> {
  const { storepilot, observation, nowMs, maxFreshnessHours, defaultRelTolerance, lastSyncedAt } =
    input;

  if (storepilot == null || !Number.isFinite(storepilot)) {
    return {
      status: "missing_source",
      reason:
        "Merchant data for this KPI is not available in StorePilot (e.g. COGS not provided).",
      differenceAbs: null,
      differencePct: null,
      sourceValue: observation?.value ?? null,
      source: observation?.source ?? null,
      sourceObservedAt: observation?.observedAt ?? null,
      trusted: false,
    };
  }

  if (!observation) {
    return {
      status: "missing_source",
      reason: "No platform observation available for this KPI.",
      differenceAbs: null,
      differencePct: null,
      sourceValue: null,
      source: null,
      sourceObservedAt: null,
      trusted: false,
    };
  }

  if (observation.value == null || !Number.isFinite(observation.value)) {
    return {
      status: "missing_source",
      reason:
        observation.explanation ??
        `Source ${observation.source} did not return a value.`,
      differenceAbs: null,
      differencePct: null,
      sourceValue: null,
      source: observation.source,
      sourceObservedAt: observation.observedAt,
      trusted: false,
    };
  }

  const tol = observation.relTolerance ?? defaultRelTolerance;
  const classified = classifyDiscrepancy({
    metricId: observation.kpiId,
    storepilot,
    external: observation.value,
    externalSource: observation.source,
    knownCause: observation.knownCause,
    explanation: observation.explanation,
    relTolerance: tol,
  });

  const abs = Math.abs(storepilot - observation.value);
  const pct =
    observation.value === 0
      ? abs === 0
        ? 0
        : 1
      : abs / Math.abs(observation.value);

  let status: ValidationStatus;
  let reason: string;

  if (abs <= DEFAULT_ABS_EPSILON || classified.category === "exact_match") {
    status = "verified";
    reason = "StorePilot matches source platform.";
  } else if (pct <= tol) {
    status = "within_tolerance";
    reason =
      observation.explanation ??
      classified.explanation ??
      `Difference ${(pct * 100).toFixed(2)}% within ${(tol * 100).toFixed(2)}% tolerance.`;
  } else if (
    observation.knownCause &&
    observation.knownCause !== "unexplained" &&
    pct <= Math.max(tol * 5, 0.05)
  ) {
    // Explained platform gaps (timezone, attribution window) up to 5%
    status = "within_tolerance";
    reason =
      observation.explanation ??
      `Difference ${(pct * 100).toFixed(2)}% explained by ${observation.knownCause}.`;
  } else {
    status = "needs_investigation";
    reason =
      observation.explanation ??
      classified.explanation ??
      `Difference ${(pct * 100).toFixed(2)}% exceeds tolerance.`;
  }

  const fresh = isFresh(lastSyncedAt ?? observation.observedAt, maxFreshnessHours, nowMs);
  if (!fresh && statusIsTrusted(status)) {
    reason = `${reason} Data may be stale (sync older than ${maxFreshnessHours}h).`;
  }

  return {
    status,
    reason,
    discrepancyCategory: classified.category,
    differenceAbs: abs,
    differencePct: pct,
    sourceValue: observation.value,
    source: observation.source,
    sourceObservedAt: observation.observedAt,
    trusted: statusIsTrusted(status) && fresh,
  };
}

/**
 * Build a full RealityValidationReport from StorePilot KPI snapshot + platform observations.
 */
export function buildRealityValidationReport(
  storepilotKpis: StorePilotKpiSnapshot[],
  observations: RealitySourceObservation[],
  opts: ReconcileRealityOpts = {},
): RealityValidationReport {
  const nowMs = opts.nowMs ?? Date.now();
  const generatedAt = opts.generatedAt ?? new Date(nowMs).toISOString();
  const maxFreshnessHours = opts.maxFreshnessHours ?? DEFAULT_MAX_FRESHNESS_HOURS;
  const defaultRelTolerance = opts.defaultRelTolerance ?? DEFAULT_REALITY_TOLERANCE;
  const byId = new Map(observations.map((o) => [o.kpiId, o]));

  const results: RealityKpiResult[] = storepilotKpis.map((kpi) => {
    const resolved = resolveStatus({
      storepilot: kpi.value,
      observation: byId.get(kpi.kpiId),
      nowMs,
      maxFreshnessHours,
      defaultRelTolerance,
      lastSyncedAt: kpi.lastSyncedAt,
    });

    return {
      kpiId: kpi.kpiId,
      label: kpi.label,
      storepilotValue: kpi.value,
      lastSyncedAt: kpi.lastSyncedAt ?? null,
      critical: Boolean(kpi.critical),
      profitSensitive: Boolean(kpi.profitSensitive),
      ...resolved,
    };
  });

  const statusCounts = emptyStatusCounts();
  for (const r of results) statusCounts[r.status] += 1;

  const trustScore = buildFinancialTrustScore(results);
  const gate = buildRecommendationGate(results, trustScore);

  return {
    merchantId: opts.merchantId,
    generatedAt,
    window: opts.window ?? "last30d",
    results,
    trustScore,
    gate,
    statusCounts,
  };
}
