import type { BusinessModel } from "@/lib/business-model/types";
import type { DecisionQaRecord } from "@/lib/decisions/qa/types";
import type { SimulationRunResult } from "@/lib/simulation-lab/types";
import { SIMULATION_SCENARIOS } from "@/lib/simulation-lab/scenarios";
import { runFullSimulation, runSimulationPipeline } from "@/lib/simulation-lab/runner";
import { buildSimulationValidationGate } from "@/lib/simulation-lab/validation-gate";
import type { SimulationStoreRecord } from "@/lib/simulation-lab/types";
import { enrichDecisionsWithQa } from "@/lib/decisions/qa/enrich";
import { evaluateSemanticIntents } from "./semantic-evaluator";
import { computeExtendedDecisionQuality } from "./quality-score";
import { buildDecisionSelfAssessment } from "./self-assessment";
import { mapDecisionToIntents } from "./intent-mapper";
import { SCENARIO_EXPECTED_INTENTS } from "./intents";
import { generateRandomStores } from "./monte-carlo";
import { buildReplaySnapshots } from "./replay";
import { detectDecisionDrift, setDriftBaseline, getDriftBaseline } from "./drift";
import { buildDecisionLeaderboard } from "./leaderboard";
import {
  buildBenchmarkFromRuns,
  recordQualityBenchmark,
  accuracyTrend,
} from "./benchmark";
import { evaluateReleaseQualityGate } from "./release-gate";
import {
  persistDecisionQualityScores,
  persistQualityRun,
  persistIntentEvaluations,
  setLastEnrichedRun,
} from "./db";
import { simulationStoreIdForModel } from "@/lib/simulation-lab/store-ids";
import { getScenarioById } from "@/lib/simulation-lab/scenarios";
import type {
  QualityLabReport,
  QualityRunSummary,
  EnrichedQualityRunResult,
} from "./types";

const CRITICAL_SCENARIOS = [
  "dead_inventory",
  "roas_collapse",
  "scaling_opportunity",
  "healthy_store",
];

const ALL_BUSINESS_MODELS: BusinessModel[] = [
  "own_inventory",
  "dropshipping",
  "subscription",
  "print_on_demand",
  "digital_products",
  "private_label",
  "hybrid",
];

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export async function enrichSimulationWithQuality(
  simResult: SimulationRunResult,
): Promise<EnrichedQualityRunResult> {
  const qaDecisions = enrichDecisionsWithQa(simResult.decisions);
  const expectedIntents = SCENARIO_EXPECTED_INTENTS[simResult.scenarioId] ?? [];
  const semantic = evaluateSemanticIntents({
    decisions: qaDecisions,
    scenarioId: simResult.scenarioId,
    businessModel: simResult.businessModel,
  });

  const qualityRecords = qaDecisions.map((d) => {
    const breakdown = computeExtendedDecisionQuality({
      item: d,
      businessModel: simResult.businessModel,
      expectedIntents,
      intentMatchPct: semantic.accuracyPct,
    });
    const intents = mapDecisionToIntents(d);
    const selfAssessment = buildDecisionSelfAssessment({
      item: d,
      businessModel: simResult.businessModel,
    });
    return { decision: d, breakdown, intents, selfAssessment };
  });

  const runId = simResult.runId;
  await persistDecisionQualityScores({
    storeId: simResult.storeId,
    runId,
    scenarioId: simResult.scenarioId,
    businessModel: simResult.businessModel,
    records: qualityRecords,
  });

  await persistIntentEvaluations({
    runId,
    storeId: simResult.storeId,
    scenarioId: simResult.scenarioId,
    businessModel: simResult.businessModel,
    matches: semantic.matches,
  });

  const drift = detectDecisionDrift({
    scenarioId: simResult.scenarioId,
    businessModel: simResult.businessModel,
    decisions: qaDecisions,
  });

  const avgQuality = avg(qualityRecords.map((r) => r.breakdown.overallPct));
  const avgConfidence = avg(qaDecisions.map((d) => d.confidencePct ?? 0));
  const avgExplainability = avg(
    qaDecisions.map((d) => d.explainability?.scorePct ?? 0),
  );
  const avgValidation = avg(
    qaDecisions.map((d) => d.validationScorePct ?? 0),
  );
  const complianceScores = qualityRecords.map(
    (r) => r.breakdown.businessModelCompliancePct,
  );
  const businessModelCompliancePct = avg(complianceScores);

  const summary: QualityRunSummary = {
    runId,
    runType: "simulation",
    scenarioId: simResult.scenarioId,
    businessModel: simResult.businessModel,
    storeId: simResult.storeId,
    verdict: semantic.verdict,
    accuracyPct: semantic.accuracyPct,
    avgQualityPct: avgQuality,
    avgConfidencePct: avgConfidence,
    avgExplainabilityPct: avgExplainability,
    avgValidationPct: avgValidation,
    businessModelCompliancePct,
    passCount: semantic.passCount,
    warnCount: semantic.warnCount,
    failCount: semantic.failCount,
    forbiddenHits: semantic.forbiddenHits,
    driftFlags: drift ? [drift.message] : [],
    performance: simResult.performance,
    metadata: { analyzerCount: simResult.analyzerCount },
    createdAt: new Date().toISOString(),
  };

  await persistQualityRun(summary);

  const enriched: EnrichedQualityRunResult = {
    ...simResult,
    verdict: semantic.verdict,
    semantic,
    qualityRecords,
    summary,
    drift,
    avgQualityPct: avgQuality,
  };
  setLastEnrichedRun(enriched);
  return enriched;
}

