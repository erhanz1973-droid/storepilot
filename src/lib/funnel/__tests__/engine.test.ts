import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { PEAK_OUTFITTERS_BASE_SNAPSHOT } from "@/lib/demo/peak-outfitters";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { buildFunnelPageView } from "@/lib/funnel/engine";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { mergeIntegrationIntoSnapshot } from "@/lib/integrations/engine";
import { describe, expect, it } from "vitest";

describe("buildFunnelPageView", () => {
  it("shows readiness mode when GA4 is not connected", () => {
    const view = buildFunnelPageView({ snapshot: PEAK_OUTFITTERS_BASE_SNAPSHOT });

    expect(view.mode).toBe("readiness");
    expect(view.ga4Status).toBe("unavailable");
    expect(view.funnelSteps).toHaveLength(0);
    expect(view.aiInsights).toHaveLength(0);
    expect(view.availableMetrics.some((m) => m.id === "orders")).toBe(true);
    expect(view.previewStepLabels).toHaveLength(5);
  });

  it("does not fabricate funnel steps without verified GA4 events", () => {
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

    expect(view.ga4Status).toBe("estimated");
    expect(view.mode).toBe("readiness");
    expect(view.funnelSteps).toHaveLength(0);
  });

  it("shows full funnel when verified GA4 events exist", () => {
    const snapshot = mergeIntegrationIntoSnapshot(getPeakOutfittersSnapshot());
    const profitDashboard = computeProfitDashboard(snapshot, [])!;
    const attribution = buildAttributionDashboard(snapshot, profitDashboard)!;
    const view = buildFunnelPageView({ snapshot, attribution, profitDashboard });

    expect(view.mode).toBe("full");
    expect(view.ga4Status).toBe("connected");
    expect(view.funnelSteps).toHaveLength(5);
    expect(view.aiInsights.length).toBeGreaterThan(0);
    expect(view.confidence).toBe("verified");
  });

  it("never generates AI insights in readiness mode", () => {
    const view = buildFunnelPageView({ snapshot: PEAK_OUTFITTERS_BASE_SNAPSHOT });
    expect(view.aiInsights).toEqual([]);
  });
});
