import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  ALL_BUSINESS_GOALS,
  type BusinessGoal,
  type StoreBusinessGoals,
  normalizeBusinessGoal,
  normalizeBusinessGoals,
} from "@/lib/business-goals/types";

const memoryGoals = new Map<string, StoreBusinessGoals>();

const DEFAULT_GOALS: StoreBusinessGoals = {
  storeId: "",
  goals: ["increase_revenue"],
  primaryGoal: "increase_revenue",
};

function rowToGoals(storeId: string, row: Record<string, unknown>): StoreBusinessGoals {
  const rawGoals = (row.goals as string[]) ?? [];
  const goals = normalizeBusinessGoals(rawGoals);
  const primaryRaw = row.primary_goal as string;
  const primaryGoal =
    normalizeBusinessGoal(primaryRaw) ??
    (goals.includes(primaryRaw as BusinessGoal) ? (primaryRaw as BusinessGoal) : goals[0]!);

  return { storeId, goals, primaryGoal };
}

export async function getStoreBusinessGoals(storeId: string): Promise<StoreBusinessGoals> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return memoryGoals.get(storeId) ?? { ...DEFAULT_GOALS, storeId };
  }

  const { data, error } = await supabase
    .from("store_business_goals")
    .select("goals, primary_goal")
    .eq("store_id", storeId)
    .maybeSingle();

  if (error || !data) {
    return memoryGoals.get(storeId) ?? { ...DEFAULT_GOALS, storeId };
  }

  return rowToGoals(storeId, data as Record<string, unknown>);
}

export async function upsertStoreBusinessGoals(
  storeId: string,
  patch: { goals?: BusinessGoal[]; primaryGoal?: BusinessGoal },
): Promise<StoreBusinessGoals> {
  const existing = await getStoreBusinessGoals(storeId);
  const goals = patch.goals?.length ? normalizeBusinessGoals(patch.goals) : existing.goals;
  const primaryGoal =
    patch.primaryGoal && goals.includes(patch.primaryGoal)
      ? patch.primaryGoal
      : goals.includes(existing.primaryGoal)
        ? existing.primaryGoal
        : goals[0]!;

  const merged: StoreBusinessGoals = { storeId, goals, primaryGoal };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryGoals.set(storeId, merged);
    return merged;
  }

  const payload = {
    store_id: storeId,
    goals,
    primary_goal: primaryGoal,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("store_business_goals")
    .upsert(payload, { onConflict: "store_id" })
    .select("goals, primary_goal")
    .single();

  if (error || !data) {
    memoryGoals.set(storeId, merged);
    return merged;
  }

  return rowToGoals(storeId, data as Record<string, unknown>);
}

export function isValidBusinessGoal(value: string): value is BusinessGoal {
  return ALL_BUSINESS_GOALS.includes(value as BusinessGoal);
}
