import { parseRevenueImpact } from "@/lib/approvals/presenter";
import { listFeedbackForLearning } from "@/lib/db/feedback";
import { listOutcomeHistory } from "@/lib/db/learning";
import { listOutcomeRecords } from "@/lib/db/outcome-records";
import { listStoredRecommendations } from "@/lib/db/recommendations";
import {
  applyFatigueToConfidence,
  computeFatigueAdjustment,
  type FatigueRecord,
} from "@/lib/learning/fatigue";
import {
  applyFeedbackToConfidence,
  applyFeedbackToPriority,
  computeFeedbackAdjustment,
  feedbackPatternKey,
  findFeedbackStatsForOutput,
  mergeFatigueWithFeedback,
  type FeedbackPatternStats,
} from "@/lib/learning/feedback-learning";
import { CATEGORY_LABELS } from "./metrics";
import type {
  AiPerformanceSummary,
  CategoryLearningStats,
  Recommendation,
  RecommendationCategory,
} from "@/lib/types";
import { DEMO_STORE_ID } from "@/lib/types";

export function computeAiPerformance(
  measuredRecs: Recommendation[],
  outcomeHistory?: { predictionAccuracy: number; actualMonthlyImpact: number; category?: string }[],
): AiPerformanceSummary {
  const fromOutcomes =
    measuredRecs.length === 0 && outcomeHistory && outcomeHistory.length > 0;

  if (measuredRecs.length === 0 && !fromOutcomes) {
    return {
      predictionAccuracy: 0,
      measuredCount: 0,
      revenueInfluenced: 0,
      bestCategory: "",
      bestCategoryLabel: "—",
    };
  }

  if (fromOutcomes && outcomeHistory) {
    const predictionAccuracy = Math.round(
      outcomeHistory.reduce((s, o) => s + o.predictionAccuracy, 0) / outcomeHistory.length,
    );
    const revenueInfluenced = outcomeHistory.reduce(
      (s, o) => s + o.actualMonthlyImpact,
      0,
    );

    const byCat = new Map<string, number[]>();
    for (const o of outcomeHistory) {
      if (!o.category) continue;
      const arr = byCat.get(o.category) ?? [];
      arr.push(o.predictionAccuracy);
      byCat.set(o.category, arr);
    }
    let bestCategory = "";
    let bestAvg = 0;
    for (const [cat, accs] of byCat) {
      const avg = accs.reduce((s, a) => s + a, 0) / accs.length;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestCategory = cat;
      }
    }

    return {
      predictionAccuracy,
      measuredCount: outcomeHistory.length,
      revenueInfluenced,
      bestCategory,
      bestCategoryLabel: bestCategory
        ? CATEGORY_LABELS[bestCategory as RecommendationCategory] ?? bestCategory
        : "Inventory",
    };
  }

  const accuracies = measuredRecs
    .map((r) => r.predictionAccuracy ?? 0)
    .filter((a) => a > 0);
  const predictionAccuracy =
    accuracies.length > 0
      ? Math.round(accuracies.reduce((s, a) => s + a, 0) / accuracies.length)
      : 0;

  const revenueInfluenced = measuredRecs.reduce((sum, r) => {
    if (r.actualImpact) return sum + parseRevenueImpact(r.actualImpact);
    return sum;
  }, 0);

  const byCategory = new Map<string, { total: number; count: number }>();
  for (const rec of measuredRecs) {
    const cat = rec.category;
    const acc = rec.predictionAccuracy ?? 0;
    const existing = byCategory.get(cat) ?? { total: 0, count: 0 };
    existing.total += acc;
    existing.count += 1;
    byCategory.set(cat, existing);
  }

  let bestCategory = "";
  let bestAvg = 0;
  for (const [cat, { total, count }] of byCategory) {
    const avg = total / count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestCategory = cat;
    }
  }

  return {
    predictionAccuracy,
    measuredCount: measuredRecs.length,
    revenueInfluenced,
    bestCategory,
    bestCategoryLabel: bestCategory
      ? CATEGORY_LABELS[bestCategory as RecommendationCategory] ?? bestCategory
      : "—",
  };
}

