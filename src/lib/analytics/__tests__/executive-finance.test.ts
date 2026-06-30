import {
  buildProfitCalculationTrace,
  buildRawMoneyLeaks,
  computeRecoveryTotals,
  computeTrackingScore,
  dedupeMoneyLeaks,
  explainInventoryScore,
  explainProfitabilityScore,
  sanitizeTimelineText,
} from "@/lib/analytics/executive-finance";
import { validateExecutiveFinancials } from "@/lib/analytics/executive-validation";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { describe, expect, it } from "vitest";

describe("executive-finance", () => {
  const snapshot = getPeakOutfittersSnapshot();
  const profitDashboard = computeProfitDashboard(snapshot, [])!;

  it("profit trace balances to estimated profit", () => {
    const trace = buildProfitCalculationTrace(profitDashboard, snapshot);
    expect(trace.status).not.toBe("unavailable");
    expect(Math.abs(trace.computedProfit - trace.estimatedProfit)).toBeLessThanOrEqual(1);
    expect(trace.isBalanced).toBe(true);
  });

  it("dedupes High CPA when campaign leaks cover the same waste", () => {
    const raw = buildRawMoneyLeaks(profitDashboard, snapshot);
    const hasCampaign = raw.some((r) => r.category === "campaign");
    const hasAggregate = raw.some((r) => r.id === "leak-high-cpa");
    const deduped = dedupeMoneyLeaks(raw);
    if (hasCampaign && hasAggregate) {
      expect(deduped.excludedOverlaps.some((e) => e.label === "High CPA")).toBe(true);
      expect(deduped.items.some((i) => i.label === "High CPA")).toBe(false);
    }
    const sum = deduped.items.reduce((s, i) => s + i.amountMonthly, 0);
    expect(deduped.totalLostMonthly).toBe(sum);
  });

  it("computes gross and net recovery with net <= gross", () => {
    const totals = computeRecoveryTotals([
      { id: "1", title: "Pause Meta Prospecting", impactMonthly: 4334, confidencePct: 90 },
      { id: "2", title: "Reduce Retargeting budget", impactMonthly: 3546, confidencePct: 85 },
      { id: "3", title: "Reduce Customer Acquisition Cost", impactMonthly: 2000, confidencePct: 80 },
    ]);
    expect(totals.grossMonthly).toBe(4334 + 3546 + 2000);
    expect(totals.netMonthly).toBeLessThanOrEqual(totals.grossMonthly);
    expect(totals.overlapRemoved).toBe(totals.grossMonthly - totals.netMonthly);
  });

  it("tracking score reflects integration completeness", () => {
    const score = computeTrackingScore(snapshot);
    expect(score).toBeLessThan(100);
    if (!snapshot.ga4Snapshot?.sessions30d) {
      expect(score).toBeLessThan(95);
    }
  });

  it("inventory explanation matches low score", () => {
    const text = explainInventoryScore(15, 5);
    expect(text.toLowerCase()).toContain("critically");
    expect(text.toLowerCase()).not.toContain("within normal range");
  });

  it("profitability explanation reflects negative profit", () => {
    const text = explainProfitabilityScore(42, -18161, 30000, 10000);
    expect(text.toLowerCase()).toContain("below profitability");
    expect(text.toLowerCase()).not.toContain("stable");
  });

  it("sanitizes timeline stockout text", () => {
    expect(sanitizeTimelineText("SKU will be out of stock within 0 days")).toBe(
      "SKU is out of stock today",
    );
    expect(sanitizeTimelineText("0 days remaining")).toBe("less than 24 hours remaining");
  });

  it("validation passes for demo snapshot", () => {
    const raw = buildRawMoneyLeaks(profitDashboard, snapshot);
    const report = validateExecutiveFinancials({
      profitDashboard,
      snapshot,
      rawMoneyLeakSources: raw,
      recommendations: [
        { id: "a", title: "Pause campaign", impactMonthly: 1000, confidencePct: 90 },
      ],
      healthCategories: [
        { label: "Inventory", score: 15, explanation: explainInventoryScore(15, 3) },
      ],
    });
    expect(report.profitTrace.isBalanced).toBe(true);
    expect(report.recovery.netMonthly).toBeLessThanOrEqual(report.recovery.grossMonthly);
  });
});
