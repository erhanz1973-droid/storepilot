import type { DemoScenarioDefinition, DemoScenarioId } from "./types";

export const DEFAULT_DEMO_SCENARIO_ID: DemoScenarioId = "healthy_growth";

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenarioDefinition> = {
  healthy_growth: {
    id: "healthy_growth",
    label: "Healthy Growth Store",
    description:
      "Alpine Outfitters — profitable outdoor apparel brand used for App Store and product demos.",
    personality: "growth",
    focusVerbs: ["Scale", "Expand", "Increase budget", "Grow revenue", "Increase customer lifetime value"],
    storeDisplayName: "Alpine Outfitters",
    revenue30d: 82_450,
    orders30d: 1_248,
    aov: 66.1,
    conversionRatePct: 3.4,
    metaSpend7d: 2_298,
    metaRevenue7d: 8_143,
    googleSpend7d: 1_265,
    googleRevenue7d: 5_507,
    sessions30d: 54_800,
    storeHealthScore: 94,
    businessStatus: "Healthy Growth",
    revenueChangePct: 14,
    profitChangePct: 12,
    inventoryRisk: "low",
  },
  struggling: {
    id: "struggling",
    label: "Struggling Store",
    description: "Unprofitable acquisition — AI focuses on recovery and waste reduction.",
    personality: "recovery",
    focusVerbs: ["Reduce waste", "Fix profitability", "Improve efficiency", "Recover cash flow"],
    storeDisplayName: "Peak Outfitters",
    revenue30d: 184_250,
    orders30d: 1_487,
    aov: 123.9,
    conversionRatePct: 2.54,
    metaSpend7d: 7_580,
    metaRevenue7d: 21_200,
    googleSpend7d: 3_800,
    googleRevenue7d: 9_400,
    sessions30d: 58_420,
    storeHealthScore: 41,
    businessStatus: "Needs Recovery",
    revenueChangePct: -8,
    profitChangePct: -22,
    inventoryRisk: "medium",
  },
  scaling: {
    id: "scaling",
    label: "Scaling Store",
    description: "Fast growth with operational pressure — AI focuses on inventory and fulfillment.",
    personality: "operations",
    focusVerbs: [
      "Manage growth",
      "Protect operations",
      "Improve forecasting",
      "Increase inventory",
    ],
    storeDisplayName: "TrailForge Outdoors",
    revenue30d: 450_000,
    orders30d: 3_200,
    aov: 140.63,
    conversionRatePct: 2.9,
    metaSpend7d: 28_000,
    metaRevenue7d: 72_800,
    googleSpend7d: 14_000,
    googleRevenue7d: 36_400,
    sessions30d: 110_000,
    storeHealthScore: 84,
    businessStatus: "Scaling",
    revenueChangePct: 28,
    profitChangePct: 9,
    inventoryRisk: "high",
    lowStockHeroSkus: 6,
  },
  seasonal: {
    id: "seasonal",
    label: "Seasonal Business",
    description: "Demand spike in season — AI prepares inventory, ads, and fulfillment.",
    personality: "seasonal",
    focusVerbs: [
      "Prepare for demand",
      "Prevent stockouts",
      "Increase fulfillment capacity",
      "Protect customer experience",
    ],
    storeDisplayName: "Winter Peak Gear",
    revenue30d: 140_000,
    orders30d: 1_050,
    aov: 133.33,
    conversionRatePct: 3.4,
    metaSpend7d: 12_600,
    metaRevenue7d: 50_400,
    googleSpend7d: 6_300,
    googleRevenue7d: 25_200,
    sessions30d: 31_000,
    storeHealthScore: 78,
    businessStatus: "Seasonal Peak",
    revenueChangePct: 536,
    profitChangePct: 48,
    previous30Revenue: 22_000,
    inventoryRisk: "high",
    lowStockHeroSkus: 4,
  },
};

export const DEMO_SCENARIO_LIST = Object.values(DEMO_SCENARIOS);

export function isDemoScenarioId(value: string): value is DemoScenarioId {
  return value in DEMO_SCENARIOS;
}

export function getDemoScenario(id: DemoScenarioId): DemoScenarioDefinition {
  return DEMO_SCENARIOS[id];
}