export async function getCategoryLearningStats(
  storeId = DEMO_STORE_ID,
): Promise<CategoryLearningStats[]> {
  const outcomes = await listOutcomeHistory(storeId);
  const outcomeRecords = await listOutcomeRecords(storeId, 200).then((rows) =>
    rows.filter((r) => r.measureStatus === "completed"),
  );
  const byCategory = new Map<
    string,
    { accuracies: number[]; realizations: number[]; successful: number; needsImprovement: number }
  >();

  for (const o of outcomes) {
    const existing = byCategory.get(o.category) ?? {
      accuracies: [],
      realizations: [],
      successful: 0,
      needsImprovement: 0,
    };
    existing.accuracies.push(o.predictionAccuracy);
    if (o.expectedMonthlyImpact > 0) {
      existing.realizations.push(
        (o.actualMonthlyImpact / o.expectedMonthlyImpact) * 100,
      );
    }
    byCategory.set(o.category, existing);
  }

  for (const record of outcomeRecords) {
    const category = String(record.category);
    const existing = byCategory.get(category) ?? {
      accuracies: [],
      realizations: [],
      successful: 0,
      needsImprovement: 0,
    };
    if (record.predictionAccuracy != null) {
      existing.accuracies.push(record.predictionAccuracy);
    }
    if (record.expectedMonthlyImpact > 0 && record.actualMonthlyImpact != null) {
      existing.realizations.push(
        (record.actualMonthlyImpact / record.expectedMonthlyImpact) * 100,
      );
    }
    if (record.outcomeRating === "successful") existing.successful += 1;
    if (record.outcomeRating === "needs_improvement") existing.needsImprovement += 1;
    byCategory.set(category, existing);
  }

  return [...byCategory.entries()].map(([category, data]) => ({
    category,
    label: CATEGORY_LABELS[category as RecommendationCategory] ?? category,
    sampleSize: data.accuracies.length,
    avgAccuracyPct: Math.round(
      data.accuracies.reduce((s, a) => s + a, 0) / Math.max(data.accuracies.length, 1),
    ),
    avgRealizationPct: Math.round(
      data.realizations.reduce((s, r) => s + r, 0) /
        Math.max(data.realizations.length, 1),
    ),
    successfulCount: data.successful,
    needsImprovementCount: data.needsImprovement,
  }));
}

export async function adjustConfidenceWithLearning(
  category: RecommendationCategory,
  baseConfidence: number,
  storeId = DEMO_STORE_ID,
): Promise<{ confidence: number; historicalNote?: string }> {
  const stats = await getCategoryLearningStats(storeId);
  const catStats = stats.find((s) => s.category === category);

  if (!catStats || catStats.sampleSize < 2) {
    return { confidence: baseConfidence };
  }

  const realizationFactor = catStats.avgRealizationPct / 100;
  let adjusted = Math.min(
    0.98,
    Math.max(0.35, baseConfidence * (0.85 + realizationFactor * 0.15)),
  );

  const needsImprovement = catStats.needsImprovementCount ?? 0;
  const successful = catStats.successfulCount ?? 0;
  if (needsImprovement >= 2 && successful === 0) {
    adjusted = Math.max(0.35, adjusted * 0.85);
  } else if (successful >= 3) {
    adjusted = Math.min(0.98, adjusted * 1.05);
  }

  return {
    confidence: Math.round(adjusted * 1000) / 1000,
    historicalNote: `Recommendations of this type have historically achieved ${catStats.avgRealizationPct}% of their expected impact (${catStats.sampleSize} measured).`,
  };
}

