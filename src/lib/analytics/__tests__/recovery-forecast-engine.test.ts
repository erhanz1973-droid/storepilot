import { describe, expect, it } from "vitest";
import {
  buildRecoveryForecast,
  inferBusinessSegment,
  inferOpportunityType,
  inferPerformanceTier,
} from "@/lib/analytics/recovery-forecast-engine";
import type { ForecastBusinessContext } from "@/lib/analytics/recovery-forecast-engine";

function baseCtx(overrides: Partial<ForecastBusinessContext> = {}): ForecastBusinessContext {
  return {
    monthlyRevenue: 18_000,
    monthlyProfit: 2_800,
    monthlyAdSpend: 850,
    blendedRoas: 1.8,
    conversionRatePct: 2.5,
    grossMarginPct: 42,
    contributionMarginPct: 28,
    cogsPct: 40,
    shippingCostPct: 8,
    catastrophicInefficiency: false,
    performanceTier: "normal",
    businessSegment: "small",
    businessModel: "own_inventory",
    profitTrendPct: null,
    budgetEfficiencyScore: 72,
    ...overrides,
  };
}

describe("recovery forecast engine", () => {
  it("infers performance tiers from ROAS and margin signals", () => {
    expect(inferPerformanceTier(baseCtx({ catastrophicInefficiency: true }))).toBe(
      "catastrophic",
    );
    expect(inferPerformanceTier(baseCtx({ blendedRoas: 1.1 }))).toBe("critical");
    expect(inferPerformanceTier(baseCtx({ grossMarginPct: 18 }))).toBe("poor");
    expect(inferPerformanceTier(baseCtx())).toBe("normal");
  });

  it("infers business segments from revenue", () => {
    expect(inferBusinessSegment(12_000)).toBe("small");
    expect(inferBusinessSegment(80_000)).toBe("medium");
    expect(inferBusinessSegment(500_000)).toBe("large");
    expect(inferBusinessSegment(3_000_000)).toBe("enterprise");
  });

  it("maps recommendation titles to opportunity types", () => {
    expect(inferOpportunityType("Pause underperforming Meta campaigns")).toBe(
      "campaign_optimization",
    );
    expect(inferOpportunityType("Reallocate budget to top ROAS ad sets")).toBe(
      "budget_reallocation",
    );
    expect(inferOpportunityType("Raise prices on low-margin SKUs")).toBe("pricing_optimization");
    expect(inferOpportunityType("Launch Klaviyo win-back flow")).toBe("email_marketing");
  });

  it("caps normal-performance advertisers at 30% of ad spend", () => {
    const forecast = buildRecoveryForecast({
      rawAmount: 13_865,
      baseConfidencePct: 88,
      ctx: baseCtx({ performanceTier: "normal", businessSegment: "small" }),
      opportunityTitle: "Pause Google prospecting",
    });
    expect(forecast.amount).toBeLessThanOrEqual(255);
    expect(forecast.wasCapped).toBe(true);
    expect(forecast.range.low).toBeLessThanOrEqual(forecast.range.mostLikely);
    expect(forecast.range.high).toBeGreaterThanOrEqual(forecast.range.mostLikely);
  });

  it("allows higher recovery caps for catastrophic inefficiency", () => {
    const normal = buildRecoveryForecast({
      rawAmount: 2_000,
      baseConfidencePct: 70,
      ctx: baseCtx({ performanceTier: "normal" }),
    });
    const catastrophic = buildRecoveryForecast({
      rawAmount: 2_000,
      baseConfidencePct: 70,
      ctx: baseCtx({ performanceTier: "catastrophic", blendedRoas: 0.8, monthlyProfit: -500 }),
    });
    expect(catastrophic.amount).toBeGreaterThan(normal.amount);
    expect(catastrophic.calculation.dynamicCapPct).toBe(0.7);
  });

  it("weights recovery by gross margin profile at same performance tier", () => {
    const lowMargin = buildRecoveryForecast({
      rawAmount: 900,
      baseConfidencePct: 80,
      ctx: baseCtx({ grossMarginPct: 16, performanceTier: "normal" }),
      opportunityTitle: "Pricing optimization",
    });
    const highMargin = buildRecoveryForecast({
      rawAmount: 900,
      baseConfidencePct: 80,
      ctx: baseCtx({ grossMarginPct: 62, performanceTier: "normal" }),
      opportunityTitle: "Pricing optimization",
    });
    expect(highMargin.amount).toBeGreaterThan(lowMargin.amount);
    expect(highMargin.calculation.grossMarginPct).toBe(62);
  });

  it("returns confidence range, quality label, and benchmark", () => {
    const forecast = buildRecoveryForecast({
      rawAmount: 425,
      baseConfidencePct: 82,
      ctx: baseCtx(),
      opportunityTitle: "Campaign optimization",
    });
    expect(forecast.confidencePct).toBeGreaterThan(0);
    expect(forecast.quality.label).toBeTruthy();
    expect(forecast.benchmark.averageRecovery).toBeGreaterThan(0);
    expect(forecast.components.expectedProfitIncrease).toBe(forecast.amount);
    expect(forecast.calculation.historicalWindowDays).toBe(90);
  });

  it("applies business model multipliers", () => {
    const dropship = buildRecoveryForecast({
      rawAmount: 1_000,
      baseConfidencePct: 75,
      ctx: baseCtx({ businessModel: "dropshipping", businessSegment: "medium", monthlyRevenue: 50_000 }),
    });
    const privateLabel = buildRecoveryForecast({
      rawAmount: 1_000,
      baseConfidencePct: 75,
      ctx: baseCtx({ businessModel: "private_label", businessSegment: "medium", monthlyRevenue: 50_000 }),
    });
    expect(privateLabel.amount).toBeGreaterThan(dropship.amount);
  });
});
