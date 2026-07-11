import { describe, expect, it } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { buildIntegrationReadiness } from "../integration-readiness";
import { buildChannelComparison } from "@/lib/analytics/marketing-executive-layer";
import { buildMarketingBudgetAllocation } from "@/lib/analytics/marketing-manager-v2";
import { buildMarketingManagerView } from "@/lib/analytics/marketing-manager";
import type { StoreSnapshot } from "@/lib/connectors/types";

function liveSnapshot(partial: Partial<StoreSnapshot> = {}): StoreSnapshot {
  return {
    ...DEMO_STORE_SNAPSHOT,
    source: "connected",
    connectorStates: {
      shopify: "connected",
      meta_ads: "disconnected",
      google_ads: "disconnected",
    },
    campaigns: [],
    googleAdsSnapshot: undefined,
    ...partial,
  };
}

describe("buildIntegrationReadiness", () => {
  it("scenario 1 — fresh store without Shopify shows connect guidance", () => {
    const readiness = buildIntegrationReadiness({
      snapshot: {
        ...DEMO_STORE_SNAPSHOT,
        source: "demo",
        connectorStates: { shopify: "disconnected" },
      },
    });
    expect(readiness.phase).toBe("fresh_store");
    expect(readiness.executiveMessage).toMatch(/Connect Shopify/i);
    expect(readiness.canGenerateAdvertisingRecommendations).toBe(false);
  });

  it("scenario 2 — Shopify only explains store analysis without ads recs", () => {
    const readiness = buildIntegrationReadiness({
      snapshot: liveSnapshot({
        storeMetrics: { revenue30d: 1200, orders30d: 8, aov30d: 150, conversionRate30d: 2 },
      }),
    });
    expect(readiness.phase).toBe("shopify_only");
    expect(readiness.executiveMessage).toMatch(/analyze your store performance/i);
    expect(readiness.executiveMessage).toMatch(/Connect advertising platforms/i);
    expect(readiness.canGenerateAdvertisingRecommendations).toBe(false);
    expect(readiness.canShowChannelComparison).toBe(false);
  });

  it("scenario 3 — Meta only enables single-channel mode", () => {
    const readiness = buildIntegrationReadiness({
      snapshot: liveSnapshot({
        connectorStates: { shopify: "connected", meta_ads: "connected", google_ads: "disconnected" },
        campaigns: [{ id: "m1", name: "Prospecting", status: "ACTIVE", spend7d: 200, revenue7d: 600 } as never],
      }),
    });
    expect(readiness.phase).toBe("meta_only");
    expect(readiness.googleConnected).toBe(false);
    expect(readiness.canShowChannelComparison).toBe(false);
    expect(readiness.advertisingMessage).toMatch(/Meta Ads only/i);
  });

  it("scenario 6 — integration failure surfaces explanation", () => {
    const readiness = buildIntegrationReadiness({
      snapshot: liveSnapshot({
        connectorStates: {
          shopify: "connected",
          meta_ads: "sync_failed",
          google_ads: "error",
        },
      }),
    });
    expect(readiness.integrationIssues.length).toBe(2);
    expect(readiness.canGenerateAdvertisingRecommendations).toBe(false);
    expect(readiness.integrationIssues[0]?.message).toMatch(/unavailable/i);
  });

  it("scenario 7 — low data store communicates low confidence", () => {
    const readiness = buildIntegrationReadiness({
      snapshot: liveSnapshot({
        storeMetrics: { revenue30d: 100, orders30d: 2, aov30d: 50, conversionRate30d: 1 },
      }),
    });
    expect(readiness.dataConfidence).toBe("low");
    expect(readiness.dataConfidenceMessage).toMatch(/conservative|Limited recent data/i);
  });
});

describe("beta validation — marketing outputs", () => {
  it("scenario 2 — no channel comparison or budget shift when Shopify only", () => {
    const snapshot = liveSnapshot();
    const view = buildMarketingManagerView({
      snapshot,
      profitDashboard: null,
      productAttribution: null,
      decisions: [],
    });
    expect(view.v2.executive.channelComparison).toBeNull();
    expect(view.v2.budgetAllocation.mode).toBe("unavailable");
    expect(view.v2.budgetAllocation.estimatedMonthlyImprovement).toBe(0);
  });

  it("scenario 3 — Meta only hides channel comparison", () => {
    const snapshot = liveSnapshot({
      connectorStates: { shopify: "connected", meta_ads: "connected", google_ads: "disconnected" },
      campaigns: [
        {
          id: "c1",
          name: "Meta Prospecting",
          status: "ACTIVE",
          spend7d: 500,
          revenue7d: 1500,
          roas7d: 3,
          impressions7d: 10000,
          clicks7d: 200,
          conversions7d: 20,
        },
      ],
    });
    const view = buildMarketingManagerView({
      snapshot,
      profitDashboard: null,
      productAttribution: null,
      decisions: [],
    });
    const comparison = buildChannelComparison(view.platforms, view.campaigns, view.v2.budgetAllocation);
    expect(comparison).toBeNull();
    expect(view.v2.budgetAllocation.mode).toBe("single_channel");
    expect(view.platforms.find((p) => p.channel === "google")?.connected).toBe(false);
  });
});

describe("buildMarketingBudgetAllocation modes", () => {
  it("returns unavailable when no ads connected", () => {
    const allocation = buildMarketingBudgetAllocation({
      platforms: [
        { channel: "meta", connected: false } as never,
        { channel: "google", connected: false } as never,
      ],
      campaigns: [],
    });
    expect(allocation.mode).toBe("unavailable");
    expect(allocation.estimatedMonthlyImprovement).toBe(0);
  });
});
