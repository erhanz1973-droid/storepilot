import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { enrichStrategyPlanSync } from "@/lib/attribution/recommendation-trust";
import { buildCustomerIntelligence } from "@/lib/customers/engine";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { buildUnifiedExecutiveBrief } from "@/lib/insights/unified-executive-brief";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildProductIntelligence } from "@/lib/products/engine";
import { evaluateOpportunities } from "@/lib/opportunities/engine";
import { computeInventorySummary } from "@/lib/inventory/summary";
import type { DashboardSnapshot } from "@/lib/types";
import { describe, expect, it } from "vitest";

describe("unified executive brief", () => {
  const snapshot = getPeakOutfittersSnapshot();
  const profitDashboard = computeProfitDashboard(snapshot, [])!;
  const attributionRaw = buildAttributionDashboard(snapshot, profitDashboard)!;
  const strategyPlan = enrichStrategyPlanSync({
    plan: attributionRaw.strategyPlan,
    confidence: attributionRaw.confidence,
    syncedAt: snapshot.syncedAt,
    snapshot,
    acquisition: attributionRaw.acquisition,
    journeyCount: attributionRaw.sampleJourneys.length,
    paidCampaignCount: attributionRaw.campaigns.filter((c) => c.adSpend > 50).length,
    conversionStable: true,
  });
  const productIntelligence = buildProductIntelligence(snapshot, [], profitDashboard);
  const customerIntelligence = buildCustomerIntelligence({
    snapshot,
    attribution: { ...attributionRaw, strategyPlan },
    profitDashboard,
  });

  const dashboard = {
    profitDashboard,
    attributionDashboard: { ...attributionRaw, strategyPlan },
    productIntelligence,
    inventorySummary: computeInventorySummary(snapshot.products),
    topOpportunities: evaluateOpportunities(snapshot, {
      limit: 8,
      extra: [
        ...(productIntelligence?.productOpportunities ?? []),
        ...(attributionRaw.attributionOpportunities ?? []),
      ],
    }),
    storeHealth: { score: 62, label: "Fair" as const, factors: [], changes: [] },
    decisionCenter: [],
    lastAnalyzedAt: snapshot.syncedAt,
  } as unknown as DashboardSnapshot;

  const brief = buildUnifiedExecutiveBrief({
    dashboard,
    snapshot,
    customerIntelligence,
  });

  it("aggregates attribution and profit recommendations instead of showing zero", () => {
    expect(brief.opportunityCount).toBeGreaterThan(0);
    expect(brief.estimatedMonthlyRecovery).toBeGreaterThan(1000);
    expect(brief.highestPriority?.title.length).toBeGreaterThan(5);
  });

  it("does not report healthy when store is unprofitable", () => {
    expect(brief.businessHealth.status).not.toBe("healthy");
    expect(brief.businessHealth.message.toLowerCase()).not.toContain("looks healthy");
  });

  it("includes priority breakdown", () => {
    expect(brief.byPriority.high + brief.byPriority.medium + brief.byPriority.critical).toBeGreaterThan(
      0,
    );
  });

  it("lists other opportunities below the highest priority", () => {
    expect(brief.otherOpportunities.length).toBeGreaterThan(0);
    expect(brief.otherOpportunities[0]?.priorityScore).toBeLessThanOrEqual(
      brief.highestPriority!.priorityScore,
    );
  });
});
