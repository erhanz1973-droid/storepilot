import type { ProviderTrustLevel } from "./types";

export const TRUST_THRESHOLDS = {
  trusted: 99,
  warn: 95,
} as const;

export const FRESHNESS_STALE_MINUTES = 120;

export function resolveTrustLevel(
  matchScore: number | null,
  connected: boolean,
): ProviderTrustLevel {
  if (!connected) return "disconnected";
  if (matchScore === null) return "warn";
  if (matchScore >= TRUST_THRESHOLDS.trusted) return "trusted";
  if (matchScore >= TRUST_THRESHOLDS.warn) return "warn";
  return "blocked";
}

export function trustLevelRank(level: ProviderTrustLevel): number {
  return { trusted: 3, warn: 2, blocked: 1, disconnected: 0 }[level];
}

export function isProviderUsable(level: ProviderTrustLevel): boolean {
  return level === "trusted" || level === "warn";
}

export function validationConfidenceFromScore(matchScore: number | null): number {
  if (matchScore === null) return 0.85;
  return Math.max(0, Math.min(1, matchScore / 100));
}

export function computeFinalConfidence(
  aiConfidence: number,
  validationConfidence: number,
): number {
  return Math.round(aiConfidence * validationConfidence * 1000) / 1000;
}

export function formatMinutesAgo(minutes: number | null): string {
  if (minutes === null) return "unknown";
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

export function cacheFreshness(
  cacheAgeMinutes: number | null,
): "fresh" | "stale" | "unknown" {
  if (cacheAgeMinutes === null) return "unknown";
  return cacheAgeMinutes <= FRESHNESS_STALE_MINUTES ? "fresh" : "stale";
}
