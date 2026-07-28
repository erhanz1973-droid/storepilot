import { describe, expect, it } from "vitest";
import {
  adsCampaignDataAvailable,
  applyCoverageConfidencePenalty,
  buildBusinessCoverage,
  canEmitAsRecommendation,
  groundRecommendationEvidence,
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

  it("grounds recommendations as hypothesis or insufficient when evidence is weak (Rule 8)", () => {
    const insufficient = groundRecommendationEvidence({
      title: "Increase Google Ads budget on winning campaigns",
      sources: shopifyOnly,
      evidencePointCount: 3,
      confidencePct: 90,
    });
    expect(insufficient.standing).toBe("insufficient_data");
    expect(insufficient.explanation).toMatch(/connect/i);

    const hypothesis = groundRecommendationEvidence({
      title: "Dead inventory",
      sources: shopifyOnly,
      evidencePointCount: 0,
      confidencePct: 40,
    });
    expect(hypothesis.standing).toBe("hypothesis");
    expect(hypothesis.label).toBe("Hypothesis");
    expect(hypothesis.supportedBy).toEqual(expect.arrayContaining(["Shopify", "Inventory"]));
    expect(hypothesis.explanation).not.toMatch(/Shopify/);
    expect(hypothesis.explanation).toMatch(/confidence/i);

    const strong = groundRecommendationEvidence({
      title: "Dead inventory",
      sources: shopifyOnly,
      evidencePointCount: 3,
      confidencePct: 80,
    });
    expect(strong.standing).toBe("recommendation");
    expect(strong.explanation).toBe("");
    expect(strong.supportedBy).toEqual(expect.arrayContaining(["Shopify", "Inventory"]));
  });
});
