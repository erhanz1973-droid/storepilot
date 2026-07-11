import { getSupabaseAdmin } from "@/lib/supabase/client";
import { DEMO_ORDER_COUNT, DEMO_ORDER_WINDOW_DAYS } from "./constants";
import type { DemoShopContext } from "./context";
import { listDemoCustomers } from "./customers";
import { demoGid, randomDateWithinDays, randomFloat, randomInt, randomItem } from "./random";

type CatalogVariant = {
  shopify_gid: string;
  product_shopify_gid: string;
  title: string | null;
  price: number | null;
  unit_cost: number | null;
};

type CatalogProduct = {
  shopify_gid: string;
  title: string;
};

async function loadCatalog(ctx: DemoShopContext): Promise<{
  products: CatalogProduct[];
  variants: CatalogVariant[];
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const [productsRes, variantsRes] = await Promise.all([
    supabase
      .from("shopify_products")
      .select("shopify_gid, title")
      .eq("shop_id", ctx.shopId),
    supabase
      .from("shopify_product_variants")
      .select("shopify_gid, product_shopify_gid, title, price, unit_cost")
      .eq("shop_id", ctx.shopId),
  ]);

  if (productsRes.error) throw new Error(productsRes.error.message);
  if (variantsRes.error) throw new Error(variantsRes.error.message);

  const variants = (variantsRes.data ?? []) as CatalogVariant[];
  if (variants.length === 0) {
    throw new Error(
      "No products in shopify_product_variants. Sync Shopify catalog before generating orders.",
    );
  }

  return {
    products: (productsRes.data ?? []) as CatalogProduct[],
    variants,
  };
}

export async function generateDemoOrders(
  ctx: DemoShopContext,
): Promise<{ inserted: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const [{ variants, products }, customers] = await Promise.all([
    loadCatalog(ctx),
    listDemoCustomers(ctx),
  ]);

  if (customers.length === 0) {
    throw new Error("Generate customers first.");
  }

  const productTitleByGid = new Map(products.map((p) => [p.shopify_gid, p.title]));
  const now = new Date().toISOString();

  const rows = Array.from({ length: DEMO_ORDER_COUNT }, (_, index) => {
    const customer = randomItem(customers);
    const lineCount = randomInt(1, 3);
    const lineItems: Array<{
      title: string;
      quantity: number;
      sku: string | null;
      productId: string;
      productTitle: string;
      variantId: string;
      originalTotal: number;
      discountedTotal: number;
      unitCost: number | null;
    }> = [];

    let subtotal = 0;
    for (let line = 0; line < lineCount; line += 1) {
      const variant = randomItem(variants);
      const quantity = randomInt(1, 3);
      const unitPrice = Number(variant.price ?? randomFloat(15, 120));
      const discountPct = randomInt(0, 100) < 35 ? randomFloat(0.05, 0.2) : 0;
      const originalTotal = Math.round(unitPrice * quantity * 100) / 100;
      const discountedTotal = Math.round(originalTotal * (1 - discountPct) * 100) / 100;
      subtotal += discountedTotal;

      lineItems.push({
        title: variant.title ?? "Variant",
        quantity,
        sku: null,
        productId: variant.product_shopify_gid,
        productTitle: productTitleByGid.get(variant.product_shopify_gid) ?? "Product",
        variantId: variant.shopify_gid,
        originalTotal,
        discountedTotal,
        unitCost: variant.unit_cost != null ? Number(variant.unit_cost) : null,
      });
    }

    const shipping = randomFloat(0, 18);
    const totalPrice = Math.round((subtotal + shipping) * 100) / 100;
    const createdAt = randomDateWithinDays(DEMO_ORDER_WINDOW_DAYS).toISOString();

    return {
      shop_id: ctx.shopId,
      shopify_gid: demoGid("Order", index),
      order_number: `#D${1000 + index}`,
      customer_shopify_gid: customer.shopify_gid,
      email: customer.email,
      financial_status: "PAID",
      fulfillment_status: randomItem(["FULFILLED", "UNFULFILLED", "PARTIALLY_FULFILLED"]),
      currency_code: ctx.currencyCode,
      subtotal_price: Math.round(subtotal * 100) / 100,
      total_price: totalPrice,
      total_shipping: shipping,
      total_refunded: 0,
      line_items: lineItems,
      shopify_created_at: createdAt,
      shopify_updated_at: createdAt,
      synced_at: now,
    };
  });

  const { error } = await supabase
    .from("shopify_orders")
    .upsert(rows, { onConflict: "shop_id,shopify_gid" });

  if (error) throw new Error(error.message);

  await refreshDemoCustomerStats(ctx);

  return { inserted: rows.length };
}

export async function refreshDemoCustomerStats(ctx: DemoShopContext): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const orders = await listDemoOrders(ctx);
  const totals = new Map<string, { count: number; spent: number }>();

  for (const order of orders) {
    if (!order.customer_shopify_gid) continue;
    const status = (order.financial_status as string | null)?.toUpperCase() ?? "PAID";
    if (!["PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(status)) {
      continue;
    }

    const net = Number(order.total_price ?? 0) - Number(order.total_refunded ?? 0);
    const existing = totals.get(order.customer_shopify_gid) ?? { count: 0, spent: 0 };
    existing.count += 1;
    existing.spent += net;
    totals.set(order.customer_shopify_gid, existing);
  }

  const now = new Date().toISOString();
  await Promise.all(
    [...totals.entries()].map(async ([customerGid, stats]) => {
      const { error } = await supabase
        .from("shopify_customers")
        .update({
          orders_count: stats.count,
          total_spent: Math.round(stats.spent * 100) / 100,
          shopify_updated_at: now,
        })
        .eq("shop_id", ctx.shopId)
        .eq("shopify_gid", customerGid);
      if (error) throw new Error(error.message);
    }),
  );
}

export async function listDemoOrders(ctx: DemoShopContext): Promise<
  Array<{
    shopify_gid: string;
    customer_shopify_gid: string | null;
    total_price: number;
    total_refunded: number;
    financial_status: string | null;
    line_items: unknown;
  }>
> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("shopify_orders")
    .select(
      "shopify_gid, customer_shopify_gid, total_price, total_refunded, financial_status, line_items",
    )
    .eq("shop_id", ctx.shopId)
    .like("shopify_gid", "gid://storepilot-demo/Order/%");

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    shopify_gid: string;
    customer_shopify_gid: string | null;
    total_price: number;
    total_refunded: number;
    financial_status: string | null;
    line_items: unknown;
  }>;
}
