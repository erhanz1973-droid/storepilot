import type { DecisionQaRecord } from "@/lib/decisions/qa/types";
import { mapDecisionToIntents } from "./intent-mapper";
import { INTENT_LABELS, type DecisionIntent } from "./intents";

export type LeaderboardEntry = {
  decisionType: string;
  intent: DecisionIntent;
  accuracyPct: number;
  avgConfidencePct: number;
  avgQualityPct: number;
  merchantApprovalRatePct: number;
  outcomeSuccessRatePct: number;
  sampleCount: number;
  rank: number;
};

export function buildDecisionLeaderboard(
  records: Array<{
    decisions: DecisionQaRecord[];
    intentAccuracyPct?: number;
    verdict?: string;
  }>,
): LeaderboardEntry[] {
  const buckets = new Map<
    DecisionIntent,
    {
      confidence: number[];
      quality: number[];
      selfAssessment: number[];
      approved: number;
      passes: number;
      total: number;
    }
  >();

  for (const run of records) {
    for (const d of run.decisions) {
      const intents = mapDecisionToIntents(d);
      const primary = intents[0] ?? ("campaign_review" as DecisionIntent);
      const bucket = buckets.get(primary) ?? {
        confidence: [],
        quality: [],
        selfAssessment: [],
        approved: 0,
        passes: 0,
        total: 0,
      };
      bucket.confidence.push(d.confidencePct ?? 0);
      bucket.quality.push(d.qualityScorePct ?? 0);
      bucket.selfAssessment.push(d.selfAssessment?.scorePct ?? 0);
      if (d.status === "accepted") bucket.approved += 1;
      bucket.total += 1;
      if (run.verdict === "pass") bucket.passes += 1;
      buckets.set(primary, bucket);
    }
  }

  const entries: LeaderboardEntry[] = [...buckets.entries()].map(([intent, b]) => ({
    decisionType: INTENT_LABELS[intent],
    intent,
    accuracyPct: b.total > 0 ? Math.round((b.passes / b.total) * 1000) / 10 : 0,
    avgConfidencePct:
      b.confidence.length > 0
        ? Math.round(b.confidence.reduce((a, c) => a + c, 0) / b.confidence.length)
        : 0,
    avgQualityPct:
      b.quality.length > 0
        ? Math.round(b.quality.reduce((a, q) => a + q, 0) / b.quality.length)
        : 0,
    merchantApprovalRatePct:
      b.total > 0 ? Math.round((b.approved / b.total) * 1000) / 10 : 0,
    outcomeSuccessRatePct:
      b.selfAssessment.length > 0
        ? Math.round(b.selfAssessment.reduce((a, s) => a + s, 0) / b.selfAssessment.length)
        : 0,
    sampleCount: b.total,
    rank: 0,
  }));

  entries.sort((a, b) => b.avgQualityPct - a.avgQualityPct);
  return entries.map((e, i) => ({ ...e, rank: i + 1 }));
}
