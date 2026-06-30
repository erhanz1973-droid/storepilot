import { getFeedbackSummary } from "@/lib/db/feedback";
import { listOutcomeHistory } from "@/lib/db/learning";
import { listStoredRecommendations } from "@/lib/db/recommendations";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/client";
import { resolveActiveStoreId } from "@/lib/store/context";
import {
  cacheValidationReport,
  getLastValidationReport,
  runValidationSuite,
} from "@/lib/validation/runner";
import type { ValidationMetrics, ValidationReport } from "@/lib/validation/types";

function recommendationStats(recommendations: Awaited<ReturnType<typeof listStoredRecommendations>>) {
  const total = recommendations.length;
  const approved = recommendations.filter(
    (r) => r.status === "approved" || r.status === "implemented" || r.status === "completed",
  ).length;
  const rejected = recommendations.filter((r) => r.status === "ignored").length;
  const measured = recommendations.filter((r) => r.status === "measured").length;
  const decided = approved + rejected;
  const acceptanceRatePct =
    decided > 0 ? Math.round((approved / decided) * 1000) / 10 : 0;

  const measuredWithAccuracy = recommendations.filter(
    (r) => r.predictionAccuracy != null && r.predictionAccuracy > 0,
  );
  const accuracyRatePct =
    measuredWithAccuracy.length > 0
      ? Math.round(
          measuredWithAccuracy.reduce((s, r) => s + (r.predictionAccuracy ?? 0), 0) /
            measuredWithAccuracy.length,
        )
      : 0;

  const falsePositives = measuredWithAccuracy.filter(
    (r) => (r.predictionAccuracy ?? 0) < 40,
  ).length;
  const falsePositiveRatePct =
    measuredWithAccuracy.length > 0
      ? Math.round((falsePositives / measuredWithAccuracy.length) * 1000) / 10
      : 0;

  const avgProfitGenerated =
    measuredWithAccuracy.length > 0
      ? Math.round(
          measuredWithAccuracy.reduce((s, r) => {
            const m = r.outcomeMetrics?.revenue30d ?? 0;
            const b = r.baselineMetrics?.revenue30d ?? 0;
            return s + Math.max(0, m - b);
          }, 0) / measuredWithAccuracy.length,
        )
      : 0;

  return {
    total,
    measured,
    acceptanceRatePct,
    accuracyRatePct,
    falsePositiveRatePct,
    avgProfitGenerated,
  };
}

async function countActiveStores(): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { count, error } = await supabase
      .from("stores")
      .select("*", { count: "exact", head: true })
      .eq("is_simulation", false);
    if (!error && count != null) return count;
  }
  return 1;
}

export async function buildValidationMetrics(
  report?: ValidationReport | null,
): Promise<ValidationMetrics> {
  const storeId = await resolveActiveStoreId();
  const recommendations = await listStoredRecommendations(storeId);
  const stats = recommendationStats(recommendations);
  const feedback = await getFeedbackSummary(storeId);
  const outcomes = await listOutcomeHistory(storeId);
  const lastReport = report ?? getLastValidationReport();

  const avgSyncDurationMs =
    lastReport?.performance.length
      ? Math.round(
          lastReport.performance.reduce((s, p) => s + p.snapshotTimeMs, 0) /
            lastReport.performance.length,
        )
      : null;

  const apiErrorRatePct = lastReport
    ? Math.round((lastReport.failed / Math.max(1, lastReport.checks.length)) * 1000) / 10
    : 0;

  return {
    activeStores: await countActiveStores(),
    totalRecommendations: stats.total,
    measuredRecommendations: stats.measured,
    feedbackHelpful: feedback.helpful,
    feedbackNotHelpful: feedback.notHelpful,
    acceptanceRatePct: stats.acceptanceRatePct,
    accuracyRatePct: stats.accuracyRatePct,
    avgProfitGenerated: stats.avgProfitGenerated,
    falsePositiveRatePct: stats.falsePositiveRatePct,
    askAiSessionsEstimate: outcomes.length > 0 ? outcomes.length * 3 : 0,
    avgSyncDurationMs,
    apiErrorRatePct,
    lastValidationRun: lastReport?.runAt ?? null,
    goNoGo: lastReport?.goNoGo ?? null,
  };
}

export async function runAndCacheValidation(): Promise<{
  report: ValidationReport;
  metrics: ValidationMetrics;
}> {
  const report = await runValidationSuite();
  cacheValidationReport(report);
  const metrics = await buildValidationMetrics(report);
  return { report, metrics };
}

export function isValidationAdminEnabled(): boolean {
  return process.env.VALIDATION_ADMIN !== "false";
}
