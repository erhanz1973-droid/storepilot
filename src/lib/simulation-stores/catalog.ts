import type { SimulationScenarioId } from "@/lib/simulation-lab/types";
import { getScenarioById } from "@/lib/simulation-lab/scenarios";
import { SIMULATION_STORE_BY_SLUG } from "@/lib/simulation-lab/store-ids";
import type { SimulationStoreRow } from "./types";

/** Customer-facing one-line scenario descriptions for Simulation Lab cards. */
export function getScenarioCustomerDescription(scenarioId: SimulationScenarioId): string {
  const fromScenario = getScenarioById(scenarioId)?.description;
  if (fromScenario) return fromScenario;

  const seed = DEFAULT_SIMULATION_SEEDS.find((s) => s.id === scenarioId);
  return seed?.description ?? "Explore how StorePilot AI analyzes this business scenario.";
}

/** Built-in simulation stores — always available even before Supabase migrations run. */
export const DEFAULT_SIMULATION_STORES: SimulationStoreRow[] = Object.entries(
  SIMULATION_STORE_BY_SLUG,
).map(([slug, storeId]) => {
  const defs: Record<string, Omit<SimulationStoreRow, "storeId" | "slug">> = {
    simulation_healthy: {
      label: "Healthy Store",
      scenarioId: "healthy_store",
      businessModel: "own_inventory",
      simulatedAt: new Date().toISOString(),
      generatedAt: null,
      seedParams: {},
      meta: {},
    },
    simulation_inventory: {
      label: "Dead Inventory Store",
      scenarioId: "dead_inventory",
      businessModel: "own_inventory",
      simulatedAt: new Date().toISOString(),
      generatedAt: null,
      seedParams: {},
      meta: {},
    },
    simulation_roas: {
      label: "Advertising Disaster",
      scenarioId: "roas_collapse",
      businessModel: "dropshipping",
      simulatedAt: new Date().toISOString(),
      generatedAt: null,
      seedParams: {},
      meta: {},
    },
    simulation_dropshipping: {
      label: "Dropshipping Store",
      scenarioId: "winning_product",
      businessModel: "dropshipping",
      simulatedAt: new Date().toISOString(),
      generatedAt: null,
      seedParams: {},
      meta: {},
    },
    simulation_scaling: {
      label: "Scaling Opportunity",
      scenarioId: "scaling_opportunity",
      businessModel: "own_inventory",
      simulatedAt: new Date().toISOString(),
      generatedAt: null,
      seedParams: {},
      meta: {},
    },
    simulation_subscription: {
      label: "Subscription Business",
      scenarioId: "subscription_churn",
      businessModel: "subscription",
      simulatedAt: new Date().toISOString(),
      generatedAt: null,
      seedParams: {},
      meta: {},
    },
    simulation_digital: {
      label: "Digital Products",
      scenarioId: "organic_growth",
      businessModel: "digital_products",
      simulatedAt: new Date().toISOString(),
      generatedAt: null,
      seedParams: {},
      meta: {},
    },
    simulation_lab: {
      label: "Simulation Lab (overflow)",
      scenarioId: "healthy_store",
      businessModel: "own_inventory",
      simulatedAt: new Date().toISOString(),
      generatedAt: null,
      seedParams: {},
      meta: {},
    },
  };
  const def = defs[slug] ?? defs.simulation_lab;
  return { storeId, slug, ...def };
});

export type SimulationSeedCatalogItem = {
  id: SimulationScenarioId;
  label: string;
  description: string;
};

export const DEFAULT_SIMULATION_SEEDS: SimulationSeedCatalogItem[] = [
  { id: "healthy_store", label: "Healthy Store", description: "Balanced metrics across channels" },
  { id: "roas_collapse", label: "Advertising Disaster", description: "High spend, weak return" },
  { id: "dead_inventory", label: "Dead Inventory", description: "High stock, near-zero velocity" },
  { id: "winning_product", label: "Winning Product", description: "Hero SKU with strong ROAS" },
  { id: "creative_fatigue", label: "Creative Fatigue", description: "Declining CTR with sustained spend" },
  { id: "scaling_opportunity", label: "Scaling Opportunity", description: "Room to grow profitable spend" },
  { id: "cash_flow_crisis", label: "Cash Flow Crisis", description: "Tight margins and slow turnover" },
  { id: "subscription_churn", label: "Subscription Growth", description: "Recurring revenue with churn risk" },
  { id: "organic_growth", label: "Digital Products", description: "Organic-led digital catalog" },
  { id: "launch_campaign", label: "Print On Demand", description: "Launch-phase POD store" },
  { id: "inventory_overstock", label: "General Store", description: "Broad catalog with overstock" },
  { id: "price_too_high", label: "Luxury Brand", description: "Premium pricing, lower volume" },
];
