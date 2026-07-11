import { describe, expect, it } from "vitest";
import {
  estimateCampaignRecovery,
  estimateMonthlyRecovery,
  estimatePlatformRecoverable,
} from "@/lib/analytics/recovery-engine";

describe("recovery engine", () => {
  it("caps recovery at 50% of documented loss", () => {
    const result = estimateMonthlyRecovery({
      maxRecoverableMonthly: 100_000,
      gapSeverity: 1,
      confidencePct: 100,
    });
    expect(result.amountMonthly).toBeLessThanOrEqual(50_000);
  });

  it("returns zero recovery when no loss and no growth base", () => {
    const result = estimateMonthlyRecovery({
      maxRecoverableMonthly: 0,
      gapSeverity: 0.8,
      confidencePct: 80,
    });
    expect(result.amountMonthly).toBe(0);
  });

  it("scales campaign recovery by probability", () => {
    const high = estimateCampaignRecovery({
      weeklyProfit: -1000,
      weeklySpend: 500,
      recoveryProbabilityPct: 90,
      recommendation: "pause_campaign",
    });
    const low = estimateCampaignRecovery({
      weeklyProfit: -1000,
      weeklySpend: 500,
      recoveryProbabilityPct: 30,
      recommendation: "pause_campaign",
    });
    expect(high).toBeGreaterThan(low);
  });

  it("platform recoverable stays bounded", () => {
    const total = estimatePlatformRecoverable({
      losingWeeklyProfit: -5000,
      atRiskWeeklySpend: 8000,
      avgRecoveryProbabilityPct: 70,
    });
    expect(total).toBeLessThan(5000 * 4.33);
  });
});
