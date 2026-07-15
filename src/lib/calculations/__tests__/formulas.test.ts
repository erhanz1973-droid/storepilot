import { describe, expect, it } from "vitest";
import {
  formulaAdvertisingSavings,
  formulaAov,
  formulaBlendedRoas,
  formulaBusinessRecovery,
  formulaConfidence,
  formulaGrossProfit,
  formulaNetProfit,
  formulaNetMarginPct,
  formulaRevenueToNetProfit,
  formulaSampleSizeScore,
  MARKETING_EFFICIENCY_TO_NET,
} from "@/lib/calculations/formulas";

describe("formula library", () => {
  it("computes gross and net profit", () => {
    expect(formulaGrossProfit(10_000, 4_000)).toBe(6000);
    expect(
      formulaNetProfit({
        revenue: 10_000,
        cogs: 4_000,
        shippingCost: 500,
        refunds: 200,
        platformFees: 300,
        adSpend: 2_000,
      }),
    ).toBe(3000);
  });

  it("handles zero revenue and zero spend", () => {
    expect(formulaNetMarginPct(0, 0)).toBeNull();
    expect(formulaBlendedRoas(0, 0)).toBeNull();
    expect(formulaAov(0, 0)).toBeNull();
  });

  it("computes advertising savings as current minus expected", () => {
    expect(formulaAdvertisingSavings(5000, 3200)).toBe(1800);
    expect(formulaAdvertisingSavings(3200, 5000)).toBe(0);
  });

  it("computes business recovery as sum of components", () => {
    expect(
      formulaBusinessRecovery({
        avoidedWaste: 6168,
        recoveredRevenue: 0,
        marginImprovement: 0,
      }),
    ).toBe(6168);
  });

  it("converts marketing savings to net via efficiency factor", () => {
    expect(
      formulaRevenueToNetProfit(6168, { isMarketingEfficiency: true }),
    ).toBe(Math.round(6168 * MARKETING_EFFICIENCY_TO_NET));
  });

  it("uses store margin when provided for non-marketing", () => {
    expect(
      formulaRevenueToNetProfit(1000, {
        isMarketingEfficiency: false,
        storeNetMarginPct: 10,
      }),
    ).toBe(100);
  });

  it("computes confidence from measurable factors", () => {
    const pct = formulaConfidence({
      dataQuality: 0.9,
      sampleSizeScore: 0.8,
      predictionStability: 0.85,
      historicalAccuracy: 0.75,
    });
    expect(pct).toBeGreaterThan(70);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it("sample size score saturates at 1", () => {
    expect(formulaSampleSizeScore(0)).toBe(0);
    expect(formulaSampleSizeScore(50, 100)).toBe(0.5);
    expect(formulaSampleSizeScore(200, 100)).toBe(1);
  });

  it("example: integrity fixture waterfall Net Profit = 13320", () => {
    // Revenue 52340 − COGS 22100 − Shipping 4100 − Fees 720 − Ads 12100 = 13320
    expect(
      formulaNetProfit({
        revenue: 52_340,
        cogs: 22_100,
        shippingCost: 4_100,
        refunds: 0,
        platformFees: 720,
        adSpend: 12_100,
      }),
    ).toBe(13_320);
    expect(formulaGrossProfit(52_340, 22_100)).toBe(30_240);
    expect(formulaBlendedRoas(52_340, 12_100)).toBe(52_340 / 12_100);
    expect(formulaAov(52_340, 10)).toBe(5_234);
  });
});
