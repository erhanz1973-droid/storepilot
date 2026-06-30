import { PEAK_OUTFITTERS_BASE_SNAPSHOT } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import {
  assembleProfitPageView,
  buildAiSummary,
  buildProfitWaterfall,
  buildRecoveryOpportunities,
} from "@/lib/profit/profit-page-view";
import { describe, expect, it } from "vitest";

describe("profit-page-view", () => {
  const dashboard = computeProfitDashboard(PEAK_OUTFITTERS_BASE_SNAPSHOT, [])!;

  it("builds AI summary with recovery opportunity", () => {
    const recovery = buildRecoveryOpportunities(dashboard, PEAK_OUTFITTERS_BASE_SNAPSHOT);
    const summary = buildAiSummary(dashboard, recovery);
    expect(summary.headline.length).toBeGreaterThan(10);
    expect(summary.confidencePct).toBeGreaterThan(0);
    if (recovery.length > 0) {
      expect(summary.topRecovery?.estimatedMonthlyRecovery).toBeGreaterThan(0);
      expect(summary.topRecovery?.description.length).toBeGreaterThan(10);
      expect(summary.topRecovery?.priority).toBeLessThanOrEqual(3);
    }
  });

  it("builds waterfall from primary period", () => {
    const waterfall = buildProfitWaterfall(dashboard.primary);
    expect(waterfall.revenue).toBeGreaterThan(0);
    expect(waterfall.productCost).toBeGreaterThan(0);
    expect(typeof waterfall.netProfit).toBe("number");
  });

  it("assembles full page view", () => {
    const view = assembleProfitPageView(dashboard, PEAK_OUTFITTERS_BASE_SNAPSHOT);
    expect(view.recovery.opportunities.length).toBeGreaterThan(0);
    expect(view.confidenceCategories.length).toBeGreaterThan(0);
    expect(view.enrichedProducts.length).toBeGreaterThan(0);
    expect(view.timelineCharts.last30d.series.length).toBeGreaterThan(0);
    expect(view.channelCards.some((c) => c.channelId === "meta")).toBe(true);
    const meta = view.channelCards.find((c) => c.channelId === "meta");
    if (meta && meta.revenue > 0) {
      expect(meta.tierLabel.length).toBeGreaterThan(0);
      expect(meta.breakdown.length).toBeGreaterThan(0);
      expect(meta.aiInsight.length).toBeGreaterThan(10);
    }
  });

  it("surfaces why-losing-money when net profit is negative", () => {
    const view = assembleProfitPageView(dashboard, PEAK_OUTFITTERS_BASE_SNAPSHOT);
    const net = dashboard.primary.netProfit ?? 0;
    if (net < 0) {
      expect(view.whyLosingMoney).not.toBeNull();
      expect(view.whyLosingMoney!.paragraphs.length).toBeGreaterThan(0);
    }
  });
});
