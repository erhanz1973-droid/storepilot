import { describe, expect, it, vi } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { mergeIntegrationIntoSnapshot } from "../engine";

vi.mock("@/lib/google-ads/oauth", () => ({
  isGoogleAdsAvailable: vi.fn(() => false),
}));

import { isGoogleAdsAvailable } from "@/lib/google-ads/oauth";

describe("mergeIntegrationIntoSnapshot — Google Ads", () => {
  it("uses demo Google Ads when live Google is not configured", () => {
    vi.mocked(isGoogleAdsAvailable).mockReturnValue(false);
    const merged = mergeIntegrationIntoSnapshot({
      ...DEMO_STORE_SNAPSHOT,
      googleAdsSnapshot: undefined,
    });
    expect(merged.googleAdsSnapshot?.campaigns.length).toBeGreaterThan(0);
    expect(merged.googleAdsSnapshot?.campaigns[0]?.id).toMatch(/^po-g-/);
    expect(merged.connectorStates?.google_ads).toBe("connected");
  });

  it("does not inject demo Google Ads when live Google OAuth is configured", () => {
    vi.mocked(isGoogleAdsAvailable).mockReturnValue(true);
    const merged = mergeIntegrationIntoSnapshot({
      ...DEMO_STORE_SNAPSHOT,
      googleAdsSnapshot: undefined,
      connectorStates: { ...DEMO_STORE_SNAPSHOT.connectorStates, google_ads: "disconnected" },
    });
    expect(merged.googleAdsSnapshot).toBeUndefined();
    expect(merged.connectorStates?.google_ads).toBe("disconnected");
  });

  it("does not inject demo Google Ads for live connected store snapshots", () => {
    vi.mocked(isGoogleAdsAvailable).mockReturnValue(false);
    const merged = mergeIntegrationIntoSnapshot({
      ...DEMO_STORE_SNAPSHOT,
      source: "connected",
      connectorStates: {
        ...DEMO_STORE_SNAPSHOT.connectorStates,
        shopify: "connected",
        google_ads: "disconnected",
      },
      googleAdsSnapshot: undefined,
    });
    expect(merged.googleAdsSnapshot).toBeUndefined();
    expect(merged.connectorStates?.google_ads).toBe("disconnected");
  });

  it("prefers live OAuth snapshot over demo integration data", () => {
    vi.mocked(isGoogleAdsAvailable).mockReturnValue(true);
    const liveSnapshot = {
      campaigns: [
        {
          id: "live-1",
          name: "Live Campaign",
          type: "search" as const,
          status: "ENABLED",
          spend7d: 100,
          revenue7d: 400,
          roas7d: 4,
          impressions7d: 1000,
          clicks7d: 50,
          conversions7d: 10,
        },
      ],
      adGroups: [],
      keywords: [],
      searchTerms: [],
      rollups: {
        today: { spend: 10, attributedRevenue: 40, orders: 0 },
        yesterday: { spend: 12, attributedRevenue: 48, orders: 0 },
        last7d: { spend: 100, attributedRevenue: 400, orders: 0 },
        last30d: { spend: 420, attributedRevenue: 1680, orders: 0 },
      },
      dailySpend: [{ date: "2026-06-01", spend: 14 }],
    };
    const merged = mergeIntegrationIntoSnapshot({
      ...DEMO_STORE_SNAPSHOT,
      googleAdsSnapshot: liveSnapshot,
      connectorStates: { ...DEMO_STORE_SNAPSHOT.connectorStates, google_ads: "connected" },
    });
    expect(merged.googleAdsSnapshot?.campaigns[0]?.id).toBe("live-1");
    expect(merged.googleAdsSnapshot?.campaigns[0]?.conversions7d).toBe(10);
  });
});
