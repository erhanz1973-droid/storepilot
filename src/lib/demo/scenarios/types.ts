export type DemoScenarioId =
  | "healthy_growth"
  | "struggling"
  | "scaling"
  | "seasonal";

export type DemoScenarioPersonality = "growth" | "recovery" | "operations" | "seasonal";

export type DemoScenarioDefinition = {
  id: DemoScenarioId;
  label: string;
  description: string;
  personality: DemoScenarioPersonality;
  /** Short verbs shown in AI copy */
  focusVerbs: string[];
  storeDisplayName: string;
  revenue30d: number;
  orders30d: number;
  aov: number;
  conversionRatePct: number;
  metaSpend7d: number;
  metaRevenue7d: number;
  googleSpend7d: number;
  googleRevenue7d: number;
  sessions30d: number;
  storeHealthScore: number;
  businessStatus: string;
  revenueChangePct: number;
  profitChangePct: number;
  /** Previous 30d revenue — used for seasonal contrast */
  previous30Revenue?: number;
  inventoryRisk?: "low" | "medium" | "high";
  lowStockHeroSkus?: number;
};
