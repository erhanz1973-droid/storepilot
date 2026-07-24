import { describe, expect, it } from "vitest";
import {
  ALPINE_OUTFITTERS,
  ALPINE_CURATED_RECOMMENDATIONS,
  alpineOutfittersGA4Snapshot,
  alpineProductRevenueTotal,
  alpineMetaSpend7dTotal,
  alpineMetaRevenue7dTotal,
  alpineGoogleSpend7dTotal,
  alpineGoogleRevenue7dTotal,
  alpineOutfittersDailyMetrics,
  getAlpineOutfittersSnapshot,
} from "@/lib/demo/alpine-outfitters";
import { buildDemoSnapshot } from "@/lib/demo/get-demo-snapshot";
import { getAppDataMode, getDemoDataProvider, isDemoModeEnabled } from "@/lib/demo/provider";
import { mergeIntegrationIntoSnapshot } from "@/lib/integrations/engine";
import { generateRecommendations } from "@/lib/recommendations/registry";

describe("Alpine Outfitters demo store", () => {
  it("product revenues sum to store revenue", () => {
    expect(alpineProductRevenueTotal()).toBe(ALPINE_OUTFITTERS.revenue30d);
  });

  it("Meta campaign 7d totals match constants", () => {
    expect(alpineMetaSpend7dTotal()).toBe(ALPINE_OUTFITTERS.metaSpend7d);
    expect(alpineMetaRevenue7dTotal()).toBe(ALPINE_OUTFITTERS.metaRevenue7d);
  });

  it("Google campaign 7d totals match constants", () => {
    expect(alpineGoogleSpend7dTotal()).toBe(ALPINE_OUTFITTERS.googleSpend7d);
    expect(alpineGoogleRevenue7dTotal()).toBe(ALPINE_OUTFITTERS.googleRevenue7d);
  });

  it("snapshot KPIs match App Store showcase figures", () => {
    const snapshot = getAlpineOutfittersSnapshot();
    expect(snapshot.commerceStoreDomain).toBe(ALPINE_OUTFITTERS.shopDomain);
    expect(snapshot.storeMetrics.revenue30d).toBe(82_450);
    expect(snapshot.storeMetrics.orders30d).toBe(1_248);
    expect(snapshot.storeMetrics.aov30d).toBe(66.1);
    expect(snapshot.storeMetrics.conversionRate30d).toBe(3.4);
    expect(snapshot.products.length).toBeGreaterThanOrEqual(15);
    expect(snapshot.products.length).toBeLessThanOrEqual(20);
    expect(snapshot.dailyMetrics?.every((p) => p.revenue > 0 && p.orders > 0)).toBe(true);
  });

  it("is the default healthy_growth demo scenario", () => {
    const snapshot = buildDemoSnapshot("healthy_growth");
    expect(snapshot.commerceStoreDomain).toContain("alpine-outfitters");
    expect(snapshot.storeMetrics.revenue30d).toBe(82_450);
  });

  it("GA4 matches showcase traffic metrics", () => {
    const ga4 = alpineOutfittersGA4Snapshot();
    expect(ga4.sessions30d).toBe(54_800);
    expect(ga4.users30d).toBe(41_900);
    expect(ga4.returningUserRatePct).toBe(32);
    expect(ga4.dailySessions?.every((d) => d.sessions > 0)).toBe(true);
  });

  it("merged integrations keep Alpine GA4 and Google Ads", () => {
    const merged = mergeIntegrationIntoSnapshot(getAlpineOutfittersSnapshot());
    expect(merged.ga4Snapshot?.sessions30d).toBe(54_800);
    expect(merged.ga4Snapshot?.users30d).toBe(41_900);
    const googleCampaigns = merged.integrationSnapshot?.googleAds?.campaigns ?? [];
    const googleSpend = googleCampaigns.reduce((s, c) => s + c.spend7d, 0);
    expect(googleSpend).toBe(ALPINE_OUTFITTERS.googleSpend7d);
  });

  it("daily metrics are deterministic and non-zero", () => {
    const a = alpineOutfittersDailyMetrics();
    const b = alpineOutfittersDailyMetrics();
    expect(a).toEqual(b);
    expect(a.every((p) => p.revenue > 0 && p.adSpend > 0 && p.orders > 0)).toBe(true);
  });

  it("surfaces curated App Store recommendations", () => {
    const recs = generateRecommendations(getAlpineOutfittersSnapshot());
    const titles = recs.map((r) => r.title);
    expect(titles.some((t) => t.includes("Increase Google Ads budget"))).toBe(true);
    expect(titles.some((t) => t.includes("Pause two underperforming Meta"))).toBe(true);
    expect(titles.some((t) => t.includes("Restock Alpine Waterproof Jacket"))).toBe(true);
    expect(ALPINE_CURATED_RECOMMENDATIONS.every((r) => r.confidence >= 0.85)).toBe(true);
    expect(
      ALPINE_CURATED_RECOMMENDATIONS.every(
        (r) =>
          (r.financialImpact?.estimatedMonthlyProfitIncrease ?? 0) > 0 ||
          (r.financialImpact?.estimatedMonthlyRevenueIncrease ?? 0) > 0 ||
          (r.financialImpact?.estimatedMonthlyCostSavings ?? 0) > 0,
      ),
    ).toBe(true);
  });

  it("Demo Data Provider exposes Alpine in demo mode", () => {
    expect(isDemoModeEnabled()).toBe(true);
    expect(getAppDataMode()).toBe("demo");
    const provider = getDemoDataProvider();
    expect(provider?.storeName).toBe("Alpine Outfitters");
    expect(provider?.kpis.revenue30d).toBe(82_450);
    expect(provider?.getRecommendations().length).toBe(6);
  });
});
