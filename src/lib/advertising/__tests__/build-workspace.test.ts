import { describe, expect, it } from "vitest";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildMarketingManagerView } from "@/lib/analytics/marketing-manager";
import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import {
  buildAdvertisingWorkspace,
  filterCampaigns,
  sortCampaigns,
} from "@/lib/advertising/build-workspace";

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

describe("buildAdvertisingWorkspace", () => {
  it("produces executive overview with health score and spend", () => {
    const ws = buildFixture();
    expect(ws.overview.healthScore).toBeGreaterThan(0);
    expect(ws.overview.spend30d).toBeGreaterThan(0);
    expect(ws.overview.blendedRoas).toBeGreaterThan(0);
    expect(ws.overview.aiConfidencePct).toBeGreaterThan(0);
  });

  it("includes all advertising platforms", () => {
    const ws = buildFixture();
    const ids = ws.platforms.map((p) => p.id);
    expect(ids).toContain("meta");
    expect(ids).toContain("google");
    expect(ids).toContain("tiktok");
    expect(ids).toContain("pinterest");
    expect(ids).toContain("microsoft");
  });

  it("builds campaign rows with health scores and recommendations", () => {
    const ws = buildFixture();
    expect(ws.campaigns.length).toBeGreaterThan(0);
    const first = ws.campaigns[0]!;
    expect(first.healthScore).toBeGreaterThanOrEqual(0);
    expect(first.healthScore).toBeLessThanOrEqual(100);
    expect(first.recommendationLabel).toBeTruthy();
    expect(first.platformLabel).toBeTruthy();
  });

  it("includes optimization recommendations", () => {
    const ws = buildFixture();
    expect(ws.optimizationCenter.length).toBeGreaterThan(0);
    expect(ws.optimizationCenter[0]!.expectedProfitMonthly).toBeDefined();
    expect(ws.optimizationPackages.length).toBeGreaterThan(0);
  });

  it("includes ai score and next action on campaigns", () => {
    const ws = buildFixture();
    const first = ws.campaigns[0]!;
    expect(first.aiScore).toBeGreaterThan(0);
    expect(first.nextAction).toBeTruthy();
  });

  it("includes health factor breakdown", () => {
    const ws = buildFixture();
    expect(ws.overview.healthFactors?.length).toBeGreaterThan(0);
  });

  it("includes AI manager layer", () => {
    const ws = buildFixture();
    expect(ws.aiManager).toBeDefined();
    expect(ws.topWinners.length).toBeGreaterThan(0);
    expect(ws.healthExplanations.length).toBeGreaterThan(0);
  });

  it("filters campaigns by platform", () => {
    const ws = buildFixture();
    const metaOnly = filterCampaigns(ws.campaigns, { platform: "meta" });
    expect(metaOnly.every((c) => c.platform === "meta")).toBe(true);
    expect(metaOnly.length).toBeGreaterThan(0);
  });

  it("sorts campaigns by profit descending", () => {
    const ws = buildFixture();
    const sorted = sortCampaigns(ws.campaigns, "profit");
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1]!.profit).toBeGreaterThanOrEqual(sorted[i]!.profit);
    }
  });
});
