import type { ValidationStatus } from "./types";

/** Max age (hours) before a synced KPI is no longer "fresh" for trust */
export const DEFAULT_MAX_FRESHNESS_HOURS = 36;

/** Default relative tolerance for Within Tolerance (1%) */
export const DEFAULT_REALITY_TOLERANCE = 0.01;

/** Absolute $ epsilon treated as verified even if tiny float noise */
export const DEFAULT_ABS_EPSILON = 0.005;

export function isFresh(
  lastSyncedAt: string | null | undefined,
  maxAgeHours: number = DEFAULT_MAX_FRESHNESS_HOURS,
  nowMs: number = Date.now(),
): boolean {
  if (!lastSyncedAt) return false;
  const t = Date.parse(lastSyncedAt);
  if (!Number.isFinite(t)) return false;
  return nowMs - t <= maxAgeHours * 60 * 60 * 1000;
}

export function statusIsTrusted(status: ValidationStatus): boolean {
  return status === "verified" || status === "within_tolerance";
}
