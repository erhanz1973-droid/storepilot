import { getSupabaseAdmin } from "@/lib/supabase/client";
import { computeProfitFromSupabase } from "./profit-engine";

export type ShopMetrics = {
  shopId: string;
  shopName: string;
  currencyCode: string;
  syncedAt: string | null;
  revenue30d: number;
  revenuePrev30d: number;
  orders30d: number;
  ordersPrev30d: number;
  averageOrderValue30d: number;
  averageOrderValuePrev30d: number;
  profitAvailable: boolean;
  netProfit30d: number;
  netProfitPrev30d: number;
  profitMarginPct30d: number;
  profitUnavailableReason: string | null;
  profitSourceNote: string | null;
  productCount: number;
  customerCount: number;
  inventoryUnits: number;
  lowStockProducts: Array<{ title: string; inventory: number; productGid?: string }>;
  topProducts: Array<{
    title: string;
    productGid?: string;
    revenue: number;
    units: number;
  }>;
  lapsedCustomers: number;
  productSalesByGid: Map<
    string,
    { title: string; revenue30d: number; units30d: number; revenuePrev30d: number; unitsPrev30d: number }
  >;
};

const PAID_STATUSES = new Set([
  "PAID",
  "PARTIALLY_PAID",
  "PARTIALLY_REFUNDED",
]);

function isPaidOrder(financialStatus: string | null | undefined): boolean {
  if (!financialStatus) return true;
  return PAID_STATUSES.has(financialStatus.toUpperCase());
}

