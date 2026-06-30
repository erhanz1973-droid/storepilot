import { buildDecisionEngine } from "@/lib/decisions/engine/pipeline";
import type { DecisionEngineInput } from "@/lib/decisions/engine/types";
import { buildBetaReadinessReport } from "./beta-readiness";
import {
  consistencyAllPassed,
  runConsistencyChecks,
} from "./consistency";
import { filterMerchantReadyDecisions } from "./completeness";
import { enrichDecisionsWithQa } from "./enrich";
import { createPerformanceTimer } from "./performance";
import {
  productionAllPassed,
  runProductionChecklist,
} from "./production-checklist";
import { runScenarioTests } from "./scenario-runner";
import type { DecisionEngineQaReport, DecisionQaRecord } from "./types";
import { MERCHANT_QUALITY_THRESHOLD } from "./types";

export type RunDecisionQaInput = DecisionEngineInput & {
  storeId: string;
  validationMs?: number;
  strategySimulationMs?: number;
};

export function runDecisionEngineWithQa(
  input: RunDecisionQaInput,
): DecisionEngineQaReport {
  const timer = createPerformanceTimer();
  const t0 = performance.now();

  const raw = buildDecisionEngine(input);
  const decisionCenterMs = performance.now() - t0;

  const t1 = performance.now();
  const qaRecords = enrichDecisionsWithQa(raw);
  const qaMs = performance.now() - t1;

  const merchantReady = filterMerchantReadyDecisions(qaRecords, {
    minQualityPct: MERCHANT_QUALITY_THRESHOLD,
  }) as DecisionQaRecord[];
  const incomplete = qaRecords.filter((d) => d.completenessStatus === "incomplete");

  const consistency = runConsistencyChecks(qaRecords);
  const production = runProductionChecklist(qaRecords);
  const scenarioResults = runScenarioTests();

  const performanceReport = timer.finish();
  performanceReport.decisionCenterMs = Math.round(decisionCenterMs);
  performanceReport.qaMs = Math.round(qaMs);
  performanceReport.validationMs = input.validationMs;
  performanceReport.strategySimulationMs = input.strategySimulationMs;

  const metaConnected = input.metaConnected ?? false;
  const shopifyConnected = input.shopifyConnected ?? false;
  const googleConnected =
    input.validationGate?.providers?.some(
      (p) => p.providerId === "google" && p.connected,
    ) ?? false;

  return {
    generatedAt: new Date().toISOString(),
    storeId: input.storeId,
    merchantMode: input.merchantMode ?? "profit",
    decisions: qaRecords,
    merchantReady,
    incomplete,
    consistency,
    consistencyPassed: consistencyAllPassed(consistency),
    production,
    productionPassed: productionAllPassed(production),
    performance: performanceReport,
    scenarioResults,
    betaReadiness: buildBetaReadinessReport(
      {
        consistencyPassed: consistencyAllPassed(consistency),
        productionPassed: productionAllPassed(production),
        performance: performanceReport,
        scenarioResults,
        merchantReady,
        decisions: qaRecords,
      },
      {
        validationReady: input.validationGate?.canGenerateRecommendations ?? false,
        shopifyConnected,
        metaConnected,
        googleConnected,
      },
    ),
  };
}

/** Stable ranking signature for regression snapshots */
export function decisionRankingSignature(
  decisions: DecisionQaRecord[],
): string[] {
  return decisions.map(
    (d) =>
      `${d.problemKey}|${d.priority}|${d.recommendedAction}|${d.qualityScorePct}`,
  );
}
