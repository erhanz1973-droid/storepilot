import { buildProductIntelligence } from "@/lib/products/engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { evaluateOpportunities } from "@/lib/opportunities/engine";
import { buildProfitDecisionEngine } from "@/lib/decisions/profit-engine";
import { buildDecisionEngine } from "@/lib/decisions/engine";
import { enrichDecisionsWithQa } from "@/lib/decisions/qa/enrich";
import { buildDecisionPackContext } from "@/lib/decision-packs/registry";
import { runBusinessModelAwareAnalyzers } from "@/lib/recommendations/registry";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildStoreManagerDashboard } from "@/lib/services/store-manager";
import { buildPriorityQueue } from "@/lib/insights/priority";
import { sortCommerceOpportunities } from "@/lib/insights/opportunity-schema";
import { buildInventoryForecasts } from "@/lib/autopilot/forecast";
import { buildPredictiveInsights } from "@/lib/predictions/engine";
import { runContinuousMonitors } from "@/lib/monitoring/engine";
import {
  analyzerOutputToRecommendation,
  computeHealthScore,
} from "@/lib/recommendations/registry";
import { computeInventorySummary } from "@/lib/inventory/summary";
import { hasActiveAdsConnector } from "@/lib/connectors/active";
import { countActiveCampaigns } from "@/lib/meta/campaign-stats";
import type { BusinessModel } from "@/lib/business-model/types";
import { generateSimulationSnapshot } from "./generator";
import { buildSimulationValidationGate } from "./validation-gate";
import {
  buildSimulationBusinessProfile,
  buildSimulationMerchantDna,
} from "./simulation-profile";
import { evaluateExpectedDecisions } from "./evaluator";
import { getScenarioById, DROPSHIPPING_FORBIDDEN_KEYWORDS } from "./scenarios";
import { simulationStoreIdForScenario } from "./store-ids";
import { buildCustomScenarioParams } from "./custom-scenario";
import type {
  CustomScenarioInput,
  SimulationRunResult,
  SimulationScenarioId,
  SimulationStoreRecord,
} from "./types";

const PERF_TARGETS = {
  generationMs: 3000,
  decisionEngineMs: 1000,
  validationMs: 3000,
};

