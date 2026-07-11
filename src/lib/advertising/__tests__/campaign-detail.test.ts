import { describe, expect, it } from "vitest";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildMarketingManagerView } from "@/lib/analytics/marketing-manager";
import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildAdvertisingWorkspace } from "@/lib/advertising/build-workspace";
import { buildCampaignDetailPage } from "@/lib/advertising/build-campaign-detail";
import { buildOptimizationPackages } from "@/lib/advertising/optimization-packages";

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
  const workspace = buildAdvertisingWorkspace({
    marketing,
    attribution,
    snapshot,
    decisions: [],
    syncedAt: snapshot.syncedAt,
  });
  return { workspace, marketing, attribution, snapshot };
}

describe("buildOptimizationPackages", () => {
  it("consolidates multiple campaign recommendations into one package", () => {
    const { workspace } = buildFixture();
    const packages = buildOptimizationPackages(workspace.optimizationCenter);
    const multiStep = packages.find((p) => p.isPackage && p.steps.length >= 2);
    expect(multiStep).toBeDefined();
    expect(multiStep!.expectedProfitMonthly).toBeGreaterThan(0);
  });
});

describe("buildCampaignDetailPage", () => {
  it("builds full detail workspace for an existing campaign", () => {
    const { workspace, marketing, attribution, snapshot } = buildFixture();
    const campaignId = workspace.campaigns[0]!.id;
    const detail = buildCampaignDetailPage(campaignId, {
      workspace,
      marketing,
      attribution,
      snapshot,
      decisions: [],
    });
    expect(detail).not.toBeNull();
    expect(detail!.campaign.id).toBe(campaignId);
    expect(detail!.executiveSummary).toBeTruthy();
    expect(detail!.healthFactors.length).toBeGreaterThan(0);
    expect(detail!.performanceOverview.spend).toBeGreaterThanOrEqual(0);
  });

  it("returns null for unknown campaign", () => {
    const { workspace, marketing, attribution, snapshot } = buildFixture();
    const detail = buildCampaignDetailPage("unknown-id", {
      workspace,
      marketing,
      attribution,
      snapshot,
      decisions: [],
    });
    expect(detail).toBeNull();
  });
});
