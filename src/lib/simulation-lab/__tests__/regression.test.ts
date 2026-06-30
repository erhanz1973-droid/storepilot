import { describe, expect, it } from "vitest";
import { runFullSimulation } from "../runner";
import { evaluateExpectedDecisions } from "../evaluator";
import { SIMULATION_SCENARIOS } from "../scenarios";

describe("simulation lab regression", () => {
  it("runs dead_inventory for own_inventory and finds inventory-related decisions", async () => {
    const result = await runFullSimulation({
      scenarioId: "dead_inventory",
      businessModel: "own_inventory",
    });
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.performance.decisionEngineMs).toBeLessThan(5000);
    expect(["pass", "warn", "fail"]).toContain(result.verdict);
  }, 30_000);

  it("blocks inventory clearance decisions for dropshipping dead_inventory", async () => {
    const result = await runFullSimulation({
      scenarioId: "dead_inventory",
      businessModel: "dropshipping",
    });
    const inventoryForbidden = result.forbiddenHits.some((h) =>
      /inventory|clearance|reorder|warehouse|aging/i.test(h),
    );
    if (inventoryForbidden) {
      expect(result.verdict).toBe("fail");
    }
  }, 30_000);

  it("evaluates keyword matching", () => {
    const evaluation = evaluateExpectedDecisions(
      [
        {
          id: "d1",
          status: "open",
          summary: "Scale winning Meta campaign",
          why: "ROAS above target",
          recommendedAction: "Increase budget",
          confidencePct: 82,
          priority: "high",
          supportingMetrics: [],
        } as never,
      ],
      SIMULATION_SCENARIOS.find((s) => s.id === "scaling_opportunity")!.expectedDecisions,
    );
    expect(evaluation.passCount).toBeGreaterThan(0);
  });

  it("runs healthy_store without required decisions", async () => {
    const result = await runFullSimulation({
      scenarioId: "healthy_store",
      businessModel: "own_inventory",
    });
    expect(result.verdict).toBe("pass");
  }, 30_000);
});
