import type { IntentMatchResult } from "./semantic-evaluator";
import type { BusinessModel } from "@/lib/business-model/types";
import type { DecisionQaRecord } from "@/lib/decisions/qa/types";
import type {
  DecisionQualityRecord,
  QualityRunSummary,
  QualityLabReport,
  EnrichedQualityRunResult,
} from "./types";
import type { DecisionIntent } from "./intents";
import type { DecisionSelfAssessment } from "./self-assessment";
import type { DecisionQualityBreakdown } from "./quality-score";
import { getSupabaseAdmin } from "@/lib/supabase/client";

const memoryScores: DecisionQualityRecord[] = [];
const memoryRuns: QualityRunSummary[] = [];
const memoryIntentEvals: Array<IntentMatchResult & { runId: string; storeId: string; scenarioId?: string; businessModel?: string }> = [];
let lastEnrichedRun: EnrichedQualityRunResult | null = null;
const MAX_MEMORY = 2000;

export async function persistDecisionQualityScores(input: {
  storeId: string;
  runId: string;
  scenarioId?: string;
  businessModel?: BusinessModel;
  records: Array<{
    decision: DecisionQaRecord;
    breakdown: DecisionQualityBreakdown;
    intents: DecisionIntent[];
    selfAssessment: DecisionSelfAssessment;
  }>;
}): Promise<void> {
  const rows = input.records.map((r) => ({
    id: crypto.randomUUID(),
    storeId: input.storeId,
    runId: input.runId,
    scenarioId: input.scenarioId,
    businessModel: input.businessModel,
    decisionId: r.decision.id,
    problemKey: r.decision.problemKey,
    summary: r.decision.summary,
    category: (r.decision as { category?: string }).category,
    overallQualityPct: r.breakdown.overallPct,
    validationQualityPct: r.breakdown.validationQualityPct,
    explainabilityPct: r.breakdown.explainabilityPct,
    businessLogicPct: r.breakdown.businessLogicPct,
    strategyComparisonPct: r.breakdown.strategyComparisonPct,
    evidenceCompletenessPct: r.breakdown.evidenceCompletenessPct,
    intentMatchPct: r.breakdown.intentMatchPct,
    businessModelCompliancePct: r.breakdown.businessModelCompliancePct,
    confidencePct: r.breakdown.confidencePct,
    detectedIntents: r.intents,
    selfAssessment: r.selfAssessment,
    breakdown: r.breakdown,
    createdAt: new Date().toISOString(),
  }));

  memoryScores.unshift(...rows);
  if (memoryScores.length > MAX_MEMORY) memoryScores.length = MAX_MEMORY;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("decision_quality_scores").insert(
    rows.map((r) => ({
      id: r.id,
      store_id: r.storeId,
      decision_id: r.decisionId,
      run_id: r.runId,
      scenario_id: r.scenarioId,
      business_model: r.businessModel,
      problem_key: r.problemKey,
      summary: r.summary,
      category: r.category,
      overall_quality_pct: r.overallQualityPct,
      validation_quality_pct: r.validationQualityPct,
      explainability_pct: r.explainabilityPct,
      business_logic_pct: r.businessLogicPct,
      strategy_comparison_pct: r.strategyComparisonPct,
      evidence_completeness_pct: r.evidenceCompletenessPct,
      intent_match_pct: r.intentMatchPct,
      business_model_compliance_pct: r.businessModelCompliancePct,
      confidence_pct: r.confidencePct,
      detected_intents: r.detectedIntents,
      self_assessment: r.selfAssessment,
      breakdown: r.breakdown,
    })),
  );
}

export async function persistIntentEvaluations(input: {
  runId: string;
  storeId: string;
  scenarioId?: string;
  businessModel?: BusinessModel;
  matches: IntentMatchResult[];
}): Promise<void> {
  memoryIntentEvals.unshift(
    ...input.matches.map((m) => ({
      ...m,
      runId: input.runId,
      storeId: input.storeId,
      scenarioId: input.scenarioId,
      businessModel: input.businessModel,
    })),
  );
  if (memoryIntentEvals.length > MAX_MEMORY) memoryIntentEvals.length = MAX_MEMORY;

  const supabase = getSupabaseAdmin();
  if (!supabase || input.matches.length === 0) return;

  await supabase.from("decision_intent_evaluations").insert(
    input.matches.map((m) => ({
      id: crypto.randomUUID(),
      run_id: input.runId,
      store_id: input.storeId,
      scenario_id: input.scenarioId,
      business_model: input.businessModel,
      expected_intent: m.expectedIntent,
      actual_intents: m.actualIntents,
      verdict: m.verdict,
      matched_decision_summary: m.matchedDecisionSummary,
      confidence_pct: m.confidencePct,
      quality_score_pct: m.qualityScorePct,
      reason: m.reason,
    })),
  );
}

export function setLastEnrichedRun(run: EnrichedQualityRunResult): void {
  lastEnrichedRun = run;
}

export function getLastEnrichedRun(): EnrichedQualityRunResult | null {
  return lastEnrichedRun;
}

export function listMemoryIntentEvaluations(limit = 50) {
  return memoryIntentEvals.slice(0, limit);
}

export async function persistQualityRun(summary: QualityRunSummary): Promise<void> {
  memoryRuns.unshift(summary);
  if (memoryRuns.length > 500) memoryRuns.length = 500;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("decision_quality_runs").insert({
    id: summary.runId,
    run_type: summary.runType,
    release_version: summary.releaseVersion,
    scenario_id: summary.scenarioId,
    business_model: summary.businessModel,
    store_id: summary.storeId,
    verdict: summary.verdict,
    accuracy_pct: summary.accuracyPct,
    avg_quality_pct: summary.avgQualityPct,
    avg_confidence_pct: summary.avgConfidencePct,
    avg_explainability_pct: summary.avgExplainabilityPct,
    avg_validation_pct: summary.avgValidationPct,
    pass_count: summary.passCount,
    warn_count: summary.warnCount,
    fail_count: summary.failCount,
    forbidden_hits: summary.forbiddenHits,
    drift_flags: summary.driftFlags,
    performance: summary.performance,
    metadata: summary.metadata ?? {},
  });
}

export function listMemoryQualityRuns(limit = 50): QualityRunSummary[] {
  return memoryRuns.slice(0, limit);
}

export function listMemoryQualityScores(limit = 100): DecisionQualityRecord[] {
  return memoryScores.slice(0, limit);
}

export function getLatestQualityLabReport(): QualityLabReport | null {
  if (memoryRuns.length === 0) return null;
  const runs = memoryRuns.slice(0, 20);
  const total = runs.length;
  const passed = runs.filter((r) => r.verdict === "pass").length;
  return {
    generatedAt: new Date().toISOString(),
    accuracyPct: Math.round((passed / total) * 1000) / 10,
    accuracyTrend: "stable",
    totalRuns: memoryRuns.length,
    recentRuns: runs,
    avgQualityPct: Math.round(
      runs.reduce((s, r) => s + r.avgQualityPct, 0) / total,
    ),
  };
}
