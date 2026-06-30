import type { BusinessModel } from "@/lib/business-model/types";
import type { SimulationScenarioId } from "@/lib/simulation-lab/types";

/** Isolated simulation store UUIDs — 8001 namespace, never overlaps production/demo (8000). */
export const SIMULATION_STORE_BY_SLUG: Record<string, string> = {
  simulation_healthy: "00000000-0000-4000-8001-000000000010",
  simulation_inventory: "00000000-0000-4000-8001-000000000001",
  simulation_roas: "00000000-0000-4000-8001-000000000011",
  simulation_dropshipping: "00000000-0000-4000-8001-000000000002",
  simulation_scaling: "00000000-0000-4000-8001-000000000012",
  simulation_subscription: "00000000-0000-4000-8001-000000000003",
  simulation_digital: "00000000-0000-4000-8001-000000000005",
  simulation_lab: "00000000-0000-4000-8001-000000000099",
};

/** @deprecated Use SIMULATION_STORE_BY_SLUG */
export const SIMULATION_STORE_IDS = SIMULATION_STORE_BY_SLUG;

/** Scenario → permanent store mapping (Phase 4.2). */
export const SIMULATION_SCENARIO_TO_STORE: Partial<Record<SimulationScenarioId, string>> = {
  healthy_store: SIMULATION_STORE_BY_SLUG.simulation_healthy,
  dead_inventory: SIMULATION_STORE_BY_SLUG.simulation_inventory,
  roas_collapse: SIMULATION_STORE_BY_SLUG.simulation_roas,
  winning_product: SIMULATION_STORE_BY_SLUG.simulation_dropshipping,
  scaling_opportunity: SIMULATION_STORE_BY_SLUG.simulation_scaling,
  subscription_churn: SIMULATION_STORE_BY_SLUG.simulation_subscription,
  organic_growth: SIMULATION_STORE_BY_SLUG.simulation_digital,
  creative_fatigue: SIMULATION_STORE_BY_SLUG.simulation_roas,
  cash_flow_crisis: SIMULATION_STORE_BY_SLUG.simulation_inventory,
  inventory_overstock: SIMULATION_STORE_BY_SLUG.simulation_inventory,
  launch_campaign: SIMULATION_STORE_BY_SLUG.simulation_lab,
  price_too_high: SIMULATION_STORE_BY_SLUG.simulation_digital,
};

export function simulationStoreIdForScenario(
  scenarioId: SimulationScenarioId,
  businessModel?: BusinessModel,
): string {
  if (SIMULATION_SCENARIO_TO_STORE[scenarioId]) {
    return SIMULATION_SCENARIO_TO_STORE[scenarioId]!;
  }
  return simulationStoreIdForModel(businessModel ?? "own_inventory");
}

export function simulationStoreIdForModel(model: BusinessModel): string {
  const map: Record<BusinessModel, string> = {
    own_inventory: SIMULATION_STORE_BY_SLUG.simulation_inventory,
    dropshipping: SIMULATION_STORE_BY_SLUG.simulation_dropshipping,
    subscription: SIMULATION_STORE_BY_SLUG.simulation_subscription,
    print_on_demand: SIMULATION_STORE_BY_SLUG.simulation_lab,
    digital_products: SIMULATION_STORE_BY_SLUG.simulation_digital,
    private_label: SIMULATION_STORE_BY_SLUG.simulation_inventory,
    hybrid: SIMULATION_STORE_BY_SLUG.simulation_lab,
  };
  return map[model] ?? SIMULATION_STORE_BY_SLUG.simulation_lab;
}

export function isSimulationStoreId(storeId: string): boolean {
  return storeId.includes("-8001-");
}
