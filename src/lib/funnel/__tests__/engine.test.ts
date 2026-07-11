import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { PEAK_OUTFITTERS_BASE_SNAPSHOT } from "@/lib/demo/peak-outfitters";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { buildFunnelPageView } from "@/lib/funnel/engine";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { mergeIntegrationIntoSnapshot } from "@/lib/integrations/engine";
import { describe, expect, it } from "vitest";

describe("buildFunnelPageView", () => {
  it("builds commerce-only optimization workspace when GA4 is not connected", () => {
    const view = buildFunnelPageView({ snapshot: PEAK_OUTFITTERS_BASE_SNAPSHOT });

    expect(view.dataTier).toBe("commerce_only");
    expect(view.funnelSteps).toHaveLength(0);
    expect(view.optimizationActions.length).toBeGreaterThan(0);
    expect(view.availableMetrics.some((m) => m.id === "orders")).toBe(true);
  });

  it("shows session-level funnel without fabricating step-level events", () => {
    const snapshot = {
      ...PEAK_OUTFITTERS_BASE_SNAPSHOT,
      ga4Snapshot: {
        sessions30d: 10_000,
        landingPages: [],
        sourceMedium: [],
        utmCampaigns: [],
        devices: [],
        countries: [],
      },
    };

    const view = buildFunnelPageView({ snapshot });

    expect(view.dataTier).toBe("session_level");
    expect(view.funnelSteps).toHaveLength(2);
    expect(view.funnelSteps[0]?.label).toBe("Sessions");
    expect(view.optimizationActions.length).toBeGreaterThan(0);
  });

  it("shows step-level funnel when verified GA4 events exist", () => {
    const snapshot = mergeIntegrationIntoSnapshot(getPeakOutfittersSnapshot());
    const profitDashboard = computeProfitDashboard(snapshot, [])!;
    const attribution = buildAttributionDashboard(snapshot, profitDashboard)!;
    const view = buildFunnelPageView({ snapshot, attribution, profitDashboard });

    expect(view.dataTier).toBe("step_level");
    expect(view.funnelSteps).toHaveLength(5);
    expect(view.aiInsights.length).toBeGreaterThan(0);
    expect(view.confidence).toBe("verified");
    expect(view.bottleneck).not.toBeNull();
  });

  it("always surfaces optimization actions instead of setup messaging", () => {
    const view = buildFunnelPageView({ snapshot: PEAK_OUTFITTERS_BASE_SNAPSHOT });
    expect(view.optimizationActions.length).toBeGreaterThan(0);
    expect(view.bottleneck).not.toBeNull();
  });
});
