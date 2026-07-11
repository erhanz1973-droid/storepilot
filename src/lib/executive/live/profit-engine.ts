import { getSupabaseAdmin } from "@/lib/supabase/client";

export type ProfitEngineResult =
  | {
      available: true;
      netProfit30d: number;
      netProfitPrev30d: number;
      cogs30d: number;
      cogsPrev30d: number;
      marginPct30d: number;
      variantsWithCost: number;
      variantsTotal: number;
      sourceNote: string;
    }
  | {
      available: false;
      reason: string;
    };

const PAID_STATUSES = new Set([
  "PAID",
  "PARTIALLY_PAID",
  "PARTIALLY_REFUNDED",
]);

type OrderLineItem = {
  productId?: string | null;
  quantity?: number;
  discountedTotal?: number;
};

function isPaidOrder(financialStatus: string | null | undefined): boolean {
  if (!financialStatus) return true;
  return PAID_STATUSES.has(financialStatus.toUpperCase());
}

/** Profit engine — reads shopify_orders + shopify_product_variants in Supabase only. */
export async function computeProfitFromSupabase(input: {
  shopId: string;
  d30Iso: string;
  d60Iso: string;
}): Promise<ProfitEngineResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { available: false, reason: "Supabase is not configured" };
  }

  const [ordersRes, variantsRes] = await Promise.all([
    supabase
      .from("shopify_orders")
      .select("total_price, total_refunded, financial_status, shopify_created_at, line_items")
      .eq("shop_id", input.shopId)
      .gte("shopify_created_at", input.d60Iso),
    supabase
      .from("shopify_product_variants")
      .select("product_shopify_gid, shopify_gid, unit_cost")
      .eq("shop_id", input.shopId),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (variantsRes.error) throw new Error(variantsRes.error.message);

  const costByProductGid = new Map<string, number>();
  let variantsWithCost = 0;
  for (const row of variantsRes.data ?? []) {
    const cost = row.unit_cost != null ? Number(row.unit_cost) : null;
    if (cost != null && cost > 0) {
      variantsWithCost += 1;
      const productGid = row.product_shopify_gid as string;
      if (!costByProductGid.has(productGid)) {
        costByProductGid.set(productGid, cost);
      }
    }
  }

  if (variantsWithCost === 0) {
    return {
      available: false,
      reason: "Awaiting product cost configuration",
    };
  }

  let revenue30d = 0;
  let revenuePrev30d = 0;
  let cogs30d = 0;
  let cogsPrev30d = 0;
  let soldLineItemsWithCost = 0;
  let soldLineItemsTotal = 0;

  for (const order of ordersRes.data ?? []) {
    if (!isPaidOrder(order.financial_status as string | null)) continue;

    const createdAt = order.shopify_created_at as string;
    const inLast30 = createdAt >= input.d30Iso;
    const netRevenue =
      Number(order.total_price ?? 0) - Number(order.total_refunded ?? 0);
    if (inLast30) revenue30d += netRevenue;
    else revenuePrev30d += netRevenue;

    const lineItems = (order.line_items as OrderLineItem[]) ?? [];
    for (const item of lineItems) {
      soldLineItemsTotal += 1;
      const productGid = item.productId;
      const qty = Number(item.quantity ?? 0);
      if (!productGid || qty <= 0) continue;

      const unitCost = costByProductGid.get(productGid);
      if (unitCost == null) continue;

      soldLineItemsWithCost += 1;
      const lineCogs = unitCost * qty;
      if (inLast30) cogs30d += lineCogs;
      else cogsPrev30d += lineCogs;
    }
  }

  if (soldLineItemsTotal > 0 && soldLineItemsWithCost === 0) {
    return {
      available: false,
      reason: "Sold products are missing unit cost on variants",
    };
  }

  const netProfit30d = revenue30d - cogs30d;
  const netProfitPrev30d = revenuePrev30d - cogsPrev30d;
  const marginPct30d = revenue30d > 0 ? (netProfit30d / revenue30d) * 100 : 0;

  return {
    available: true,
    netProfit30d,
    netProfitPrev30d,
    cogs30d,
    cogsPrev30d,
    marginPct30d,
    variantsWithCost,
    variantsTotal: (variantsRes.data ?? []).length,
    sourceNote: "StorePilot Profit Engine — shopify_orders + variant unit_cost",
  };
}
