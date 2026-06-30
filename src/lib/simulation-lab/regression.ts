import type { BusinessModel } from "@/lib/business-model/types";
import { SIMULATION_SCENARIOS } from "./scenarios";
import { runFullSimulation } from "./runner";
import type { SimulationRegressionReport, SimulationRunResult } from "./types";

const REGRESSION_BUSINESS_MODELS: BusinessModel[] = [
  "own_inventory",
  "dropshipping",
  "subscription",
  "print_on_demand",
  "digital_products",
];

export async function runSimulationRegressionSuite(options?: {
  businessModels?: BusinessModel[];
  scenarioIds?: string[];
}): Promise<SimulationRegressionReport> {
  const models = options?.businessModels ?? ["own_inventory", "dropshipping"];
  const scenarios = options?.scenarioIds
    ? SIMULATION_SCENARIOS.filter((s) => options.scenarioIds!.includes(s.id))
    : SIMULATION_SCENARIOS;

  const start = performance.now();
  const results: SimulationRunResult[] = [];

  for (const scenario of scenarios) {
    for (const businessModel of models) {
      const result = await runFullSimulation({
        scenarioId: scenario.id,
        businessModel,
      });
      results.push(result);
    }
  }

  const passed = results.filter((r) => r.verdict === "pass").length;
  const warned = results.filter((r) => r.verdict === "warn").length;
  const failed = results.filter((r) => r.verdict === "fail").length;

  return {
    generatedAt: new Date().toISOString(),
    totalScenarios: results.length,
    passed,
    warned,
    failed,
    results,
    performance: {
      generationMs: 0,
      validationMs: 0,
      decisionEngineMs: 0,
      totalMs: Math.round(performance.now() - start),
      withinTargets: results.every((r) => r.performance.withinTargets),
    },
  };
}

export async function runBusinessModelMatrix(
  scenarioId: import("./types").SimulationScenarioId,
): Promise<SimulationRunResult[]> {
  const results: SimulationRunResult[] = [];
  for (const businessModel of REGRESSION_BUSINESS_MODELS) {
    results.push(await runFullSimulation({ scenarioId, businessModel }));
  }
  return results;
}
