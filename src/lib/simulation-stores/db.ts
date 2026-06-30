import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { BusinessModel } from "@/lib/business-model/types";
import type { SimulationScenarioId, ScenarioParams } from "@/lib/simulation-lab/types";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { DEFAULT_SIMULATION_STORES } from "./catalog";
import type { SimulationStoreMeta, SimulationStoreRow } from "./types";

const memoryStores = new Map<string, SimulationStoreRow>();

function rowToStore(row: Record<string, unknown>): SimulationStoreRow {
  return {
    storeId: row.store_id as string,
    slug: row.slug as string,
    label: row.label as string,
    scenarioId: row.scenario_id as SimulationScenarioId,
    businessModel: row.business_model as BusinessModel,
    simulatedAt: row.simulated_at as string,
    generatedAt: (row.generated_at as string | null) ?? null,
    seedParams: (row.seed_params as Partial<ScenarioParams>) ?? {},
    meta: (row.meta as SimulationStoreMeta) ?? {},
  };
}

/** @deprecated Use DEFAULT_SIMULATION_STORES from catalog.ts */
const FALLBACK_STORES = DEFAULT_SIMULATION_STORES;

export { isSimulationStoreId };

export async function isSimulationStore(storeId: string): Promise<boolean> {
  if (!isSimulationStoreId(storeId)) return false;
  const supabase = getSupabaseAdmin();
  if (!supabase) return true;

  const { data } = await supabase
    .from("stores")
    .select("is_simulation")
    .eq("id", storeId)
    .maybeSingle();

  return Boolean((data as { is_simulation?: boolean } | null)?.is_simulation);
}

export async function listSimulationStores(): Promise<SimulationStoreRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [...memoryStores.values()].length ? [...memoryStores.values()] : FALLBACK_STORES;

  const { data, error } = await supabase
    .from("simulation_stores")
    .select("*")
    .order("label");

  if (error || !data?.length) return FALLBACK_STORES;
  return (data as Record<string, unknown>[]).map(rowToStore);
}

export async function getSimulationStoreById(storeId: string): Promise<SimulationStoreRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return memoryStores.get(storeId) ?? FALLBACK_STORES.find((s) => s.storeId === storeId) ?? null;
  }

  const { data } = await supabase
    .from("simulation_stores")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();

  if (!data) {
    return FALLBACK_STORES.find((s) => s.storeId === storeId) ?? null;
  }
  return rowToStore(data as Record<string, unknown>);
}

export async function getSimulationStoreBySlug(slug: string): Promise<SimulationStoreRow | null> {
  const stores = await listSimulationStores();
  return stores.find((s) => s.slug === slug) ?? null;
}

export async function updateSimulationStoreMeta(
  storeId: string,
  patch: Partial<SimulationStoreMeta> & {
    generatedAt?: string | null;
    seedParams?: Partial<ScenarioParams>;
    scenarioId?: SimulationScenarioId;
    businessModel?: BusinessModel;
  },
): Promise<void> {
  const existing = (await getSimulationStoreById(storeId)) ?? {
    storeId,
    slug: "unknown",
    label: "Simulation",
    scenarioId: "healthy_store" as SimulationScenarioId,
    businessModel: "own_inventory" as BusinessModel,
    simulatedAt: new Date().toISOString(),
    generatedAt: null,
    seedParams: {},
    meta: {},
  };

  const {
    generatedAt,
    seedParams,
    scenarioId,
    businessModel,
    ...metaPatch
  } = patch;

  const merged: SimulationStoreRow = {
    ...existing,
    generatedAt: generatedAt !== undefined ? generatedAt : existing.generatedAt,
    seedParams: seedParams ?? existing.seedParams,
    scenarioId: scenarioId ?? existing.scenarioId,
    businessModel: businessModel ?? existing.businessModel,
    meta: { ...existing.meta, ...metaPatch },
  };

  memoryStores.set(storeId, merged);

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("simulation_stores").upsert(
    {
      store_id: storeId,
      slug: merged.slug,
      label: merged.label,
      scenario_id: merged.scenarioId,
      business_model: merged.businessModel,
      simulated_at: merged.simulatedAt,
      generated_at: merged.generatedAt,
      seed_params: merged.seedParams,
      meta: merged.meta,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "store_id" },
  );
}
