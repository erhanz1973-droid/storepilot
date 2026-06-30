import { describe, expect, it } from "vitest";
import {
  breakdownWithPercentages,
  buildChannelBenchmark,
  enrichChannelProfitabilityCard,
  profitabilityTierFromMargin,
} from "@/lib/analytics/channel-profitability-card";

describe("channel-profitability-card", () => {
  const breakdown = {
    revenue: 3300,
    advertisingCost: 0,
    cogs: 71,
    shipping: 172,
    paymentFees: 104,
    netContribution: 2953,
  };

  it("maps margin to profitability tier", () => {
    expect(profitabilityTierFromMargin(89.5, 2953).tierLabel).toBe("Highly Profitable");
    expect(profitabilityTierFromMargin(-12, -200).tierLabel).toBe("Losing Money");
  });

  it("adds percentage lines to breakdown", () => {
    const lines = breakdownWithPercentages(breakdown);
    expect(lines.find((l) => l.id === "revenue")?.pctOfRevenue).toBe(100);
    expect(lines.find((l) => l.id === "net")?.pctOfRevenue).toBeCloseTo(89.5, 0);
    expect(lines.find((l) => l.id === "cogs")?.pctOfRevenue).toBeCloseTo(2.2, 0);
  });

  it("builds benchmark insight when profit share exceeds revenue share", () => {
    const bench = buildChannelBenchmark({
      channelRevenue: 3300,
      channelNetContribution: 2953,
      storeRevenue: 15000,
      storeNetContribution: 8000,
    });
    expect(bench.revenueSharePct).toBeCloseTo(22, 0);
    expect(bench.profitSharePct).toBeGreaterThan(bench.revenueSharePct);
    expect(bench.insight).toContain("disproportionately");
  });

  it("enriches a full decision card", () => {
    const card = enrichChannelProfitabilityCard({
      channelId: "direct",
      channelLabel: "Direct",
      sessions: 1200,
      revenue: 3300,
      orders: 12,
      aov: 275,
      isPaid: false,
      connected: true,
      profitBreakdown: breakdown,
      storeTotals: { revenue: 15000, netContribution: 8000, sessions: 10000 },
      adSpend: 0,
      roas: null,
      isHighestMargin: true,
    });

    expect(card).not.toBeNull();
    expect(card!.tierLabel).toBe("Highly Profitable");
    expect(card!.summaryLine).toContain("No advertising cost");
    expect(card!.aiInsight.length).toBeGreaterThan(40);
    expect(card!.benchmark.revenueSharePct).toBeGreaterThan(0);
    expect(card!.recommendedAction.length).toBeGreaterThan(10);
  });
});
