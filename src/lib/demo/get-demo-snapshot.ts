import { buildStrugglingStoreSnapshot } from "@/lib/demo/scenarios/struggling";
import { buildParameterizedDemoSnapshot } from "@/lib/demo/scenarios/build-parameterized";
import {
  DEFAULT_DEMO_SCENARIO_ID,
  getDemoScenario,
  isDemoScenarioId,
} from "@/lib/demo/scenarios/registry";
import type { DemoScenarioId } from "@/lib/demo/scenarios/types";
import type { StoreSnapshot } from "@/lib/connectors/types";

export type { DemoScenarioId } from "@/lib/demo/scenarios/types";
export { DEFAULT_DEMO_SCENARIO_ID, DEMO_SCENARIOS, DEMO_SCENARIO_LIST } from "@/lib/demo/scenarios/registry";

export function buildDemoScenarioSnapshot(scenarioId: DemoScenarioId): StoreSnapshot {
  if (scenarioId === "struggling") {
    return buildStrugglingStoreSnapshot();
  }
  return buildParameterizedDemoSnapshot(getDemoScenario(scenarioId));
}

export function resolveDemoScenarioId(raw: string | null | undefined): DemoScenarioId {
  if (raw && isDemoScenarioId(raw)) return raw;
  return DEFAULT_DEMO_SCENARIO_ID;
}

export function buildDemoSnapshot(scenarioId: DemoScenarioId = DEFAULT_DEMO_SCENARIO_ID): StoreSnapshot {
  const snapshot = buildDemoScenarioSnapshot(scenarioId);
  return { ...snapshot, demoScenario: scenarioId };
}
