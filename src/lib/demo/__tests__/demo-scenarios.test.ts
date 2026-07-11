import { describe, expect, it } from "vitest";
import { buildDemoSnapshot } from "@/lib/demo/get-demo-snapshot";
import { DEFAULT_DEMO_SCENARIO_ID, DEMO_SCENARIOS } from "@/lib/demo/scenarios/registry";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildDailyAiPlaybook } from "@/lib/analytics/ai-daily-playbook";
import { buildRevenueStudio } from "@/lib/analytics/revenue-studio";

describe("demo scenarios", () => {
  it("defaults to healthy growth", () => {
    expect(DEFAULT_DEMO_SCENARIO_ID).toBe("healthy_growth");
  });

  it("builds distinct snapshots per scenario", () => {
    const healthy = buildDemoSnapshot("healthy_growth");
    const struggling = buildDemoSnapshot("struggling");
    const scaling = buildDemoSnapshot("scaling");
    const seasonal = buildDemoSnapshot("seasonal");

    expect(healthy.storeMetrics.revenue30d).toBe(DEMO_SCENARIOS.healthy_growth.revenue30d);
    expect(scaling.storeMetrics.revenue30d).toBeGreaterThan(healthy.storeMetrics.revenue30d);
    expect(seasonal.salesTrends?.previous30Days.revenue).toBe(22_000);
    expect(struggling.demoScenario).toBe("struggling");
    expect(healthy.demoScenario).toBe("healthy_growth");
    expect(struggling.storeMetrics.revenue30d).not.toBe(healthy.storeMetrics.revenue30d);
  });

  it("produces scenario-aware playbook personalities", () => {
    const healthy = buildDemoSnapshot("healthy_growth");
    const struggling = buildDemoSnapshot("struggling");
    const profitHealthy = computeProfitDashboard(healthy, []);
    const profitStruggling = computeProfitDashboard(struggling, []);

    const healthyPlaybook = buildDailyAiPlaybook({
      snapshot: healthy,
      revenueStudio: buildRevenueStudio({ snapshot: healthy, profitDashboard: profitHealthy }),
      salesOpportunities: [],
    });
    const strugglingPlaybook = buildDailyAiPlaybook({
      snapshot: struggling,
      revenueStudio: buildRevenueStudio({ snapshot: struggling, profitDashboard: profitStruggling }),
      salesOpportunities: [],
    });

    expect(healthyPlaybook.subtitle).toContain("Scale");
    expect(strugglingPlaybook.items.some((i) => i.title.toLowerCase().includes("reduce"))).toBe(true);
  });

  it("sets low stock products for scaling scenario", () => {
    const scaling = buildDemoSnapshot("scaling");
    const lowStock = scaling.products.filter((p) => p.inventoryQuantity < 20 && p.unitsSold30d >= 10);
    expect(lowStock.length).toBeGreaterThan(0);
  });
});
