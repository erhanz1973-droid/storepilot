import { describe, expect, it } from "vitest";
import {
  compareSnapshots,
  computeDeviationPct,
  computeMatchScore,
  diffSeverity,
  snapshotFromMetrics,
} from "@/lib/validation/framework/compare";

describe("validation framework compare", () => {
  it("computes deviation percent", () => {
    expect(computeDeviationPct(543.22, 543.22)).toBe(0);
    expect(computeDeviationPct(4.31, 4.32)).toBeLessThan(1);
  });

  it("assigns diff severity colors", () => {
    expect(diffSeverity(0)).toBe("green");
    expect(diffSeverity(1.2)).toBe("yellow");
    expect(diffSeverity(8.5)).toBe("red");
  });

  it("computes 100% match when snapshots align", () => {
    const snap = snapshotFromMetrics({
      spend: 543.22,
      roas: 4.31,
      revenue: 2340,
      purchases: 18,
      campaigns: 18,
      currency: "USD",
    });
    const comparisons = compareSnapshots(snap, snap);
    const score = computeMatchScore(comparisons);
    expect(score.percent).toBe(100);
    expect(score.status).toBe("green");
    expect(score.label).toBe("100% Match");
  });

  it("flags campaign count mismatch", () => {
    const dashboard = snapshotFromMetrics({
      spend: 100,
      roas: 2,
      revenue: 200,
      purchases: 5,
      campaigns: 18,
      currency: "USD",
    });
    const api = snapshotFromMetrics({
      spend: 100,
      roas: 2,
      revenue: 200,
      purchases: 5,
      campaigns: 17,
      currency: "USD",
    });
    const comparisons = compareSnapshots(dashboard, api);
    const campaignRow = comparisons.find((c) => c.metric === "Campaign Count");
    expect(campaignRow?.status).toBe("fail");
    expect(campaignRow?.severity).toBe("red");
  });

  it("produces partial match score", () => {
    const dashboard = snapshotFromMetrics({
      spend: 100,
      roas: 4.31,
      revenue: 430,
      purchases: 10,
      campaigns: 18,
      currency: "USD",
    });
    const api = snapshotFromMetrics({
      spend: 100,
      roas: 4.32,
      revenue: 430,
      purchases: 10,
      campaigns: 18,
      currency: "USD",
    });
    const score = computeMatchScore(compareSnapshots(dashboard, api));
    expect(score.percent).toBeGreaterThan(98);
    expect(score.percent).toBeLessThan(100);
  });
});
