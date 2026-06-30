import { compareSlowProductStrategies } from "@/lib/decisions/strategy-comparison";
import { QA_SCENARIOS } from "./scenarios";
import type { ScenarioRunResult } from "./types";

export function runScenarioTests(): ScenarioRunResult[] {
  return QA_SCENARIOS.map((scenario) => {
    const result = compareSlowProductStrategies({
      product: scenario.product,
      merchantMode: scenario.merchantMode ?? "profit",
    });

    const actual = result.recommended.strategyId;
    const passed = actual === scenario.expectedStrategyId;

    return {
      scenarioId: scenario.id,
      label: scenario.label,
      passed,
      expected: scenario.expectedStrategyId,
      actual: `${result.recommended.label} (${actual})`,
      detail: result.explanation.split("\n").slice(0, 2).join(" "),
    };
  });
}

export function scenariosAllPassed(results: ScenarioRunResult[]): boolean {
  return results.every((r) => r.passed);
}
