import { describe, expect, it } from "vitest";
import {
  adsCampaignDataAvailable,
  applyCoverageConfidencePenalty,
  buildBusinessCoverage,
  canEmitAsRecommendation,
  requiresUnavailableAdvertisingData,
} from "@/lib/analytics/data-availability";

describe("data availability layer", () => {
  const shopifyOnly = {
    shopify: true,
    metaAds: false,
    googleAds: false,
    ga4: false,
    inventory: true,
    customers: true,
  };

  it("blocks advertising recommendations without ads connectors", () => {
    expect(adsCampaignDataAvailable(shopifyOnly)).toBe(false);
    expect(canEmitAsRecommendation("Increase Google Ads budget on winning campaigns", shopifyOnly)).toBe(
      false,
    );
    expect(canEmitAsRecommendation("Dead inventory", shopifyOnly)).toBe(true);
    expect(requiresUnavailableAdvertisingData("Advertising leakage identified", shopifyOnly)).toBe(true);
  });

  it("allows advertising recommendations when an ads connector exists", () => {
    const withMeta = { ...shopifyOnly, metaAds: true };
    expect(canEmitAsRecommendation("Reduce Meta budget on Prospecting", withMeta)).toBe(true);
    expect(canEmitAsRecommendation("Increase Google Ads budget on winning campaigns", withMeta)).toBe(
      true,
    );
  });

  it("computes business coverage and confidence penalty", () => {
    const coverage = buildBusinessCoverage(shopifyOnly);
    expect(coverage.scorePct).toBe(50);
    expect(coverage.missing.map((m) => m.label)).toEqual(
      expect.arrayContaining(["Meta Ads", "Google Ads", "GA4"]),
    );
    expect(coverage.confidenceLimitation).toMatch(/Limited by missing/);

    const adjusted = applyCoverageConfidencePenalty(72, coverage);
    expect(adjusted.confidencePct).toBeLessThan(72);
    expect(adjusted.limitation).toMatch(/Limited by missing/);
  });
});
