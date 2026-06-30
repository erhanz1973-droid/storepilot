import { describe, expect, it } from "vitest";
import {
  buildTrafficRevenueProfitCard,
  trafficBreakdownLines,
} from "@/lib/analytics/traffic-revenue-profit-card";

describe("traffic-revenue-profit-card", () => {
  const paidBreakdown = {
    revenue: 18_900,
    advertisingCost: 31_286,
    cogs: 408,
    shipping: 983,
    paymentFees: 593,
    netContribution: -14_370,
  };

  it("formats breakdown with advertising cost label and percentages over 100%", () => {
    const lines = trafficBreakdownLines(paidBreakdown);
    const ad = lines.find((l) => l.id === "advertising");
    expect(ad?.label).toBe("Advertising Cost");
    expect(ad?.pctOfRevenue).toBeGreaterThan(100);
    const net = lines.find((l) => l.id === "net");
    expect(net?.pctOfRevenue).toBeLessThan(0);
  });

  it("builds unprofitable paid channel card with urgency and opportunity", () => {
    const card = buildTrafficRevenueProfitCard({
      channelId: "paid",
      channelLabel: "Paid",
      sessions: 3640,
      revenue: 18_900,
      orders: 68,
      aov: 278,
      isPaid: true,
      connected: true,
      profitBreakdown: paidBreakdown,
      profitDashboard: {
        primary: {
          revenue: 22_000,
          grossProfit: 17_000,
          adSpend: 31_286,
          cogs: 500,
          shipping: 1200,
          transactionFees: 700,
          refunds: 0,
          netProfit: 6500,
          orders: 80,
          packagingCost: 0,
          taxes: 0,
        },
      } as never,
      storeTotals: {
        revenue: 22_000,
        netContribution: 6500,
        sessions: 5200,
      },
      adSpend: 31_286,
      roas: 0.6,
      recoveryProbabilityPct: 88,
      estimatedRecoveryMonthly: 14_000,
    });

    expect(card).not.toBeNull();
    expect(card!.tierLabel).toBe("Unprofitable");
    expect(card!.urgencyLabel).toBe("Immediate Action Required");
    expect(card!.contributionMarginPct).toBeLessThan(0);
    expect(card!.breakEvenRoas).not.toBeNull();
    expect(card!.primaryDriver).toBe("Advertising Cost");
    expect(card!.flowInsight).toContain("losing money");
    expect(card!.opportunityText).toContain("break-even ROAS");
    expect(card!.trafficBenchmark.trafficSharePct).toBeCloseTo(70, 0);
    expect(card!.trafficBenchmark.profitSharePct).toBeLessThan(0);
    expect(card!.recommendationConfidencePct).toBe(88);
    expect(card!.potentialRecoveryMonthly).toBe(14_000);
  });
});
