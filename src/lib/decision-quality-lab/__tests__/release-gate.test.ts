import { describe, expect, it } from "vitest";
import { runQualitySimulation } from "../runner";
import { evaluateReleaseQualityGate } from "../release-gate";

describe("release quality gate", () => {
  it("passes when all thresholds met", () => {
    const gate = evaluateReleaseQualityGate({
      accuracyPct: 96,
      businessModelCompliancePct: 100,
      validationCoveragePct: 100,
      criticalScenarioPassPct: 100,
      avgQualityPct: 92,
      driftFailures: 0,
    });
    expect(gate.passed).toBe(true);
    expect(gate.productionReady).toBe(true);
  });

  it("blocks when accuracy below threshold", () => {
    const gate = evaluateReleaseQualityGate({
      accuracyPct: 88,
      businessModelCompliancePct: 100,
      validationCoveragePct: 100,
      criticalScenarioPassPct: 100,
      avgQualityPct: 92,
    });
    expect(gate.passed).toBe(false);
    expect(gate.failedChecks).toContain("Decision Accuracy");
  });

  it("runs quality simulation end-to-end", async () => {
    const result = await runQualitySimulation({
      scenarioId: "dead_inventory",
      businessModel: "own_inventory",
    });
    expect(result.runId).toBeTruthy();
    expect(result.summary).toBeDefined();
    expect(result.semantic.verdict).toMatch(/pass|warn|fail/);
    expect(result.summary.avgQualityPct).toBeGreaterThanOrEqual(0);
  }, 30_000);
});
