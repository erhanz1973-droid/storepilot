import { getSupabaseAdmin } from "@/lib/supabase/client";
import type {
  MerchantDNA,
  MerchantDNALearnedSignals,
  MerchantDNAManualOverrides,
} from "@/lib/merchant-dna/types";

type StoredProfile = {
  dna: MerchantDNA;
  learned: MerchantDNALearnedSignals;
  manualOverrides: MerchantDNAManualOverrides;
  benchmarkCohort?: string;
  version: number;
};

const memoryProfiles = new Map<string, StoredProfile>();

export async function getMerchantDnaProfile(storeId: string): Promise<StoredProfile | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return memoryProfiles.get(storeId) ?? null;

  const { data, error } = await supabase
    .from("merchant_dna_profiles")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();

  if (error || !data) return memoryProfiles.get(storeId) ?? null;

  const row = data as Record<string, unknown>;
  const dna = row.dna_json as MerchantDNA;
  return {
    dna,
    learned: (row.learned_signals as MerchantDNALearnedSignals) ?? dna.learned,
    manualOverrides: (row.manual_overrides as MerchantDNAManualOverrides) ?? {},
    benchmarkCohort: (row.benchmark_cohort as string) ?? undefined,
    version: Number(row.version ?? 1),
  };
}

export async function upsertMerchantDnaProfile(
  storeId: string,
  input: {
    dna: MerchantDNA;
    learned: MerchantDNALearnedSignals;
    manualOverrides: MerchantDNAManualOverrides;
    benchmarkCohort: string;
    version: number;
  },
): Promise<void> {
  const payload = {
    store_id: storeId,
    dna_json: input.dna,
    learned_signals: input.learned,
    manual_overrides: input.manualOverrides,
    benchmark_cohort: input.benchmarkCohort,
    version: input.version,
    inferred_at: input.dna.inferredAt,
    updated_at: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryProfiles.set(storeId, {
      dna: input.dna,
      learned: input.learned,
      manualOverrides: input.manualOverrides,
      benchmarkCohort: input.benchmarkCohort,
      version: input.version,
    });
    return;
  }

  await supabase.from("merchant_dna_profiles").upsert(payload, { onConflict: "store_id" });
}

export async function patchMerchantDnaOverrides(
  storeId: string,
  overrides: MerchantDNAManualOverrides,
): Promise<MerchantDNAManualOverrides> {
  const existing = await getMerchantDnaProfile(storeId);
  const merged = { ...(existing?.manualOverrides ?? {}), ...overrides };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryProfiles.set(storeId, {
      dna: existing?.dna ?? ({} as MerchantDNA),
      learned: existing?.learned ?? {
        aggressivenessBias: 0,
        scalingAffinity: 0,
        discountAffinity: 0,
        inventoryClearanceAffinity: 0,
      },
      manualOverrides: merged,
      benchmarkCohort: existing?.benchmarkCohort,
      version: existing?.version ?? 0,
    });
    return merged;
  }

  await supabase
    .from("merchant_dna_profiles")
    .upsert(
      {
        store_id: storeId,
        manual_overrides: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_id" },
    );

  return merged;
}
