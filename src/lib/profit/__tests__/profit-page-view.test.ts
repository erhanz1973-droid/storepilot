import { PEAK_OUTFITTERS_BASE_SNAPSHOT } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import {
  assembleProfitPageView,
  buildAiSummary,
  buildCfoDecision,
  buildConfidenceExplanation,
  buildProfitWaterfall,
  buildRecoveryOpportunities,
} from "@/lib/profit/profit-page-view";
import { describe, expect, it } from "vitest";

describe("profit-page-view", () => {
  const dashboard = computeProfitDashboard(PEAK_OUTFITTERS_BASE_SNAPSHOT, [])!;

  it("builds executive AI summary with recovery opportunity", () => {
    const recovery = buildRecoveryOpportunities(dashboard, PEAK_OUTFITTERS_BASE_SNAPSHOT);
    const summary = buildAiSummary(dashboard, recovery);
    expect(summary.profitStatus.length).toBeGreaterThan(3);
    expect(summary.confidencePct).toBeGreaterThan(0);
    expect(summary.primaryReason.length).toBeGreaterThan(5);
    if (recovery.length > 0) {
      expect(summary.biggestRecoveryTitle).toBe(recovery[0]!.title);
      expect(summary.estimatedMonthlyRecovery).toBeGreaterThan(0);
      expect(recovery[0]!.difficulty).toBeDefined();
      expect(recovery[0]!.timeRequired.length).toBeGreaterThan(0);
    }
  });

  it("states advertising vs gross profit only in primary reason", () => {
    const recovery = buildRecoveryOpportunities(dashboard, PEAK_OUTFITTERS_BASE_SNAPSHOT);
    const summary = buildAiSummary(dashboard, recovery);
    const view = assembleProfitPageView(dashboard, PEAK_OUTFITTERS_BASE_SNAPSHOT);
    const adPhrase = "advertising costs exceed gross profit";
    const primaryCount = (summary.primaryReason.toLowerCase().match(/advertising/g) ?? []).length;

    if (dashboard.primary.adSpend > dashboard.primary.grossProfit) {
      expect(summary.primaryReason.toLowerCase()).toContain(adPhrase);
    }

    if (view.whyLosingMoney) {
      const whyText = view.whyLosingMoney.paragraphs.join(" ").toLowerCase();
      expect(whyText).not.toContain(adPhrase);
    }

    for (const opp of view.recovery.opportunities) {
      expect(opp.reason.toLowerCase()).not.toContain(adPhrase);
    }

    expect(primaryCount).toBeLessThanOrEqual(1);
  });

  it("builds waterfall from primary period", () => {
    const waterfall = buildProfitWaterfall(dashboard.primary);
    expect(waterfall.revenue).toBeGreaterThan(0);
    expect(waterfall.productCost).toBeGreaterThan(0);
    expect(typeof waterfall.netProfit).toBe("number");
  });

  it("assembles full CFO page view", () => {
    const view = assembleProfitPageView(dashboard, PEAK_OUTFITTERS_BASE_SNAPSHOT);
    expect(view.recovery.opportunities.length).toBeGreaterThan(0);
    expect(view.confidenceCategories.length).toBeGreaterThan(0);
    expect(view.confidenceExplanation.closingLine.length).toBeGreaterThan(10);
    expect(view.enrichedProducts.length).toBeGreaterThan(0);
    expect(view.productCategories.mostProfitable.title).toBe("Most Profitable Products");
    expect(view.cfoDecision.title).toBe("Today's Financial Decision");
    expect(view.cfoDecision.lines.length).toBeGreaterThan(0);
    expect(view.timelineCharts.last30d.series.length).toBeGreaterThan(0);
    const meta = view.channelCards.find((c) => c.channelId === "meta");
    if (meta && meta.revenue > 0) {
      expect(meta.recommendedAction.length).toBeGreaterThan(10);
    }
  });

  it("builds CFO decision from top recovery", () => {
    const recovery = buildRecoveryOpportunities(dashboard, PEAK_OUTFITTERS_BASE_SNAPSHOT);
    const decision = buildCfoDecision(dashboard, recovery);
    expect(decision.confidence).toMatch(/High|Medium|Low/);
    expect(decision.approvalHref).toContain("/approvals");
  });

  it("builds confidence explanation from categories", () => {
    const view = assembleProfitPageView(dashboard, PEAK_OUTFITTERS_BASE_SNAPSHOT);
    const explanation = buildConfidenceExplanation(dashboard.confidence, view.confidenceCategories);
    expect(explanation.verifiedLines.length + explanation.estimatedLines.length).toBeGreaterThan(0);
  });
});
