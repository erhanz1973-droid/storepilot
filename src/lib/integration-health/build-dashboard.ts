import { getDataSourceStatuses } from "@/lib/connectors/registry";
import { buildIntegrationHealth } from "@/lib/integrations/health";
import { buildValidationGateReport } from "@/lib/recommendations/validation/gate";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";
import { runAiCapabilityTests } from "./ai-capability-tests";
import { dataQualityScore, runDataQualityChecks } from "./data-quality";
import { buildCapabilityMatrix, buildMissingDataBlocks } from "./missing-data";
import { buildModuleReadiness, overallReadinessPct } from "./module-readiness";
import { buildProviderHealthDetails } from "./provider-details";
import { buildSyncMonitoring } from "./sync-monitoring";
import { buildAiTrustSummary, buildSystemSummary } from "./trust-summary";
import { runIntegrationTestSuite } from "./test-suite";
import type { IntegrationHealthDashboard } from "./types";

export async function buildIntegrationHealthDashboard(options?: {
  storeId?: string;
  runTests?: boolean;
}): Promise<IntegrationHealthDashboard> {
  const bundle = await getCachedStoreBundle();
  const storeId = options?.storeId ?? bundle.storeId;
  const dataSources = await getDataSourceStatuses(storeId);
  const cards = await buildIntegrationHealth(bundle.snapshot, dataSources, storeId);
  const gate = await buildValidationGateReport(storeId, bundle.snapshot.connectorStates ?? {});

  const qualityIssues = runDataQualityChecks(bundle.snapshot, bundle.profitDashboard);
  const qualityPct = dataQualityScore(qualityIssues);

  const providers = await buildProviderHealthDetails({
    cards,
    snapshot: bundle.snapshot,
    validationProviders: gate.providers,
    storeId,
    profitDashboard: bundle.profitDashboard,
  });

  const aiCapabilityTests = runAiCapabilityTests({
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
    canGenerateRecommendations: gate.canGenerateRecommendations,
  });

  const moduleReadiness = buildModuleReadiness({
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
    gate,
    overallQualityPct: qualityPct,
  });

  const overallAiReadinessPct = overallReadinessPct(moduleReadiness);
  const missingDataBlocks = buildMissingDataBlocks(bundle.snapshot, moduleReadiness);
  const capabilityMatrix = buildCapabilityMatrix(moduleReadiness, missingDataBlocks);

  const canAiTrustData =
    gate.canGenerateRecommendations &&
    qualityIssues.every((i) => i.severity !== "critical") &&
    overallAiReadinessPct >= 60;

  const aiTrust = buildAiTrustSummary({
    overallAiReadinessPct,
    dataQualityPct: qualityPct,
    gate,
    providers,
    missingBlocks: missingDataBlocks,
    qualityIssues,
    capabilityMatrix,
  });

  const systemSummary = buildSystemSummary({
    providers,
    dataQualityPct: qualityPct,
    overallAiReadinessPct,
    capabilityMatrix,
    gate,
    generatedAt: new Date().toISOString(),
    testSuiteRanAt: null,
  });

  const base: IntegrationHealthDashboard = {
    generatedAt: new Date().toISOString(),
    storeId,
    aiTrust,
    systemSummary,
    overallAiReadinessPct,
    dataQualityPct: qualityPct,
    canAiTrustData,
    providers,
    moduleReadiness,
    dataQualityIssues: qualityIssues,
    aiCapabilityTests,
    capabilityMatrix,
    missingDataBlocks,
    syncMonitoring: buildSyncMonitoring(cards),
    testSuite: [],
    testSuiteRanAt: null,
  };

  if (options?.runTests) {
    const testSuite = await runIntegrationTestSuite(storeId, base);
    return {
      ...base,
      testSuite,
      testSuiteRanAt: new Date().toISOString(),
      systemSummary: buildSystemSummary({
        providers,
        dataQualityPct: qualityPct,
        overallAiReadinessPct,
        capabilityMatrix,
        gate,
        generatedAt: base.generatedAt,
        testSuiteRanAt: new Date().toISOString(),
      }),
    };
  }

  return base;
}