export function metricChangePct(current: number, previous: number): number | undefined {
  if (previous === 0) return current > 0 ? 100 : undefined;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Live shop metrics — same queries as embedded Executive Dashboard. */
export async function loadShopMetrics(shopDomain: string): Promise<ShopMetrics | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("*")
    .eq("shop_domain", shopDomain)
    .maybeSingle();

  if (shopError) throw new Error(shopError.message);
  if (!shop) return null;

  const shopId = shop.id as string;
  const now = Date.now();
  const d30 = new Date(now - 30 * 86400000).toISOString();
  const d60 = new Date(now - 60 * 86400000).toISOString();

  const [
    ordersRes,
    productsRes,
    customersRes,
    inventoryRes,
    lapsedRes,
    profitResult,
  ] = await Promise.all([
    supabase
      .from("shopify_orders")
      .select(
        "total_price, total_refunded, financial_status, shopify_created_at, line_items",
      )
      .eq("shop_id", shopId)
      .gte("shopify_created_at", d60),
    supabase
      .from("shopify_products")
      .select("shopify_gid, title, total_inventory")
      .eq("shop_id", shopId),
    supabase.from("shopify_customers").select("id").eq("shop_id", shopId),
    supabase
      .from("shopify_product_variants")
      .select("inventory_quantity")
      .eq("shop_id", shopId),
    supabase
      .from("shopify_customers")
      .select("id")
      .eq("shop_id", shopId)
      .eq("orders_count", 0),
    computeProfitFromSupabase({ shopId, d30Iso: d30, d60Iso: d60 }),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (customersRes.error) throw new Error(customersRes.error.message);
  if (inventoryRes.error) throw new Error(inventoryRes.error.message);
  if (lapsedRes.error) throw new Error(lapsedRes.error.message);

  const orders = ordersRes.data ?? [];
  let revenue30d = 0;
  let revenuePrev30d = 0;
  let orders30d = 0;
  let ordersPrev30d = 0;
  const productSalesByGid = new Map<
    string,
    {
      title: string;
      revenue30d: number;
      units30d: number;
      revenuePrev30d: number;
      unitsPrev30d: number;
    }
  >();
  const productSalesByTitle = new Map<
    string,
    { title: string; revenue: number; units: number; productGid?: string }
  >();

  for (const order of orders) {
    if (!isPaidOrder(order.financial_status as string | null)) continue;

    const createdAt = order.shopify_created_at as string;
    const amount =
      Number(order.total_price ?? 0) - Number(order.total_refunded ?? 0);
    const inLast30 = createdAt >= d30;

    if (inLast30) {
      revenue30d += amount;
      orders30d += 1;
    } else {
      revenuePrev30d += amount;
      ordersPrev30d += 1;
    }

    const lineItems = (order.line_items as Array<{
      productId?: string | null;
      productTitle?: string | null;
      quantity?: number;
      discountedTotal?: number;
    }>) ?? [];

    for (const item of lineItems) {
      const title = item.productTitle ?? "Unknown product";
      const productGid = item.productId ?? undefined;
      const qty = Number(item.quantity ?? 0);
      const lineRevenue = Number(item.discountedTotal ?? 0);

      if (productGid) {
        const existing = productSalesByGid.get(productGid) ?? {
          title,
          revenue30d: 0,
          units30d: 0,
          revenuePrev30d: 0,
          unitsPrev30d: 0,
        };
        if (inLast30) {
          existing.revenue30d += lineRevenue;
          existing.units30d += qty;
        } else {
          existing.revenuePrev30d += lineRevenue;
          existing.unitsPrev30d += qty;
        }
        productSalesByGid.set(productGid, existing);
      }

      if (!inLast30) continue;

      const byTitle = productSalesByTitle.get(title) ?? {
        title,
        revenue: 0,
        units: 0,
        productGid,
      };
      byTitle.revenue += lineRevenue;
      byTitle.units += qty;
      if (productGid) byTitle.productGid = productGid;
      productSalesByTitle.set(title, byTitle);
    }
  }

  const averageOrderValue30d = orders30d > 0 ? revenue30d / orders30d : 0;
  const averageOrderValuePrev30d =
    ordersPrev30d > 0 ? revenuePrev30d / ordersPrev30d : 0;

  const products = productsRes.data ?? [];
  const titleToGid = new Map(
    products.map((p) => [p.title as string, p.shopify_gid as string]),
  );

  const lowStockProducts = products
    .filter((product) => Number(product.total_inventory ?? 0) <= 5)
    .slice(0, 5)
    .map((product) => ({
      title: product.title as string,
      inventory: Number(product.total_inventory ?? 0),
      productGid: product.shopify_gid as string,
    }));

  const topProducts = [...productSalesByTitle.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((row) => ({
      ...row,
      productGid: row.productGid ?? titleToGid.get(row.title),
    }));

  const inventoryUnits = (inventoryRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.inventory_quantity ?? 0),
    0,
  );

  const profitAvailable = profitResult.available;
  const netProfit30d = profitAvailable ? profitResult.netProfit30d : 0;
  const netProfitPrev30d = profitAvailable ? profitResult.netProfitPrev30d : 0;
  const profitMarginPct30d = profitAvailable ? profitResult.marginPct30d : 0;

  return {
    shopId,
    shopName: (shop.shop_name as string) ?? shopDomain,
    currencyCode: (shop.currency_code as string) ?? "USD",
    syncedAt:
      (shop.last_incremental_sync_at as string | null) ??
      (shop.last_full_sync_at as string | null) ??
      new Date().toISOString(),
    revenue30d,
    revenuePrev30d,
    orders30d,
    ordersPrev30d,
    averageOrderValue30d,
    averageOrderValuePrev30d,
    profitAvailable,
    netProfit30d,
    netProfitPrev30d,
    profitMarginPct30d,
    profitUnavailableReason: profitAvailable ? null : profitResult.reason,
    profitSourceNote: profitAvailable ? profitResult.sourceNote : null,
    productCount: products.length,
    customerCount: (customersRes.data ?? []).length,
    inventoryUnits,
    lowStockProducts,
    topProducts,
    lapsedCustomers: (lapsedRes.data ?? []).length,
    productSalesByGid,
  };
}

export function computeStoreHealthScore(metrics: ShopMetrics): number {
  let score = 50;

  if (metrics.revenue30d > 0) score += 10;
  if (metrics.orders30d >= 20) score += 10;
  if (metrics.productCount >= 10) score += 5;
  if (metrics.customerCount >= 50) score += 5;
  if (metrics.lowStockProducts.length === 0) score += 10;
  else score -= Math.min(15, metrics.lowStockProducts.length * 3);

  const revenueTrend = metricChangePct(metrics.revenue30d, metrics.revenuePrev30d);
  if (revenueTrend != null) {
    if (revenueTrend > 5) score += 10;
    else if (revenueTrend < -5) score -= 10;
  }

  if (metrics.profitAvailable) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}
