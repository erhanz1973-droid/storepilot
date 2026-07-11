import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { DemoShopContext } from "./context";

export type DemoMetricsSnapshot = {
  customers: number;
  orders: number;
  demoCustomers: number;
  demoOrders: number;
  products: number;
  variantsWithCost: number;
  revenue30d: number;
  orders30d: number;
  lowStockProducts: number;
  refreshedAt: string;
};

const PAID_STATUSES = new Set(["PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED"]);

export async function refreshDashboardMetrics(
  ctx: DemoShopContext,
): Promise<DemoMetricsSnapshot> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const nowIso = new Date().toISOString();
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    customersRes,
    ordersRes,
    demoCustomersRes,
    demoOrdersRes,
    productsRes,
    variantsRes,
    paidOrdersRes,
    lowStockRes,
  ] = await Promise.all([
    supabase.from("shopify_customers").select("id", { count: "exact", head: true }).eq("shop_id", ctx.shopId),
    supabase.from("shopify_orders").select("id", { count: "exact", head: true }).eq("shop_id", ctx.shopId),
    supabase
      .from("shopify_customers")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", ctx.shopId)
      .like("shopify_gid", "gid://storepilot-demo/Customer/%"),
    supabase
      .from("shopify_orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", ctx.shopId)
      .like("shopify_gid", "gid://storepilot-demo/Order/%"),
    supabase.from("shopify_products").select("id", { count: "exact", head: true }).eq("shop_id", ctx.shopId),
    supabase
      .from("shopify_product_variants")
      .select("unit_cost")
      .eq("shop_id", ctx.shopId)
      .not("unit_cost", "is", null)
      .gt("unit_cost", 0),
    supabase
      .from("shopify_orders")
      .select("total_price, total_refunded, financial_status, shopify_created_at")
      .eq("shop_id", ctx.shopId)
      .gte("shopify_created_at", d30),
    supabase
      .from("shopify_products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", ctx.shopId)
      .lte("total_inventory", 5),
  ]);

  for (const res of [
    customersRes,
    ordersRes,
    demoCustomersRes,
    demoOrdersRes,
    productsRes,
    variantsRes,
    paidOrdersRes,
    lowStockRes,
  ]) {
    if (res.error) throw new Error(res.error.message);
  }

  let revenue30d = 0;
  let orders30d = 0;
  for (const order of paidOrdersRes.data ?? []) {
    const status = (order.financial_status as string | null)?.toUpperCase() ?? "PAID";
    if (!PAID_STATUSES.has(status)) continue;
    if ((order.shopify_created_at as string) < d30) continue;
    revenue30d += Number(order.total_price ?? 0) - Number(order.total_refunded ?? 0);
    orders30d += 1;
  }

  await supabase
    .from("shops")
    .update({
      last_incremental_sync_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", ctx.shopId);

  return {
    customers: customersRes.count ?? 0,
    orders: ordersRes.count ?? 0,
    demoCustomers: demoCustomersRes.count ?? 0,
    demoOrders: demoOrdersRes.count ?? 0,
    products: productsRes.count ?? 0,
    variantsWithCost: variantsRes.data?.length ?? 0,
    revenue30d: Math.round(revenue30d * 100) / 100,
    orders30d,
    lowStockProducts: lowStockRes.count ?? 0,
    refreshedAt: nowIso,
  };
}
