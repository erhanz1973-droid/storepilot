import { describe, expect, it } from "vitest";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildMarketingManagerView } from "@/lib/analytics/marketing-manager";
import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildAdvertisingWorkspace } from "@/lib/advertising/build-workspace";
import {
  buildAiAccountabilityLayer,
  buildDailyPriority,
  buildExpertNarrative,
  buildSinceLastVisitBriefing,
  buildTrustEngine,
} from "@/lib/advertising/build-ai-accountability";

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
  return {
    workspace: buildAdvertisingWorkspace({
      marketing,
      attribution,
      snapshot,
      decisions: [],
      syncedAt: snapshot.syncedAt,
    }),
    snapshot,
    profitDashboard,
  };
}

describe("build-ai-accountability", () => {
  it("builds daily priority from top optimization package", () => {
    const { workspace } = buildFixture();
    const priority = buildDailyPriority(workspace);
    expect(priority.title).toBe("Today's highest priority");
    expect(priority.expectedMonthlyImpact).toBeGreaterThan(0);
    expect(priority.narrative).toContain("10 minutes");
  });

  it("builds since-last-visit briefing when previous snapshot exists", () => {
    const { workspace } = buildFixture();
    const briefing = buildSinceLastVisitBriefing(workspace, {
      visitedAt: new Date(Date.now() - 86400000).toISOString(),
      healthScore: workspace.overview.healthScore + 15,
      profit30d: workspace.campaigns.reduce((s, c) => s + c.profit, 0) - 500,
      criticalCampaignCount: workspace.campaigns.filter((c) => c.healthTier === "critical").length + 1,
      opportunityCount: 0,
      blendedRoas: workspace.overview.blendedRoas - 0.3,
    });
    expect(briefing.isFirstVisit).toBe(false);
    expect(briefing.items.length).toBeGreaterThan(0);
  });

  it("builds trust engine with connected sources", () => {
    const { workspace, snapshot } = buildFixture();
    const trust = buildTrustEngine({ workspace, snapshot });
    expect(trust.dataQualityPct).toBeGreaterThan(0);
    expect(trust.connectedSources.length).toBeGreaterThan(0);
    expect(trust.historicalCoverageDays).toBeGreaterThanOrEqual(30);
  });

  it("uses expert manager voice in narrative", () => {
    const { workspace } = buildFixture();
    const narrative = buildExpertNarrative(workspace);
    expect(narrative.length).toBeGreaterThan(40);
  });

  it("builds full accountability layer with demo fallbacks", () => {
    const { workspace, snapshot, profitDashboard } = buildFixture();
    const layer = buildAiAccountabilityLayer({
      workspace,
      snapshot,
      profitDashboard,
      decisions: [],
      rejections: [],
      outcomes: [],
      previousVisit: null,
    });
    expect(layer.dailyPriority).toBeDefined();
    expect(layer.trustEngine).toBeDefined();
    expect(layer.accountabilityItems.length).toBeGreaterThan(0);
    expect(layer.learningInsight).toBeDefined();
    expect(layer.predictionTrackRecord.overallAccuracyPct).toBeGreaterThan(0);
  });
});

describe("buildAdvertisingWorkspace accountability", () => {
  it("includes accountability layer", () => {
    const { workspace } = buildFixture();
    expect(workspace.accountability.dailyPriority).toBeDefined();
    expect(workspace.accountability.trustEngine.dataQualityPct).toBeGreaterThan(0);
  });
});