export async function applyLearningToOutputs(
  outputs: import("@/lib/types").AnalyzerOutput[],
  storeId = DEMO_STORE_ID,
): Promise<import("@/lib/types").AnalyzerOutput[]> {
  const stored = await listStoredRecommendations(storeId);
  const fatigueMap = new Map<string, FatigueRecord>();

  for (const rec of stored) {
    const key = `${rec.category}:${rec.entityId ?? rec.title}`;
    const existing = fatigueMap.get(key);
    fatigueMap.set(key, {
      dedupeKey: key,
      category: rec.category,
      ignoreCount:
        (existing?.ignoreCount ?? 0) + (rec.status === "ignored" ? 1 : 0),
      lastIgnoredAt:
        rec.status === "ignored" ? rec.createdAt : existing?.lastIgnoredAt,
      positiveOutcomes:
        (existing?.positiveOutcomes ?? 0) +
        (rec.status === "measured" && (rec.predictionAccuracy ?? 0) > 70 ? 1 : 0),
    });
  }

  const completedOutcomes = await listOutcomeRecords(storeId, 200);
  for (const outcome of completedOutcomes) {
    if (outcome.measureStatus !== "completed" || !outcome.actionType) continue;
    const key = `${outcome.category}:${outcome.entityId ?? outcome.title}`;
    const existing = fatigueMap.get(key);
    fatigueMap.set(key, {
      dedupeKey: key,
      category: outcome.category as RecommendationCategory,
      ignoreCount: existing?.ignoreCount ?? 0,
      lastIgnoredAt: existing?.lastIgnoredAt,
      positiveOutcomes:
        (existing?.positiveOutcomes ?? 0) +
        (outcome.outcomeRating === "successful" ? 1 : 0),
    });
  }

  // Merchant thumbs → pattern-scoped learning (same pipeline as outcome learning).
  const feedbackRows = await listFeedbackForLearning(storeId);
  const feedbackByPattern = new Map<string, FeedbackPatternStats>();
  for (const row of feedbackRows) {
    if (!row.category) continue;
    const key = feedbackPatternKey({
      category: row.category,
      entityId: row.entityId,
      title: row.title,
    });
    const existing = feedbackByPattern.get(key) ?? {
      patternKey: key,
      category: row.category as RecommendationCategory,
      helpfulCount: 0,
      notHelpfulCount: 0,
      lastFeedbackAt: row.createdAt,
    };
    if (row.helpful) existing.helpfulCount += 1;
    else existing.notHelpfulCount += 1;
    if (row.createdAt > existing.lastFeedbackAt) existing.lastFeedbackAt = row.createdAt;
    feedbackByPattern.set(key, existing);
  }

  const adjusted = [];
  for (const output of outputs) {
    const { confidence, historicalNote } = await adjustConfidenceWithLearning(
      output.category,
      output.confidence,
      storeId,
    );

    const fatigueKey = `${output.category}:${output.entityId ?? output.title}`;
    const fatigueRecord = fatigueMap.get(fatigueKey) ?? {
      dedupeKey: fatigueKey,
      category: output.category,
      ignoreCount: 0,
      positiveOutcomes: 0,
    };
    const fatigue = computeFatigueAdjustment(fatigueRecord);
    const feedbackStats = findFeedbackStatsForOutput(output, feedbackByPattern);
    const feedbackAdj = computeFeedbackAdjustment(feedbackStats);
    const combined = mergeFatigueWithFeedback(fatigue, feedbackAdj);

    if (combined.suppress) continue;

    const afterFatigue = applyFatigueToConfidence(confidence, fatigue);
    const finalConfidence = applyFeedbackToConfidence(afterFatigue, feedbackAdj);
    const finalPriority = applyFeedbackToPriority(output.priority, feedbackAdj);
    const notes = [historicalNote, combined.reason].filter(Boolean).join(" ");

    adjusted.push({
      ...output,
      priority: finalPriority,
      confidence: finalConfidence,
      description: notes ? `${output.description} ${notes}` : output.description,
    });
  }

  // Ranking: severity then confidence (matches sortRecommendations).
  adjusted.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    const sev = (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
    if (sev !== 0) return sev;
    return b.confidence - a.confidence;
  });

  return adjusted;
}

export function getHistoricalAccuracyNote(
  stats: CategoryLearningStats[],
  category: RecommendationCategory,
): string | undefined {
  const cat = stats.find((s) => s.category === category);
  if (!cat || cat.sampleSize < 2) return undefined;
  return `Recommendations of this type have historically achieved ${cat.avgRealizationPct}% of their expected impact.`;
}
