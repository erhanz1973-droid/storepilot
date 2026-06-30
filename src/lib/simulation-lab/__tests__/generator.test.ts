import { describe, expect, it } from "vitest";
import { generateSimulationSnapshot, assertSnapshotConsistency } from "../generator";
import { SIMULATION_SCENARIOS } from "../scenarios";
import { simulationStoreIdForModel } from "../store-ids";

describe("simulation generator", () => {
  it("produces consistent store metrics", () => {
    for (const scenario of SIMULATION_SCENARIOS.slice(0, 5)) {
      assertSnapshotConsistency(scenario.params);
      const storeId = simulationStoreIdForModel(scenario.defaultBusinessModel);
      const snapshot = generateSimulationSnapshot(storeId, scenario.params);
      expect(snapshot.storeMetrics.revenue30d).toBe(scenario.params.revenue30d);
      expect(snapshot.storeMetrics.orders30d).toBe(scenario.params.orders30d);
      expect(snapshot.products.length).toBe(scenario.params.products.length);

      const metaSpend = snapshot.campaigns.reduce((s, c) => s + c.spend7d, 0);
      expect(metaSpend).toBeCloseTo(scenario.params.metaSpend7d, 0);

      const totalSpend = snapshot.adSpendSnapshot?.totalRollups.last7d.spend ?? 0;
      expect(totalSpend).toBeCloseTo(
        scenario.params.metaSpend7d + scenario.params.googleSpend7d,
        0,
      );
    }
  });

  it("never produces negative ROAS inputs", () => {
    const snapshot = generateSimulationSnapshot(
      simulationStoreIdForModel("dropshipping"),
      SIMULATION_SCENARIOS.find((s) => s.id === "roas_collapse")!.params,
    );
    for (const c of snapshot.campaigns) {
      if (c.spend7d > 0) {
        expect(c.roas7d).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
