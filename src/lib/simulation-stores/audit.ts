import type { StoreSnapshot } from "@/lib/connectors/types";
import { getVerifiedStoreData } from "@/lib/recommendations/validation";
import { runValidationSuite } from "@/lib/validation/runner";
import { getScenarioById } from "@/lib/simulation-lab/scenarios";
import { generateSimulationDataset, runSimulationPipeline } from "@/lib/simulation-lab/runner";
import { loadSimulationSnapshot } from "./load";
import { getSimulationStoreById } from "./db";
import type { SimulationVerdict } from "@/lib/simulation-lab/types";
import { auditProductAdAttribution } from "./product-ad-audit";
import type { SimulationAuditCheck, SimulationAuditReport } from "./audit-types";

export type {
  AuditCheckStatus,
  SimulationAuditCheck,
  SimulationAuditReport,
  ProductAdAuditResult,
} from "./audit-types";

function roas(spend: number, revenue: number): number {
  if (spend <= 0) return 0;
  return Math.round((revenue / spend) * 100) / 100;
}

function near(a: number, b: number, tolerancePct = 0.05): boolean {
  if (b === 0) return a === 0;
  return Math.abs(a - b) / Math.abs(b) <= tolerancePct;
}

function validateSnapshotData(snapshot: StoreSnapshot): SimulationAuditCheck[] {
  const checks: SimulationAuditCheck[] = [];
  const metrics = snapshot.storeMetrics;

  const metaRollup = snapshot.metaAccountRollups?.last7d;
  const metaSpendRollup = metaRollup?.spend ?? 0;
  const metaRevRollup = metaRollup?.attributedRevenue ?? 0;
  const campaignSpend = snapshot.campaigns.reduce((s, c) => s + c.spend7d, 0);
  const campaignRev = snapshot.campaigns.reduce((s, c) => s + c.revenue7d, 0);

  if (snapshot.campaigns.length === 0) {
    checks.push({
      id: "meta_campaigns",
      label: "Meta campaigns",
      status: "warn",
      detail: "No Meta campaigns in snapshot",
    });
  } else {
    checks.push({
      id: "meta_campaign_spend",
      label: "Meta spend consistency",
      status: near(campaignSpend, metaSpendRollup) ? "pass" : "warn",
      detail: `Campaigns $${campaignSpend.toFixed(0)} vs rollups $${metaSpendRollup.toFixed(0)}`,
    });
    checks.push({
      id: "meta_roas",
      label: "Meta ROAS",
      status: metaSpendRollup > 0 ? "pass" : "warn",
      detail: `ROAS ${roas(metaSpendRollup, metaRevRollup)} (${metaRevRollup.toFixed(0)} / ${metaSpendRollup.toFixed(0)})`,
    });
  }

  const google = snapshot.googleAdsSnapshot;
  const googleSpend = google?.rollups.last7d.spend ?? 0;
  const googleRev = google?.rollups.last7d.attributedRevenue ?? 0;
  if (!google?.campaigns.length) {
    checks.push({
      id: "google_campaigns",
      label: "Google Ads campaigns",
      status: "warn",
      detail: "No Google campaigns in snapshot",
    });
  } else {
    const gSpend = google.campaigns.reduce((s, c) => s + c.spend7d, 0);
    checks.push({
      id: "google_spend",
      label: "Google spend consistency",
      status: near(gSpend, googleSpend) ? "pass" : "warn",
      detail: `Campaigns $${gSpend.toFixed(0)} vs rollups $${googleSpend.toFixed(0)}`,
    });
    checks.push({
      id: "google_roas",
      label: "Google ROAS",
      status: googleSpend > 0 ? "pass" : "warn",
      detail: `ROAS ${roas(googleSpend, googleRev)}`,
    });
  }

  const expectedAov =
    metrics.orders30d > 0 ? metrics.revenue30d / metrics.orders30d : 0;
  checks.push({
    id: "aov",
    label: "Revenue / orders / AOV",
    status: near(metrics.aov30d, expectedAov, 0.02) ? "pass" : "fail",
    detail: `Revenue $${metrics.revenue30d} / ${metrics.orders30d} orders → AOV $${metrics.aov30d.toFixed(2)} (expected ~$${expectedAov.toFixed(2)})`,
  });

  const negativeInv = snapshot.products.filter((p) => (p.inventoryQuantity ?? 0) < 0);
  checks.push({
    id: "inventory",
    label: "Inventory",
    status: negativeInv.length === 0 ? "pass" : "fail",
    detail:
      negativeInv.length === 0
        ? `${snapshot.products.length} products, no negative stock`
        : `${negativeInv.length} SKU(s) with negative inventory`,
  });

  if (snapshot.ga4Snapshot) {
    checks.push({
      id: "ga4",
      label: "GA4 traffic",
      status: snapshot.ga4Snapshot.sessions30d > 0 ? "pass" : "warn",
      detail: `${snapshot.ga4Snapshot.sessions30d.toLocaleString()} sessions (30d)`,
    });
  }

  return checks;
}

