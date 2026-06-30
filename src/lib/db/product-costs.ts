import { getSupabaseAdmin } from "@/lib/supabase/client";
import { DEMO_STORE_ID } from "@/lib/types";

export type ProductCostRecord = {
  shopifyProductId: string;
  unitCost: number;
  source: "manual" | "shopify" | "csv_import";
  updatedAt: string;
};

const memoryCosts = new Map<string, Map<string, ProductCostRecord>>();

function storeKey(storeId: string): string {
  return storeId;
}

export async function listProductCosts(storeId = DEMO_STORE_ID): Promise<ProductCostRecord[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const map = memoryCosts.get(storeKey(storeId));
    return map ? [...map.values()] : [];
  }

  const { data, error } = await supabase
    .from("product_costs")
    .select("shopify_product_id, unit_cost, source, updated_at")
    .eq("store_id", storeId);

  if (error || !data) return [];

  return data.map((row) => ({
    shopifyProductId: row.shopify_product_id as string,
    unitCost: Number(row.unit_cost),
    source: row.source as ProductCostRecord["source"],
    updatedAt: row.updated_at as string,
  }));
}

export async function upsertProductCost(
  storeId: string,
  shopifyProductId: string,
  unitCost: number,
  source: ProductCostRecord["source"] = "manual",
): Promise<ProductCostRecord> {
  const record: ProductCostRecord = {
    shopifyProductId,
    unitCost,
    source,
    updatedAt: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const key = storeKey(storeId);
    if (!memoryCosts.has(key)) memoryCosts.set(key, new Map());
    memoryCosts.get(key)!.set(shopifyProductId, record);
    return record;
  }

  const { error } = await supabase.from("product_costs").upsert(
    {
      store_id: storeId,
      shopify_product_id: shopifyProductId,
      unit_cost: unitCost,
      source,
      updated_at: record.updatedAt,
    },
    { onConflict: "store_id,shopify_product_id" },
  );

  if (error) throw new Error(error.message);
  return record;
}

export async function bulkUpsertProductCosts(
  storeId: string,
  costs: { shopifyProductId: string; unitCost: number }[],
  source: ProductCostRecord["source"] = "csv_import",
): Promise<number> {
  let count = 0;
  for (const c of costs) {
    await upsertProductCost(storeId, c.shopifyProductId, c.unitCost, source);
    count += 1;
  }
  return count;
}

export function productCostMap(
  records: ProductCostRecord[],
): Map<string, ProductCostRecord> {
  return new Map(records.map((r) => [r.shopifyProductId, r]));
}
