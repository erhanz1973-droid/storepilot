import { describe, expect, it } from "vitest";
import {
  emptyAdvertisingWorkspace,
  emptyAttributionDashboard,
} from "@/lib/advertising/empty-workspace";

describe("empty advertising / attribution models", () => {
  it("builds a usable empty attribution dashboard", () => {
    const dashboard = emptyAttributionDashboard("2026-07-13T00:00:00.000Z");
    expect(dashboard.campaigns).toEqual([]);
    expect(dashboard.channels).toEqual([]);
    expect(dashboard.confidence.reason).toContain("not available");
    expect(dashboard.strategyPlan.breakEvenModel.breakEvenRoas).toBeGreaterThan(0);
  });

  it("builds a usable empty advertising workspace", () => {
    const workspace = emptyAdvertisingWorkspace("2026-07-13T00:00:00.000Z");
    expect(workspace.campaigns).toEqual([]);
    expect(workspace.overview.businessStatus).toBe("Attribution data is not available yet.");
    expect(workspace.accountability.dailyPriority.title).toContain("Attribution");
  });
});
