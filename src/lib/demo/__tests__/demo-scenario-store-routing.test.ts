import { describe, expect, it } from "vitest";
import { buildDemoSnapshot } from "@/lib/demo/get-demo-snapshot";
import { mergeIntegrationIntoSnapshot } from "@/lib/integrations/engine";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { generateSimulationSnapshot } from "@/lib/simulation-lab/generator";
import { simulationStoreIdForScenario } from "@/lib/simulation-lab/store-ids";
import { DEMO_SCENARIOS } from "@/lib/demo/scenarios/registry";

describe("demo scenario store routing", () => {
  it("healthy_growth demo snapshot is profitable after integrations merge", () => {
    const snapshot = mergeIntegrationIntoSnapshot(buildDemoSnapshot("healthy_growth"));
    const profit = computeProfitDashboard(snapshot, []);

    expect(snapshot.storeMetrics.revenue30d).toBe(DEMO_SCENARIOS.healthy_growth.revenue30d);
    expect((profit?.primary.netProfit ?? 0)).toBeGreaterThan(0);
    expect(profit?.primary.adSpend ?? 0).toBeLessThan(snapshot.storeMetrics.revenue30d);
  });

  it("simulation default economics are not inflated by peak-outfitters ad scale", () => {
    const storeId = simulationStoreIdForScenario("healthy_store", "own_inventory");
    const snapshot = generateSimulationSnapshot(storeId, {
      revenue30d: 15_000,
      orders30d: 120,
      conversionRate30d: 2.1,
      metaSpend7d: 2_800,
      metaRevenue7d: 6_200,
      googleSpend7d: 1_400,
      googleRevenue7d: 3_800,
      sessions30d: 5_200,
      refundRatePct: 2,
      products: [
        {
          id: "sim-test-1",
          title: "Test SKU",
          price: 40,
          unitCost: 12,
          inventory: 50,
          unitsSold30d: 30,
        },
      ],
    });
    const profit = computeProfitDashboard(snapshot, []);
    const adSpend30d = (2_800 + 1_400) * (30 / 7);

    expect(profit?.primary.adSpend ?? 0).toBeLessThanOrEqual(adSpend30d + 50);
    expect(profit?.primary.revenue).toBe(15_000);
  });
});
