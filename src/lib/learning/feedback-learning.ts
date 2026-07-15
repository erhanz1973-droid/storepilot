/**
 * Pattern-scoped merchant feedback → learning adjustments.
 * Negative feedback reduces confidence only for similar recommendation patterns.
 * Positive feedback boosts confidence for matching patterns.
 */
import type { AnalyzerOutput, RecommendationCategory, RecommendationSeverity } from "@/lib/types";
import type { FatigueAdjustment } from "@/lib/learning/fatigue";

export type FeedbackPatternStats = {
  /** category:entityId or category:normalizedTitle */
  patternKey: string;
  category: RecommendationCategory;
  helpfulCount: number;
  notHelpfulCount: number;
  lastFeedbackAt: string;
};

export type FeedbackLearningAdjustment = {
  confidenceMultiplier: number;
  priorityDelta: number;
  suppress: boolean;
  reason?: string;
};

const SEVERITY_ORDER: RecommendationSeverity[] = ["low", "medium", "high", "critical"];

export function feedbackPatternKey(input: {
  category: string;
  entityId?: string | null;
  title?: string | null;
}): string {
  const category = input.category.trim().toLowerCase();
  const entityId = input.entityId?.trim();
  if (entityId) return `${category}:${entityId}`;
  const title = (input.title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return `${category}:${title || "unknown"}`;
}

export function computeFeedbackAdjustment(
  stats: FeedbackPatternStats | undefined,
): FeedbackLearningAdjustment {
  if (!stats) {
    return { confidenceMultiplier: 1, priorityDelta: 0, suppress: false };
  }

  const helpful = stats.helpfulCount;
  const notHelpful = stats.notHelpfulCount;
  const total = helpful + notHelpful;
  if (total === 0) {
    return { confidenceMultiplier: 1, priorityDelta: 0, suppress: false };
  }

  // Strong negative consensus on this pattern → suppress similar recs temporarily.
  if (notHelpful >= 2 && notHelpful > helpful) {
    return {
      confidenceMultiplier: 0.75,
      priorityDelta: -1,
      suppress: notHelpful >= 3 && helpful === 0,
      reason: `Merchants marked similar ${stats.category} recommendations not helpful (${notHelpful}×).`,
    };
  }

  if (notHelpful >= 1 && notHelpful >= helpful) {
    return {
      confidenceMultiplier: 0.88,
      priorityDelta: -1,
      suppress: false,
      reason: `Similar ${stats.category} recommendations received negative merchant feedback.`,
    };
  }

  if (helpful >= 3 && helpful > notHelpful * 2) {
    return {
      confidenceMultiplier: 1.12,
      priorityDelta: 1,
      suppress: false,
      reason: `Similar ${stats.category} recommendations were marked helpful by merchants.`,
    };
  }

  if (helpful >= 1 && helpful > notHelpful) {
    return {
      confidenceMultiplier: 1.05,
      priorityDelta: 0,
      suppress: false,
      reason: `Merchants marked similar ${stats.category} recommendations helpful.`,
    };
  }

  return { confidenceMultiplier: 1, priorityDelta: 0, suppress: false };
}

export function applyFeedbackToConfidence(
  baseConfidence: number,
  adjustment: FeedbackLearningAdjustment,
): number {
  return Math.min(0.98, Math.max(0.2, baseConfidence * adjustment.confidenceMultiplier));
}

export function applyFeedbackToPriority(
  priority: RecommendationSeverity,
  adjustment: FeedbackLearningAdjustment,
): RecommendationSeverity {
  if (adjustment.priorityDelta === 0) return priority;
  const idx = SEVERITY_ORDER.indexOf(priority);
  if (idx < 0) return priority;
  const next = Math.max(0, Math.min(SEVERITY_ORDER.length - 1, idx + adjustment.priorityDelta));
  return SEVERITY_ORDER[next]!;
}

export function mergeFatigueWithFeedback(
  fatigue: FatigueAdjustment,
  feedback: FeedbackLearningAdjustment,
): FatigueAdjustment {
  return {
    suppress: fatigue.suppress || feedback.suppress,
    priorityMultiplier: fatigue.priorityMultiplier * (feedback.priorityDelta < 0 ? 0.85 : feedback.priorityDelta > 0 ? 1.1 : 1),
    confidenceMultiplier: fatigue.confidenceMultiplier * feedback.confidenceMultiplier,
    reason: [fatigue.reason, feedback.reason].filter(Boolean).join(" "),
  };
}

export function findFeedbackStatsForOutput(
  output: AnalyzerOutput,
  byPattern: Map<string, FeedbackPatternStats>,
): FeedbackPatternStats | undefined {
  const primary = feedbackPatternKey({
    category: output.category,
    entityId: output.entityId,
    title: output.title,
  });
  if (byPattern.has(primary)) return byPattern.get(primary);

  // Category-only fallback when entity-specific pattern has no feedback yet —
  // only use when the category has a clear negative/positive skew and enough samples.
  const categoryKeys = [...byPattern.values()].filter((s) => s.category === output.category);
  if (categoryKeys.length === 0) return undefined;

  const helpful = categoryKeys.reduce((s, r) => s + r.helpfulCount, 0);
  const notHelpful = categoryKeys.reduce((s, r) => s + r.notHelpfulCount, 0);
  if (helpful + notHelpful < 3) return undefined;

  return {
    patternKey: `${output.category}:*`,
    category: output.category,
    helpfulCount: helpful,
    notHelpfulCount: notHelpful,
    lastFeedbackAt: categoryKeys
      .map((k) => k.lastFeedbackAt)
      .sort()
      .at(-1)!,
  };
}
