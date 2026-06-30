import { describe, expect, it } from "vitest";
import { verifyGa4FunnelEvents } from "@/lib/ga4/sync";
import { buildGa4Insights } from "@/lib/insights/ga4";
import { peakOutfittersGA4Snapshot } from "@/lib/demo/peak-outfitters/ga4";
import { DEMO_STORE_SNAPSHOT } from "@/lib/demo/peak-outfitters";

describe("verifyGa4FunnelEvents", () => {
  it("returns true when GA4 purchases align with Shopify orders", () => {
    expect(verifyGa4FunnelEvents(400, 403)).toBe(true);
  });

  it("returns false when orders diverge beyond 25%", () => {
    expect(verifyGa4FunnelEvents(200, 403)).toBe(false);
  });

  it("returns false without Shopify order count", () => {
    expect(verifyGa4FunnelEvents(400, undefined)).toBe(false);
  });
});

describe("buildGa4Insights", () => {
  it("generates behavioral insights from GA4 snapshot", () => {
    const snapshot = {
      ...DEMO_STORE_SNAPSHOT,
      ga4Snapshot: peakOutfittersGA4Snapshot(),
    };
    const insights = buildGa4Insights(snapshot);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some((i) => i.source === "ga4")).toBe(true);
  });
});
