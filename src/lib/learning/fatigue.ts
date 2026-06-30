import type { RecommendationCategory } from "@/lib/types";

export type FatigueRecord = {
  dedupeKey: string;
  category: RecommendationCategory;
  ignoreCount: number;
  lastIgnoredAt?: string;
  lastShownAt?: string;
  positiveOutcomes: number;
};

export type FatigueAdjustment = {
  suppress: boolean;
  priorityMultiplier: number;
  confidenceMultiplier: number;
  reason?: string;
};

const IGNORE_THRESHOLD = 2;
const SUPPRESS_DAYS = 7;

export function computeFatigueAdjustment(record: FatigueRecord): FatigueAdjustment {
  if (record.positiveOutcomes >= 3) {
    return {
      suppress: false,
      priorityMultiplier: 1.25,
      confidenceMultiplier: 1.1,
      reason: "Similar recommendations have led to positive outcomes.",
    };
  }

  if (record.ignoreCount >= IGNORE_THRESHOLD) {
    const lastIgnored = record.lastIgnoredAt
      ? Date.now() - new Date(record.lastIgnoredAt).getTime()
      : Infinity;
    if (lastIgnored < SUPPRESS_DAYS * 86400000) {
      return {
        suppress: true,
        priorityMultiplier: 0.3,
        confidenceMultiplier: 0.85,
        reason: "Recommendation fatigue detected — suppressed after repeated ignores.",
      };
    }
    return {
      suppress: false,
      priorityMultiplier: 0.6,
      confidenceMultiplier: 0.9,
      reason: "Priority reduced due to repeated ignores.",
    };
  }

  if (record.ignoreCount === 1) {
    return {
      suppress: false,
      priorityMultiplier: 0.85,
      confidenceMultiplier: 0.95,
    };
  }

  return {
    suppress: false,
    priorityMultiplier: 1,
    confidenceMultiplier: 1,
  };
}

export function applyFatigueToConfidence(
  baseConfidence: number,
  adjustment: FatigueAdjustment,
): number {
  return Math.min(0.98, Math.max(0.2, baseConfidence * adjustment.confidenceMultiplier));
}

export function applyFatigueToPriorityScore(
  baseScore: number,
  adjustment: FatigueAdjustment,
): number {
  if (adjustment.suppress) return 0;
  return Math.round(baseScore * adjustment.priorityMultiplier);
}