export async function runQualitySimulation(input: {
  scenarioId: import("@/lib/simulation-lab/types").SimulationScenarioId;
  businessModel?: BusinessModel;
}): Promise<EnrichedQualityRunResult> {
  const sim = await runFullSimulation(input);
  return enrichSimulationWithQuality(sim);
}

export async function runLargeRegressionSuite(options?: {
  randomStoreCount?: number;
  businessModels?: BusinessModel[];
  releaseVersion?: string;
}): Promise<QualityLabReport> {
  const start = performance.now();
  const models = options?.businessModels ?? ALL_BUSINESS_MODELS;
  const randomCount = options?.randomStoreCount ?? 20;
  const runs: EnrichedQualityRunResult[] = [];

  for (const scenario of SIMULATION_SCENARIOS) {
    for (const businessModel of models) {
      runs.push(
        await runQualitySimulation({ scenarioId: scenario.id, businessModel }),
      );
    }
  }

  for (const store of generateRandomStores(randomCount, { seedBase: 42 })) {
    const sim = await runFullSimulation({
      scenarioId: "custom",
      businessModel: store.businessModel,
      customParams: store.params,
    });
    runs.push(await enrichSimulationWithQuality(sim));
  }

  const summaries = runs.map((r) => r.summary);
  const total = summaries.length;
  const passed = summaries.filter((s) => s.verdict === "pass").length;
  const accuracyPct = Math.round((passed / total) * 1000) / 10;

  const criticalRuns = runs.filter((r) =>
    CRITICAL_SCENARIOS.includes(r.scenarioId),
  );
  const criticalPassPct =
    criticalRuns.length > 0
      ? Math.round(
          (criticalRuns.filter((r) => r.verdict === "pass").length /
            criticalRuns.length) *
            1000,
        ) / 10
      : 100;

  const avgQuality = avg(summaries.map((s) => s.avgQualityPct));
  const avgCompliance = avg(
    summaries.map((s) => s.businessModelCompliancePct),
  );
  const validationCoverage = avg(summaries.map((s) => s.avgValidationPct));
  const driftFailures = summaries.filter((s) => s.driftFlags.length > 0).length;

  const gate = evaluateReleaseQualityGate({
    accuracyPct,
    businessModelCompliancePct: avgCompliance,
    validationCoveragePct: validationCoverage,
    criticalScenarioPassPct: criticalPassPct,
    avgQualityPct: avgQuality,
    driftFailures,
  });

  const benchmark = buildBenchmarkFromRuns(
    options?.releaseVersion ?? `build-${Date.now()}`,
    summaries,
    gate.passed,
  );
  recordQualityBenchmark(benchmark);

  const leaderboard = buildDecisionLeaderboard(
    runs.map((r) => ({
      decisions: r.qualityRecords.map((q) => q.decision),
      verdict: r.verdict,
    })),
  );

  return {
    generatedAt: new Date().toISOString(),
    accuracyPct,
    accuracyTrend: accuracyTrend(),
    totalRuns: total,
    recentRuns: summaries.slice(0, 30),
    avgQualityPct: avgQuality,
    gate,
    benchmark,
    leaderboard,
    driftAlerts: runs.filter((r) => r.drift).map((r) => r.drift!),
    performanceMs: Math.round(performance.now() - start),
  };
}

export async function runReplayQuality(input: {
  scenarioId: string;
  businessModel: BusinessModel;
  days?: number;
}): Promise<EnrichedQualityRunResult[]> {
  const scenario = getScenarioById(input.scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${input.scenarioId}`);
  const storeId = simulationStoreIdForModel(input.businessModel);
  const days = input.days ?? 90;
  const snapshots = buildReplaySnapshots({
    storeId,
    baseParams: scenario.params,
    days,
  });

  const results: EnrichedQualityRunResult[] = [];
  for (const day of snapshots) {
    const record: SimulationStoreRecord = {
      storeId,
      scenarioId: scenario.id as never,
      businessModel: input.businessModel,
      snapshot: day.snapshot,
      gate: buildSimulationValidationGate(storeId),
      generatedAt: day.date,
    };
    const sim = await runSimulationPipeline(record);
    const enriched = await enrichSimulationWithQuality(sim);
    enriched.summary.runType = "replay";
    enriched.summary.metadata = {
      ...enriched.summary.metadata,
      replayDay: day.day,
      replayDate: day.date,
    };
    results.push(enriched);
  }
  return results;
}

export function approveDriftBaseline(input: {
  scenarioId: string;
  businessModel: string;
  decisions: DecisionQaRecord[];
  releaseVersion?: string;
}): void {
  const intents = input.decisions[0]
    ? mapDecisionToIntents(input.decisions[0])
    : SCENARIO_EXPECTED_INTENTS[input.scenarioId] ?? [];
  setDriftBaseline({
    scenarioId: input.scenarioId,
    businessModel: input.businessModel,
    expectedIntents: intents,
    sampleDecisionSummary: input.decisions[0]?.summary,
    releaseVersion: input.releaseVersion,
  });
}

export { getDriftBaseline };

/** Full release gate — regression + thresholds for CI */
export async function runReleaseQualityGate(options?: {
  releaseVersion?: string;
  randomStoreCount?: number;
}): Promise<QualityLabReport> {
  const report = await runLargeRegressionSuite({
    randomStoreCount: options?.randomStoreCount ?? 10,
    releaseVersion: options?.releaseVersion ?? process.env.npm_package_version ?? "local",
  });
  if (report.gate && !report.gate.passed) {
    throw new Error(report.gate.message);
  }
  return report;
}
