import { listStoreIdsForLearningCron } from "@/lib/learning/learning-cron-stores";
import { runPendingMeasurements } from "@/lib/learning/measurement-engine";
import { recordExecutiveMemoryEvent } from "@/lib/db/executive-memory";
import { parseRevenueImpact } from "@/lib/approvals/presenter";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Daily Learning Loop job:
 * Find due recommendations → measure expected vs actual → persist outcomes →
 * update Executive Memory. No merchant intervention required.
 *
 * Schedule: once daily via Vercel Cron (see vercel.json).
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storeIds = await listStoreIdsForLearningCron();
  const results: {
    storeId: string;
    ok: boolean;
    measured: number;
    outcomeRecordsMeasured: number;
    skipped: number;
    memoryEvents: number;
    error?: string;
  }[] = [];

  for (const storeId of storeIds) {
    try {
      const run = await runPendingMeasurements(storeId);
      let memoryEvents = 0;

      for (const rec of run.measured) {
        const measuredImpact = rec.actualImpact
          ? parseRevenueImpact(rec.actualImpact)
          : null;
        await recordExecutiveMemoryEvent({
          storeId,
          eventType: "measured",
          title: rec.title,
          recommendationId: rec.id,
          estimatedImpactMonthly: parseRevenueImpact(rec.expectedImpact),
          measuredImpactMonthly: measuredImpact,
          outcomeRating:
            (rec.predictionAccuracy ?? 0) >= 70
              ? "successful"
              : (rec.predictionAccuracy ?? 0) < 40
                ? "needs_improvement"
                : "neutral",
          contextMessage:
            measuredImpact != null
              ? `Measured outcome: $${Math.round(measuredImpact).toLocaleString()}/mo actual vs expected ${rec.expectedImpact} (${rec.predictionAccuracy ?? 0}% accuracy).`
              : `Recommendation measured with ${rec.predictionAccuracy ?? 0}% prediction accuracy.`,
          occurredAt: rec.measuredAt ?? new Date().toISOString(),
          metadata: {
            predictionAccuracy: rec.predictionAccuracy ?? null,
            category: rec.category,
          },
        });
        memoryEvents += 1;
      }

      for (const record of run.outcomeRecordsMeasured) {
        await recordExecutiveMemoryEvent({
          storeId,
          eventType: "measured",
          title: record.title,
          recommendationId: record.recommendationId,
          estimatedImpactMonthly: record.expectedMonthlyImpact,
          measuredImpactMonthly: record.actualMonthlyImpact,
          outcomeRating: record.outcomeRating,
          contextMessage:
            record.aiVerdict ??
            record.outcomeSummary ??
            "Outcome record measurement completed.",
          occurredAt: record.measuredAt ?? new Date().toISOString(),
          metadata: {
            outcomeRecordId: record.id,
            category: record.category,
          },
        });
        memoryEvents += 1;
      }

      if (run.measured.length > 0 || run.outcomeRecordsMeasured.length > 0) {
        await recordExecutiveMemoryEvent({
          storeId,
          eventType: "learned",
          title: "AI learning updated from measured outcomes",
          contextMessage: `Measured ${run.measured.length + run.outcomeRecordsMeasured.length} recommendation(s). Future confidence and ranking will reflect these results.`,
          metadata: {
            measuredRecommendations: run.measured.length,
            measuredOutcomeRecords: run.outcomeRecordsMeasured.length,
          },
        });
        memoryEvents += 1;
      }

      results.push({
        storeId,
        ok: true,
        measured: run.measured.length,
        outcomeRecordsMeasured: run.outcomeRecordsMeasured.length,
        skipped: run.skipped,
        memoryEvents,
      });
    } catch (err) {
      results.push({
        storeId,
        ok: false,
        measured: 0,
        outcomeRecordsMeasured: 0,
        skipped: 0,
        memoryEvents: 0,
        error: err instanceof Error ? err.message : "measurement failed",
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    job: "learning-measure",
    syncedAt: new Date().toISOString(),
    stores: storeIds.length,
    succeeded: okCount,
    failed: results.length - okCount,
    totalMeasured: results.reduce((s, r) => s + r.measured + r.outcomeRecordsMeasured, 0),
    results,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
