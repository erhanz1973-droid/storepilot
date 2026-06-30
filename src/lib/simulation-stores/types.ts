import type { BusinessModel } from "@/lib/business-model/types";
import type { SimulationScenarioId, ScenarioParams } from "@/lib/simulation-lab/types";

export type SimulationStoreRow = {
  storeId: string;
  slug: string;
  label: string;
  scenarioId: SimulationScenarioId;
  businessModel: BusinessModel;
  simulatedAt: string;
  generatedAt: string | null;
  seedParams: Partial<ScenarioParams>;
  meta: SimulationStoreMeta;
};

export type SimulationStoreMeta = {
  simulatedDays?: number;
  lastRegeneratedAt?: string;
  lastTimeTravelAt?: string;
};

export type RegenerateResult = {
  storeId: string;
  slug: string;
  scenarioId: SimulationScenarioId;
  generatedAt: string;
  productCount: number;
  campaignCount: number;
};

export type TimeTravelResult = RegenerateResult & {
  daysAdvanced: number;
  totalSimulatedDays: number;
};

export type SimulationStoreExport = {
  store: SimulationStoreRow;
  exportedAt: string;
  shopifyCache: unknown;
  metaCache: unknown;
  googleCache: unknown;
  productCosts: unknown[];
};
