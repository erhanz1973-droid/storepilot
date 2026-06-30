import { getSupabaseAdmin } from "@/lib/supabase/client";
import type {
  BusinessModel,
  BusinessModelSource,
  InventoryStrategy,
  MerchantBusinessProfile,
  SalesChannel,
} from "@/lib/business-model/types";
import { normalizeBusinessModel } from "@/lib/business-model/types";

type MemoryProfile = MerchantBusinessProfile;

const memoryProfiles = new Map<string, MemoryProfile>();

function rowToProfile(row: Record<string, unknown>): MerchantBusinessProfile {
  return {
    storeId: row.store_id as string,
    businessModel: normalizeBusinessModel(row.business_model as string),
    businessModelSource: (row.business_model_source as BusinessModelSource) ?? "default",
    detectedBusinessModel: row.detected_business_model
      ? normalizeBusinessModel(row.detected_business_model as string)
      : undefined,
    detectionConfidence:
      row.detection_confidence != null ? Number(row.detection_confidence) : undefined,
    detectionSignals: (row.detection_signals as MerchantBusinessProfile["detectionSignals"]) ?? [],
    primarySalesChannel: (row.primary_sales_channel as SalesChannel) ?? "shopify",
    averageOrderValue:
      row.average_order_value != null ? Number(row.average_order_value) : undefined,
    typicalMarginPct:
      row.typical_margin_pct != null ? Number(row.typical_margin_pct) : undefined,
    inventoryStrategy: (row.inventory_strategy as InventoryStrategy) ?? "tracked",
    advertisingChannels: (row.advertising_channels as string[]) ?? [],
    primaryAcquisitionChannel: (row.primary_acquisition_channel as string) ?? undefined,
    hybridModelWeights:
      (row.hybrid_model_weights as MerchantBusinessProfile["hybridModelWeights"]) ?? undefined,
  };
}

export async function getStoreBusinessProfile(
  storeId: string,
): Promise<MerchantBusinessProfile | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return memoryProfiles.get(storeId) ?? null;

  const { data, error } = await supabase
    .from("store_business_profiles")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToProfile(data as Record<string, unknown>);
}

export async function upsertStoreBusinessProfile(
  storeId: string,
  patch: Partial<MerchantBusinessProfile> & { businessModelSource?: BusinessModelSource },
): Promise<MerchantBusinessProfile> {
  const existing = (await getStoreBusinessProfile(storeId)) ?? {
    storeId,
    businessModel: "own_inventory" as BusinessModel,
    businessModelSource: "default" as BusinessModelSource,
  };

  const merged: MerchantBusinessProfile = {
    ...existing,
    ...patch,
    storeId,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryProfiles.set(storeId, merged);
    return merged;
  }

  const payload = {
    store_id: storeId,
    business_model: merged.businessModel,
    business_model_source: merged.businessModelSource,
    detected_business_model: merged.detectedBusinessModel ?? null,
    detection_confidence: merged.detectionConfidence ?? null,
    detection_signals: merged.detectionSignals ?? [],
    primary_sales_channel: merged.primarySalesChannel ?? "shopify",
    average_order_value: merged.averageOrderValue ?? null,
    typical_margin_pct: merged.typicalMarginPct ?? null,
    inventory_strategy: merged.inventoryStrategy ?? "tracked",
    advertising_channels: merged.advertisingChannels ?? [],
    primary_acquisition_channel: merged.primaryAcquisitionChannel ?? null,
    hybrid_model_weights: merged.hybridModelWeights ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("store_business_profiles")
    .upsert(payload, { onConflict: "store_id" })
    .select("*")
    .single();

  if (error || !data) {
    memoryProfiles.set(storeId, merged);
    return merged;
  }

  return rowToProfile(data as Record<string, unknown>);
}
