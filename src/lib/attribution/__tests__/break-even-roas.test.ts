import { computeDynamicBreakEvenRoas } from "@/lib/attribution/break-even-roas";
import { describe, expect, it } from "vitest";

describe("dynamic break-even ROAS", () => {
  it("computes break-even from margin, shipping, fees, refunds, and target profit", () => {
    const model = computeDynamicBreakEvenRoas({
      revenue: 100_000,
      grossProfit: 58_000,
      shippingCost: 8_000,
      transactionFees: 3_000,
      refunds: 2_000,
      targetProfitMarginPct: 10,
    });

    expect(model).not.toBeNull();
    expect(model!.contributionMarginPct).toBe(35);
    expect(model!.breakEvenRoas).toBe(2.86);
  });

  it("returns null when contribution margin is non-positive", () => {
    const model = computeDynamicBreakEvenRoas({
      revenue: 10_000,
      grossProfit: 2_000,
      shippingCost: 4_000,
      transactionFees: 1_000,
      refunds: 500,
      targetProfitMarginPct: 10,
    });
    expect(model).toBeNull();
  });
});
