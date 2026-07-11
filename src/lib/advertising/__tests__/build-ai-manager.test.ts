import { describe, expect, it } from "vitest";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildMarketingManagerView } from "@/lib/analytics/marketing-manager";
import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildAdvertisingWorkspace } from "@/lib/advertising/build-workspace";
import {
  buildAiManagerSummary,
  buildCampaignSpotlights,
  buildCampaignSpotlights,
  buildHealthExplanations,
  enrichCreativesWithSuggestions,
  enrichPackagesWithSimulation,
} from "@/lib/advertising/build-ai-manager";

function buildFixture() {
  const snapshot = getPeakOutfittersSnapshot();
  const profitDashboard = computeProfitDashboard(snapshot, []);
  const productAttribution = buildProductAttributionDashboard(snapshot, [], profitDashboard);
  const marketing = buildMarketingManagerView({
    snapshot,
    profitDashboard,
    productAttribution,
    decisions: [],
  });
  const attribution = buildAttributionDashboard(snapshot, profitDashboard)!;
  return buildAdvertisingWorkspace({
    marketing,
    attribution,
    snapshot,
    decisions: [],
    syncedAt: snapshot.syncedAt,
  });
}

describe("build-ai-manager", () => {
  it("builds AI manager summary with insights and narrative", () => {
    const ws = buildFixture();
    const { topWinners, topLosers } = buildCampaignSpotlights(ws.campaigns, ws.timelines);
    const summary = buildAiManagerSummary({ ...ws, topWinners, topLosers });
    expect(summary.headline).toBe("AI Advertising Manager");
    expect(summary.campaignCount).toBeGreaterThan(0);
    expect(summary.intro).toContain("scanned");
    expect(summary.narrative.length).toBeGreaterThan(20);
    expect(summary.expectedMonthlyProfitImprovement).toBeGreaterThanOrEqual(0);
  });

  it("builds health explanations when score is low", () => {
    const ws = buildFixture();
    const explanations = buildHealthExplanations(ws);
    expect(explanations.length).toBeGreaterThan(0);
    expect(explanations[0]!.label).toBeTruthy();
  });

  it("builds winner and loser spotlights with timelines", () => {
    const ws = buildFixture();
    const { topWinners, topLosers } = buildCampaignSpotlights(ws.campaigns, ws.timelines);
    expect(topWinners.length).toBeGreaterThan(0);
    expect(topWinners[0]!.timelinePreview.length).toBeGreaterThan(0);
    if (topLosers.length > 0) {
      expect(topLosers[0]!.reason).toBeTruthy();
    }
  });

  it("enriches packages with simulation blocks", () => {
    const ws = buildFixture();
    const enriched = enrichPackagesWithSimulation(ws.optimizationPackages, ws.campaigns);
    expect(enriched[0]!.simulation).toBeDefined();
    expect(enriched[0]!.simulation!.narrative).toContain("If you apply");
  });

  it("enriches creatives with fatigue score and suggestions", () => {
    const ws = buildFixture();
    const enriched = enrichCreativesWithSuggestions(ws.creatives);
    expect(enriched[0]!.fatigueScore).toBeDefined();
    expect(enriched[0]!.suggestions?.estimatedUpliftPct).toBeGreaterThan(0);
  });
});

describe("buildAdvertisingWorkspace ai layer", () => {
  it("includes aiManager, spotlights, and enriched packages", () => {
    const ws = buildFixture();
    expect(ws.aiManager.headline).toBe("AI Advertising Manager");
    expect(ws.healthExplanations.length).toBeGreaterThan(0);
    expect(ws.topWinners.length).toBeGreaterThan(0);
    expect(ws.optimizationPackages[0]!.simulation).toBeDefined();
    expect(ws.creatives[0]!.suggestions).toBeDefined();
  });
});
