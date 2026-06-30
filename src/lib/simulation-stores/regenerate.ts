import { generateSimulationSnapshot } from "@/lib/simulation-lab/generator";
import { getScenarioById } from "@/lib/simulation-lab/scenarios";
import { simulationStoreIdForScenario } from "@/lib/simulation-lab/store-ids";
import type { BusinessModel } from "@/lib/business-model/types";
import type { SimulationScenarioId, ScenarioParams } from "@/lib/simulation-lab/types";
import { getSimulationStoreById, getSimulationStoreBySlug, updateSimulationStoreMeta } from "./db";
import { clearSimulationStoreData, persistSimulationSnapshot } from "./persist";
import type { RegenerateResult } from "./types";

export async function regenerateSimulationStore(input: {
  storeId?: string;
  slug?: string;
  scenarioId?: SimulationScenarioId;
  businessModel?: BusinessModel;
  customParams?: Partial<ScenarioParams>;
  clearExisting?: boolean;
}): Promise<RegenerateResult> {
  let store = input.storeId
    ? await getSimulationStoreById(input.storeId)
    : input.slug
      ? await getSimulationStoreBySlug(input.slug)
      : null;

  const scenarioId =
    input.scenarioId ?? store?.scenarioId ?? ("healthy_store" as SimulationScenarioId);
  const scenario = getScenarioById(scenarioId);
  if (!scenario && scenarioId !== "custom") {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }

  const businessModel =
    input.businessModel ?? store?.businessModel ?? scenario?.defaultBusinessModel ?? "own_inventory";

  const storeId =
    input.storeId ??
    store?.storeId ??
    simulationStoreIdForScenario(scenarioId, businessModel);

  if (!store) {
    store = await getSimulationStoreById(storeId);
  }

  const seedParams: ScenarioParams = {
    ...(scenario?.params ?? {
      revenue30d: 15000,
      orders30d: 120,
      conversionRate30d: 2.1,
      metaSpend7d: 2800,
      metaRevenue7d: 6200,
      googleSpend7d: 1400,
      googleRevenue7d: 3800,
      sessions30d: 5200,
      refundRatePct: 2,
      products: [],
    }),
    ...input.customParams,
  };

  if (input.clearExisting !== false) {
    await clearSimulationStoreData(storeId);
  }

  const snapshot = generateSimulationSnapshot(storeId, seedParams);
  await persistSimulationSnapshot(storeId, snapshot, {
    scenarioId,
    businessModel,
    seedParams,
  });

  if (store && store.scenarioId !== scenarioId) {
    await updateSimulationStoreMeta(storeId, { scenarioId, businessModel });
  }

  return {
    storeId,
    slug: store?.slug ?? storeId,
    scenarioId,
    generatedAt: new Date().toISOString(),
    productCount: snapshot.products.length,
    campaignCount: snapshot.campaigns.length,
  };
}

/** Seed from library — maps scenario to its permanent store or overflow lab store. */
export async function seedSimulationScenario(
  scenarioId: SimulationScenarioId,
  targetStoreId?: string,
): Promise<RegenerateResult> {
  const scenario = getScenarioById(scenarioId);
  return regenerateSimulationStore({
    storeId: targetStoreId,
    scenarioId,
    businessModel: scenario?.defaultBusinessModel,
    clearExisting: true,
  });
}

/** Generate persisted data for every permanent simulation store. */
export async function regenerateAllSimulationStores(): Promise<RegenerateResult[]> {
  const { listSimulationStores } = await import("./db");
  const stores = await listSimulationStores();
  const results: RegenerateResult[] = [];

  for (const store of stores) {
    results.push(
      await regenerateSimulationStore({
        storeId: store.storeId,
        scenarioId: store.scenarioId,
        businessModel: store.businessModel,
        clearExisting: true,
      }),
    );
  }

  return results;
}