/** Full audit: ad data consistency + validation gate + decision correctness. */
export async function auditSimulationStore(storeId: string): Promise<SimulationAuditReport> {
  const store = await getSimulationStoreById(storeId);
  if (!store) throw new Error("Simulation store not found");

  const persisted = await loadSimulationSnapshot(storeId);
  if (!persisted) {
    throw new Error("No persisted data — regenerate the store first");
  }

  const scenario = getScenarioById(store.scenarioId);
  const scenarioLabel = scenario?.label ?? store.scenarioId;

  const { snapshot, gate } = await getVerifiedStoreData(storeId);
  const dataChecks = validateSnapshotData(snapshot);
  const productAdAudit = auditProductAdAttribution(snapshot);
  const allDataChecks = [...dataChecks, ...productAdAudit.checks];

  const metaRollup = snapshot.metaAccountRollups?.last7d;
  const googleRollup = snapshot.googleAdsSnapshot?.rollups.last7d;

  const record = generateSimulationDataset({
    scenarioId: store.scenarioId,
    businessModel: store.businessModel,
  });
  record.storeId = storeId;
  record.snapshot = snapshot;
  record.gate = gate;

  const pipeline = await runSimulationPipeline(record);

  const validationReport = await runValidationSuite({ storeId, includeIntegrations: false });

  const dataFailCount = allDataChecks.filter((c) => c.status === "fail").length;
  let overallVerdict: SimulationVerdict = pipeline.verdict;
  if (dataFailCount > 0) overallVerdict = "fail";
  else if (
    !gate.canGenerateRecommendations ||
    validationReport.failed > 0 ||
    pipeline.failCount > 0
  ) {
    overallVerdict = "fail";
  } else if (
    allDataChecks.some((c) => c.status === "warn") ||
    pipeline.warnCount > 0 ||
    validationReport.warned > 0
  ) {
    overallVerdict = "warn";
  }

  return {
    storeId,
    slug: store.slug,
    scenarioId: store.scenarioId,
    scenarioLabel,
    auditedAt: new Date().toISOString(),
    dataChecks: allDataChecks,
    gate: {
      canGenerateRecommendations: gate.canGenerateRecommendations,
      overallMatchPercent: gate.overallMatchPercent,
      trustedProviderIds: gate.trustedProviderIds,
      blockedProviderIds: gate.blockedProviderIds,
    },
    adMetrics: {
      metaSpend7d: metaRollup?.spend ?? 0,
      metaRevenue7d: metaRollup?.attributedRevenue ?? 0,
      metaRoas7d: roas(metaRollup?.spend ?? 0, metaRollup?.attributedRevenue ?? 0),
      googleSpend7d: googleRollup?.spend ?? 0,
      googleRevenue7d: googleRollup?.attributedRevenue ?? 0,
      googleRoas7d: roas(googleRollup?.spend ?? 0, googleRollup?.attributedRevenue ?? 0),
      revenue30d: snapshot.storeMetrics.revenue30d,
      orders30d: snapshot.storeMetrics.orders30d,
      campaignCount: snapshot.campaigns.length,
    },
    decisions: {
      verdict: pipeline.verdict,
      passCount: pipeline.passCount,
      warnCount: pipeline.warnCount,
      failCount: pipeline.failCount,
      decisionCount: pipeline.decisions.length,
      matches: pipeline.decisionMatches.map((m) => ({
        expectedLabel: m.expectedLabel,
        verdict: m.verdict,
        reason: m.reason,
        actualSummary: m.actualSummary,
      })),
      forbiddenHits: pipeline.forbiddenHits,
      samples: pipeline.decisions.slice(0, 5).map((d) => ({
        summary: d.summary,
        why: d.why,
        recommendedAction: d.recommendedAction,
      })),
    },
    validationSuite: {
      passed: validationReport.passed,
      failed: validationReport.failed,
      warned: validationReport.warned,
      readyForLaunch: validationReport.goNoGo.readyForLaunch,
      blockers: validationReport.goNoGo.blockers,
    },
    productAdAudit,
    overallVerdict,
  };
}
