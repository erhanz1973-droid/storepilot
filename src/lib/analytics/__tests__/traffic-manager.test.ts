import { describe, expect, it } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { peakOutfittersGA4Snapshot } from "@/lib/demo/peak-outfitters/ga4";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildTrafficManagerView } from "@/lib/analytics/traffic-manager";

const snapshotWithGa4 = {
  ...DEMO_STORE_SNAPSHOT,
  ga4Snapshot: peakOutfittersGA4Snapshot(),
};

describe("traffic manager view", () => {
  it("builds v2 AI traffic intelligence sections", () => {
    const profitDashboard = computeProfitDashboard(snapshotWithGa4, []);
    const view = buildTrafficManagerView({
      snapshot: snapshotWithGa4,
      profitDashboard,
    });

    expect(view.v2.requiresGa4).toBe(false);
    expect(view.v2.brief.lines.length).toBeGreaterThan(0);
    expect(view.v2.businessKpis.length).toBeGreaterThanOrEqual(5);
    expect(view.v2.sourceQuality.length).toBeGreaterThan(0);
    expect(view.v2.healthScore.overall).toBeGreaterThan(0);
    expect(view.v2.opportunities.length).toBeGreaterThan(0);
  });

  it("includes recommendation reasoning on sources", () => {
    const view = buildTrafficManagerView({
      snapshot: snapshotWithGa4,
      profitDashboard: computeProfitDashboard(snapshotWithGa4, []),
    });

    for (const source of view.v2.sourceQuality) {
      expect(source.recommendation.length).toBeGreaterThan(0);
      expect(source.recommendationReasons.length).toBeGreaterThan(0);
      expect(source.recommendationActions.length).toBeGreaterThan(0);
      expect(source.qualityScore).toBeGreaterThanOrEqual(0);
      expect(source.qualityScore).toBeLessThanOrEqual(100);
      if (source.profitBreakdown) {
        expect(source.profitBreakdown.revenue).toBeGreaterThan(0);
      }
    }
  });

  it("status and recommendation are aligned", () => {
    const view = buildTrafficManagerView({
      snapshot: snapshotWithGa4,
      profitDashboard: computeProfitDashboard(snapshotWithGa4, []),
    });

    for (const source of view.v2.sourceQuality) {
      const rec = source.recommendation.toLowerCase();
      if (source.statusLabel === "Excellent") {
        expect(rec).toMatch(/scale|protect|minor|maintain/);
      }
      if (source.statusLabel === "Critical") {
        expect(rec).toMatch(/stop|restruct|reduce|major|pause/);
      }
      if (source.estimatedRecoveryMonthly > 0 && source.profitBreakdown?.netContribution != null && source.profitBreakdown.netContribution < 0) {
        expect(source.estimatedRecoveryMonthly).toBeLessThanOrEqual(
          Math.round(Math.abs(source.profitBreakdown.netContribution) * 0.35),
        );
      }
    }
  });

  it("builds landing page intelligence with recommendations", () => {
    const view = buildTrafficManagerView({
      snapshot: snapshotWithGa4,
      profitDashboard: computeProfitDashboard(snapshotWithGa4, []),
    });

    expect(view.v2.landingPages.length).toBeGreaterThan(0);
    const page = view.v2.landingPages[0];
    expect(page.recommendation).toBeTruthy();
    expect(page.recommendationReasons.length).toBeGreaterThan(0);
  });

  it("returns GA4 empty state when analytics missing", () => {
    const view = buildTrafficManagerView({
      snapshot: DEMO_STORE_SNAPSHOT,
      profitDashboard: null,
    });

    expect(view.v2.requiresGa4).toBe(true);
    expect(view.v2.sourceQuality).toHaveLength(0);
    expect(view.v2.brief.todayPriority).toBe("Connect GA4");
  });

  it("prioritizes business KPIs over raw volume", () => {
    const view = buildTrafficManagerView({
      snapshot: snapshotWithGa4,
      profitDashboard: computeProfitDashboard(snapshotWithGa4, []),
    });

    const labels = view.v2.businessKpis.map((k) => k.label);
    expect(labels).toContain("Best Traffic Source");
    expect(labels).toContain("Traffic Quality Score");
    expect(labels).toContain("Total Sessions");
    expect(labels.indexOf("Total Sessions")).toBeGreaterThan(labels.indexOf("Best Traffic Source"));
  });
});