function newRunId(): string {
  return `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateSimulationDataset(input: {
  scenarioId: SimulationScenarioId;
  businessModel?: BusinessModel;
  customParams?: Partial<import("./types").ScenarioParams>;
  customInput?: CustomScenarioInput;
}): SimulationStoreRecord {
  const genStart = performance.now();
  const scenario = getScenarioById(input.scenarioId);
  if (!scenario && input.scenarioId !== "custom") {
    throw new Error(`Unknown scenario: ${input.scenarioId}`);
  }

  const businessModel =
    input.businessModel ??
    input.customInput?.businessModel ??
    scenario?.defaultBusinessModel ??
    "own_inventory";

  const params =
    input.scenarioId === "custom" && input.customInput
      ? buildCustomScenarioParams(input.customInput)
      : {
          ...(scenario?.params ?? buildCustomScenarioParams(input.customInput!)),
          ...input.customParams,
        };

  const storeId = simulationStoreIdForScenario(input.scenarioId, businessModel);
  const snapshot = generateSimulationSnapshot(storeId, params);
  const gate = buildSimulationValidationGate(storeId);
  const generationMs = Math.round(performance.now() - genStart);

  return {
    storeId,
    scenarioId: input.scenarioId,
    businessModel,
    snapshot,
    gate,
    generatedAt: new Date().toISOString(),
    customParams: input.customParams,
  };
}

export async function runSimulationPipeline(
  record: SimulationStoreRecord,
  options?: { forbiddenKeywords?: string[] },
): Promise<SimulationRunResult> {
  const logs: string[] = [];
  const totalStart = performance.now();
  const scenario = getScenarioById(record.scenarioId);
  const scenarioLabel =
    record.scenarioId === "custom"
      ? "Custom Scenario"
      : (scenario?.label ?? record.scenarioId);

  const validationStart = performance.now();
  const { snapshot, gate, storeId, businessModel } = record;
  const validationMs = Math.round(performance.now() - validationStart);
  logs.push(`Validation gate: ${gate.trustedProviderIds.length} trusted providers`);

  const costRecords: import("@/lib/db/product-costs").ProductCostRecord[] = [];
  const profitDashboard = computeProfitDashboard(snapshot, costRecords);
  const productIntelligence = buildProductIntelligence(snapshot, costRecords, profitDashboard);
  const attributionDashboard = buildAttributionDashboard(snapshot, profitDashboard);
  const inventorySummary = computeInventorySummary(snapshot.products);
  const adsConnected = hasActiveAdsConnector(snapshot.connectorStates);
  const activeMetaCampaigns = countActiveCampaigns(snapshot.campaigns);

  const analyzerStart = performance.now();
  const analyzerOutputs = runBusinessModelAwareAnalyzers(
    snapshot,
    gate,
    buildDecisionPackContext({ businessModel }).pack,
  );
  const analyzerCount = analyzerOutputs.length;
  logs.push(`Analyzers: ${analyzerCount} outputs (${Math.round(performance.now() - analyzerStart)}ms)`);

  const now = new Date().toISOString();
  const activeRecs = analyzerOutputs.map((o, i) =>
    analyzerOutputToRecommendation(o, now, `sim-rec-${i}`),
  );

  const { score: healthScore } = computeHealthScore(activeRecs, inventorySummary, {
    hasActiveAdsConnector: adsConnected,
    hasActiveMetaCampaigns: activeMetaCampaigns > 0,
  });

  const topOpportunities = evaluateOpportunities(snapshot, {
    limit: 8,
    netMarginPct: profitDashboard?.primary.profitMarginPct ?? undefined,
    extra: [
      ...(productIntelligence?.productOpportunities ?? []),
      ...(attributionDashboard?.attributionOpportunities ?? []),
    ],
  });

  const storeManager = await buildStoreManagerDashboard({
    snapshot,
    profitDashboard,
    dataSources: [],
    storeId,
    storeHealthScore: healthScore,
    topOpportunities,
    criticalAlerts: activeRecs.filter((r) => r.severity === "critical"),
  });

  const adjustedFeed = sortCommerceOpportunities(storeManager.opportunityFeed ?? []);
  const adjustedPriorityQueue = buildPriorityQueue(
    adjustedFeed,
    topOpportunities,
    activeRecs.filter((r) => r.severity === "critical"),
  );

  const netMargin = profitDashboard?.primary.profitMarginPct ?? 38;
  const inventoryForecasts = buildInventoryForecasts(snapshot.products, netMargin);
  const predictiveInsights = buildPredictiveInsights({
    snapshot,
    profitDashboard,
    attributionDashboard,
    inventoryForecasts,
  });

  const aiEvents = runContinuousMonitors({
    syncedAt: snapshot.syncedAt,
    snapshot,
    profitDashboard,
    productIntelligence,
    attributionDashboard,
    opportunities: adjustedFeed,
    predictiveInsights,
  });

  const businessProfile = buildSimulationBusinessProfile(
    storeId,
    businessModel,
    snapshot,
    profitDashboard,
  );
  const decisionPackContext = buildDecisionPackContext({ businessModel });
  const merchantDna = buildSimulationMerchantDna(
    storeId,
    businessModel,
    snapshot,
    profitDashboard,
  );

  const profitEngine = buildProfitDecisionEngine({
    snapshot,
    profitDashboard: profitDashboard!,
    merchantMode: "profit",
    enableInventoryStrategies: decisionPackContext.pack.enableInventoryStrategies,
  });
  const profitStrategiesByProductId = new Map(
    profitEngine.slowProductStrategies.map((s) => [s.productId, s]),
  );

  const engineStart = performance.now();
  const rawDecisions = buildDecisionEngine({
    priorityQueue: adjustedPriorityQueue,
    opportunities: adjustedFeed,
    recommendations: activeRecs,
    aiEvents,
    opportunityHistory: [],
    allRecommendations: activeRecs,
    metaConnected: true,
    shopifyConnected: true,
    shopifyScopes: ["read_products", "read_orders"],
    shopifyShopDomain: snapshot.commerceStoreDomain ?? null,
    campaigns: snapshot.campaigns,
    products: snapshot.products,
    collections: snapshot.collections,
    outcomeRecords: [],
    validationGate: gate,
    recommendationAudits: [],
    merchantMode: "profit",
    profitStrategiesByProductId,
    businessProfile,
    decisionPackContext,
    merchantDna,
  });
  const decisions = enrichDecisionsWithQa(rawDecisions);
  const decisionEngineMs = Math.round(performance.now() - engineStart);
  logs.push(`Decision engine: ${decisions.length} decisions in ${decisionEngineMs}ms`);

  const forbidden =
    businessModel === "dropshipping"
      ? [...DROPSHIPPING_FORBIDDEN_KEYWORDS, ...(options?.forbiddenKeywords ?? [])]
      : (options?.forbiddenKeywords ?? scenario?.forbiddenDecisionKeywords ?? []);

  const evaluation = evaluateExpectedDecisions(
    decisions,
    scenario?.expectedDecisions ?? [],
    forbidden,
    { scenarioId: record.scenarioId, businessModel },
  );

  const totalMs = Math.round(performance.now() - totalStart);
  const withinTargets =
    decisionEngineMs < PERF_TARGETS.decisionEngineMs &&
    validationMs < PERF_TARGETS.validationMs;

  return {
    runId: newRunId(),
    scenarioId: record.scenarioId,
    scenarioLabel,
    businessModel,
    storeId,
    verdict: evaluation.verdict,
    passCount: evaluation.passCount,
    warnCount: evaluation.warnCount,
    failCount: evaluation.failCount,
    decisionMatches: evaluation.matches,
    forbiddenHits: evaluation.forbiddenHits,
    decisions,
    analyzerCount,
    performance: {
      generationMs: 0,
      validationMs,
      decisionEngineMs,
      totalMs,
      withinTargets,
    },
    generatedAt: new Date().toISOString(),
    logs,
  };
}

export async function runFullSimulation(input: {
  scenarioId: SimulationScenarioId;
  businessModel?: BusinessModel;
  customParams?: Partial<import("./types").ScenarioParams>;
  customInput?: CustomScenarioInput;
}): Promise<SimulationRunResult> {
  const genStart = performance.now();
  const record = generateSimulationDataset(input);
  const result = await runSimulationPipeline(record);
  result.performance.generationMs = Math.round(performance.now() - genStart);
  result.performance.totalMs =
    result.performance.generationMs +
    result.performance.validationMs +
    result.performance.decisionEngineMs;
  result.performance.withinTargets =
    result.performance.generationMs < PERF_TARGETS.generationMs &&
    result.performance.decisionEngineMs < PERF_TARGETS.decisionEngineMs &&
    result.performance.validationMs < PERF_TARGETS.validationMs;
  return result;
}
