import { describe, expect, it } from "vitest";
import { getPeakOutfittersSnapshot } from "@/lib/connectors/demo-data";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildOrderIntelligenceRows } from "@/lib/analytics/order-intelligence";
import {
  peakOutfittersOrderIntelligenceSeeds,
  peakOrderMarginPct,
  peakOrderNetProfit,
} from "@/lib/demo/peak-outfitters/order-intelligence";

describe("order intelligence", () => {
  it("demo orders follow realistic profit distribution", () => {
    const seeds = peakOutfittersOrderIntelligenceSeeds();
    const margins = seeds.map((s) => peakOrderMarginPct(s.revenue, peakOrderNetProfit(s)));

    const highlyProfitable = margins.filter((m) => m >= 30).length;
    const profitable = margins.filter((m) => m >= 10 && m < 30).length;
    const breakEven = margins.filter((m) => m >= -3 && m < 10).length;
    const losing = margins.filter((m) => m < -3).length;

    expect(highlyProfitable).toBeGreaterThanOrEqual(5);
    expect(profitable).toBeGreaterThanOrEqual(5);
    expect(breakEven).toBeGreaterThanOrEqual(2);
    expect(losing).toBeGreaterThanOrEqual(1);
    expect(highlyProfitable + profitable + breakEven + losing).toBe(20);
  });

  it("builds highlights and per-order breakdown for demo store", () => {
    const snapshot = getPeakOutfittersSnapshot();
    const profitDashboard = computeProfitDashboard(snapshot, []);
    const { orders, highlights } = buildOrderIntelligenceRows(snapshot, profitDashboard);

    expect(orders.length).toBe(20);
    expect(highlights.length).toBeGreaterThan(0);
    expect(orders[0].breakdown.revenue).toBe(orders[0].revenue);
    expect(orders.some((o) => o.channel === "Meta Ads" && o.profit > 0)).toBe(true);
    expect(orders.some((o) => o.channel === "Meta Ads" && o.profit < 0)).toBe(true);
    expect(orders.some((o) => o.channel === "Direct" && o.marginPct > 20)).toBe(true);
  });
});
