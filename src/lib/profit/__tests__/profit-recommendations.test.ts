import { PEAK_OUTFITTERS_BASE_SNAPSHOT } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import {
  buildAdvertisingReason,
  buildStagedRecoveryOpportunities,
  estimateBreakEvenRoas,
} from "@/lib/profit/profit-recommendations";
import { describe, expect, it } from "vitest";

describe("profit-recommendations", () => {
  const dashboard = computeProfitDashboard(PEAK_OUTFITTERS_BASE_SNAPSHOT, [])!;

  it("prioritizes optimization over pause recommendations", () => {
    const opportunities = buildStagedRecoveryOpportunities(
      dashboard,
      PEAK_OUTFITTERS_BASE_SNAPSHOT,
    );

    expect(opportunities.length).toBeGreaterThan(0);
    const first = opportunities[0]!;
    expect(first.priority).toBeLessThanOrEqual(3);
    expect(first.title.toLowerCase()).not.toMatch(/^pause /);
  });

  it("includes reasoning with break-even ROAS context", () => {
    const reason = buildAdvertisingReason(dashboard);
    expect(reason).toContain("ROAS");
    expect(estimateBreakEvenRoas(dashboard)).not.toBeNull();
  });

  it("ranks pause recommendations as last resort when present", () => {
    const opportunities = buildStagedRecoveryOpportunities(
      dashboard,
      PEAK_OUTFITTERS_BASE_SNAPSHOT,
    );
    const pause = opportunities.filter((o) => o.isLastResort);
    for (const opp of pause) {
      expect(opp.priority).toBe(4);
      expect(opp.rank).toBeGreaterThan(1);
    }
  });

  it("uses confidence-based language instead of immediate pause titles", () => {
    const opportunities = buildStagedRecoveryOpportunities(
      dashboard,
      PEAK_OUTFITTERS_BASE_SNAPSHOT,
    );

    for (const opp of opportunities.filter((o) => !o.isLastResort)) {
      expect(opp.description.toLowerCase()).not.toBe("pause campaign");
      expect(opp.reason.length).toBeGreaterThan(10);
    }
  });
});
