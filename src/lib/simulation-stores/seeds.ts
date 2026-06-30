import { SIMULATION_SCENARIOS } from "@/lib/simulation-lab/scenarios";
import type { SimulationScenarioId } from "@/lib/simulation-lab/types";

/** One-click seed library for regeneration. */
export type SimulationSeed = {
  id: SimulationScenarioId;
  label: string;
  description: string;
};

export const SIMULATION_SEED_LIBRARY: SimulationSeed[] = [
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
  { id: "winning_product", label: "Dropshipping", description: "Single-SKU dropship winner" },
];

export function getSeedById(id: SimulationScenarioId): SimulationSeed | undefined {
  const fromLibrary = SIMULATION_SEED_LIBRARY.find((s) => s.id === id);
  if (fromLibrary) return fromLibrary;
  const scenario = SIMULATION_SCENARIOS.find((s) => s.id === id);
  if (!scenario) return undefined;
  return { id: scenario.id, label: scenario.label, description: scenario.description };
}
