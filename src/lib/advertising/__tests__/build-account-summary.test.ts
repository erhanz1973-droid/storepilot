import { describe, expect, it } from "vitest";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildMarketingManagerView } from "@/lib/analytics/marketing-manager";
import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildAdvertisingWorkspace } from "@/lib/advertising/build-workspace";
import { assignCampaignPriorityRanks, buildAccountWideSummary } from "@/lib/advertising/build-account-summary";
import { deriveBriefRecommendation } from "@/lib/advertising/next-action";

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

describe("build-account-summary", () => {
  it("summarizes account-wide health buckets", () => {
    const ws = buildFixture();
    const summary = buildAccountWideSummary(ws.campaigns);
    expect(summary.totalCampaigns).toBe(ws.campaigns.length);
    expect(summary.headline).toContain("all");
    expect(summary.healthy + summary.needAttention + summary.critical).toBeGreaterThan(0);
  });

  it("assigns priority ranks to campaigns", () => {
    const ws = buildFixture();
    const ranked = assignCampaignPriorityRanks(ws.campaigns);
    expect(ranked[0]!.priorityRank).toBeGreaterThan(0);
    const ranks = new Set(ranked.map((c) => c.priorityRank));
    expect(ranks.size).toBe(ranked.length);
  });

  it("includes lightweight metrics on every campaign row", () => {
    const ws = buildFixture();
    const first = ws.campaigns[0]!;
    expect(first.cpa).toBeDefined();
    expect(first.ctr).toBeDefined();
    expect(first.briefRecommendation).toBeTruthy();
    expect(deriveBriefRecommendation(first.recommendation)).toBeTruthy();
  });
});
