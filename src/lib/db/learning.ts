import {
  applyRecommendationOutcome,
  getRecommendationById,
  listStoredRecommendations,
  memoryRecommendations,
  updateRecommendationStatus,
} from "@/lib/db/recommendations";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type {
  MeasurementKpis,
  Recommendation,
  RecommendationOutcome,
} from "@/lib/types";
import { DEMO_STORE_ID } from "@/lib/types";

export { getRecommendationById, listStoredRecommendations } from "@/lib/db/recommendations";

type OutcomeRecord = {
  category: string;
  expectedMonthlyImpact: number;
  actualMonthlyImpact: number;
  predictionAccuracy: number;
  measuredAt: string;
};

const memoryOutcomes: (OutcomeRecord & { store_id: string })[] = [];
let demoSeeded = false;

export async function markRecommendationImplemented(
  recommendationId: string,
  baselineMetrics: MeasurementKpis,
  storeId = DEMO_STORE_ID,
): Promise<Recommendation | null> {
  await updateRecommendationStatus(
    recommendationId,
    "implemented",
    { baselineMetrics },
    storeId,
  );
  return getRecommendationById(recommendationId);
}

export async function updateRecommendationWithOutcome(
  recommendationId: string,
  update: {
    status: "measured";
    actualImpact: string;
    predictionAccuracy: number;
    measuredAt: string;
    outcomeMetrics: MeasurementKpis;
    outcomeSummary: string;
    measurementWindowDays: number;
  },
): Promise<Recommendation> {
  return applyRecommendationOutcome(recommendationId, update);
}

export async function saveRecommendationOutcome(
  storeId: string,
  rec: Recommendation,
  outcome: RecommendationOutcome,
): Promise<void> {
  const record = {
    store_id: storeId,
    category: rec.category,
    expectedMonthlyImpact: outcome.expectedMonthlyImpact,
    actualMonthlyImpact: outcome.actualMonthlyImpact,
    predictionAccuracy: outcome.predictionAccuracy,
    measuredAt: outcome.measuredAt,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryOutcomes.push(record);
    return;
  }

  await supabase.from("recommendation_outcomes").insert({
    recommendation_id: rec.id,
    store_id: storeId,
    category: rec.category,
    expected_monthly_impact: outcome.expectedMonthlyImpact,
    actual_monthly_impact: outcome.actualMonthlyImpact,
    prediction_accuracy: outcome.predictionAccuracy,
    baseline_metrics: outcome.baselineMetrics,
    outcome_metrics: outcome.outcomeMetrics,
    outcome_summary: outcome.outcomeSummary,
    measurement_window_days: outcome.measurementWindowDays,
    measured_at: outcome.measuredAt,
  });
}

export async function listOutcomeHistory(storeId = DEMO_STORE_ID): Promise<OutcomeRecord[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    await seedDemoLearningData(storeId);
    return memoryOutcomes
      .filter((o) => o.store_id === storeId)
      .map(({ store_id: _, ...rest }) => rest);
  }

  const { data, error } = await supabase
    .from("recommendation_outcomes")
    .select("category, expected_monthly_impact, actual_monthly_impact, prediction_accuracy, measured_at")
    .eq("store_id", storeId)
    .order("measured_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((o) => ({
    category: o.category as string,
    expectedMonthlyImpact: Number(o.expected_monthly_impact),
    actualMonthlyImpact: Number(o.actual_monthly_impact),
    predictionAccuracy: Number(o.prediction_accuracy),
    measuredAt: o.measured_at as string,
  }));
}

export async function listMeasuredRecommendations(
  storeId = DEMO_STORE_ID,
): Promise<Recommendation[]> {
  const all = await listStoredRecommendations(storeId);
  return all.filter((r) => r.status === "measured");
}

async function seedDemoLearningData(storeId: string) {
  if (demoSeeded || storeId !== DEMO_STORE_ID) return;
  demoSeeded = true;

  const now = Date.now();
  const samples = [
    { category: "low_inventory", expected: 850, actual: 790, accuracy: 93 },
    { category: "homepage_merchandising", expected: 620, actual: 710, accuracy: 100 },
    { category: "bundle_opportunity", expected: 540, actual: 480, accuracy: 89 },
    { category: "campaign_review", expected: 1200, actual: 980, accuracy: 82 },
    { category: "slow_selling", expected: 310, actual: 245, accuracy: 79 },
  ];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    memoryOutcomes.push({
      store_id: storeId,
      category: s.category,
      expectedMonthlyImpact: s.expected,
      actualMonthlyImpact: s.actual,
      predictionAccuracy: s.accuracy,
      measuredAt: new Date(now - (i + 1) * 86400000 * 3).toISOString(),
    });

    const recId = `demo-measured-rec-${i}`;
    if (!memoryRecommendations.has(recId)) {
      memoryRecommendations.set(recId, {
        id: recId,
        store_id: storeId,
        dedupe_key: `demo-measured-${i}`,
        category: s.category,
        recommendation_type: s.category,
        title: `Demo Measured — ${s.category}`,
        description: "Seeded measured recommendation for AI performance demo.",
        reason: "Demo seed data for learning loop.",
        priority: "medium",
        expected_impact: `+$${s.expected}/month`,
        confidence_score: 0.85,
        validation_score: 88,
        estimated_revenue_gain: s.actual,
        estimated_cost_saving: null,
        action_label: "Review",
        entity_type: null,
        entity_id: null,
        evidence: [],
        evidence_json: { supportingMetrics: [], providerSources: [] },
        actions: [],
        status: "measured",
        snoozed_until: null,
        created_at: new Date(now - 86400000 * 14).toISOString(),
        updated_at: new Date(now - (i + 1) * 86400000 * 3).toISOString(),
        approved_at: new Date(now - 86400000 * 12).toISOString(),
        implemented_at: new Date(now - 86400000 * 10).toISOString(),
        completed_at: new Date(now - (i + 1) * 86400000 * 3).toISOString(),
        measured_at: new Date(now - (i + 1) * 86400000 * 3).toISOString(),
        actual_impact: `+$${s.actual}/month`,
        prediction_accuracy: s.accuracy,
        measurement_window_days: 7,
        baseline_metrics: { revenue30d: 10000 },
        outcome_metrics: { revenue30d: 11200 },
        outcome_summary:
          s.category === "low_inventory"
            ? "Revenue increased 12%. Stockouts reduced to zero."
            : "Key metrics improved within the measurement window.",
      });
    }
  }
}

export async function seedDemoLearningIfNeeded(storeId = DEMO_STORE_ID): Promise<void> {
  if (!getSupabaseAdmin()) {
    await seedDemoLearningData(storeId);
  }
}
