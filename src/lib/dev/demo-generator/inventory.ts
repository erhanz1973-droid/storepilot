import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  DEMO_LOW_STOCK_COUNT,
  DEMO_OUT_OF_STOCK_COUNT,
} from "./constants";
import type { DemoShopContext } from "./context";
import { listDemoOrders } from "./orders";
import { randomInt } from "./random";

type InventorySnapshot = {
  variants: Record<string, number>;
  products: Record<string, number>;
};

type LineItem = {
  variantId?: string;
  productId?: string;
  quantity?: number;
};

async function readInventorySnapshot(
  ctx: DemoShopContext,
): Promise<InventorySnapshot | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("shops")
    .select("sync_state")
    .eq("id", ctx.shopId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const syncState = (data?.sync_state as Record<string, unknown> | null) ?? {};
  const snapshot = syncState.demoGeneratorInventory as InventorySnapshot | undefined;
  return snapshot ?? null;
}

async function saveInventorySnapshot(
  ctx: DemoShopContext,
  snapshot: InventorySnapshot,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("shops")
    .select("sync_state")
    .eq("id", ctx.shopId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const syncState = (data?.sync_state as Record<string, unknown> | null) ?? {};

  const { error: updateError } = await supabase
    .from("shops")
    .update({
      sync_state: {
        ...syncState,
        demoGeneratorInventory: snapshot,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.shopId);

  if (updateError) throw new Error(updateError.message);
}

async function ensureInventorySnapshot(ctx: DemoShopContext): Promise<InventorySnapshot> {
  const existing = await readInventorySnapshot(ctx);
  if (existing) return existing;

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const [variantsRes, productsRes] = await Promise.all([
    supabase
      .from("shopify_product_variants")
      .select("shopify_gid, inventory_quantity")
      .eq("shop_id", ctx.shopId),
    supabase
      .from("shopify_products")
      .select("shopify_gid, total_inventory")
      .eq("shop_id", ctx.shopId),
  ]);

  if (variantsRes.error) throw new Error(variantsRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);

  const snapshot: InventorySnapshot = {
    variants: Object.fromEntries(
      (variantsRes.data ?? []).map((row) => [
        row.shopify_gid as string,
        Number(row.inventory_quantity ?? 0),
      ]),
    ),
    products: Object.fromEntries(
      (productsRes.data ?? []).map((row) => [
        row.shopify_gid as string,
        Number(row.total_inventory ?? 0),
      ]),
    ),
  };

  await saveInventorySnapshot(ctx, snapshot);
  return snapshot;
}

async function recomputeProductTotals(ctx: DemoShopContext, productGids: string[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  for (const productGid of productGids) {
    const { data, error } = await supabase
      .from("shopify_product_variants")
      .select("inventory_quantity")
      .eq("shop_id", ctx.shopId)
      .eq("product_shopify_gid", productGid);

    if (error) throw new Error(error.message);
    const total = (data ?? []).reduce(
      (sum, row) => sum + Number(row.inventory_quantity ?? 0),
      0,
    );

    const { error: updateError } = await supabase
      .from("shopify_products")
      .update({
        total_inventory: total,
        synced_at: new Date().toISOString(),
      })
      .eq("shop_id", ctx.shopId)
      .eq("shopify_gid", productGid);

    if (updateError) throw new Error(updateError.message);
  }
}

export async function generateDemoInventoryChanges(
  ctx: DemoShopContext,
): Promise<{
  variantsAdjusted: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  await ensureInventorySnapshot(ctx);

  const orders = await listDemoOrders(ctx);
  if (orders.length === 0) {
    throw new Error("Generate orders first.");
  }

  const soldByVariant = new Map<string, { productId: string; quantity: number }>();
  for (const order of orders) {
    const items = (order.line_items as LineItem[]) ?? [];
    for (const item of items) {
      if (!item.variantId || !item.productId) continue;
      const existing = soldByVariant.get(item.variantId) ?? {
        productId: item.productId,
        quantity: 0,
      };
      existing.quantity += Number(item.quantity ?? 0);
      soldByVariant.set(item.variantId, existing);
    }
  }

  const touchedProducts = new Set<string>();
  let variantsAdjusted = 0;
  const now = new Date().toISOString();

  for (const [variantGid, sold] of soldByVariant.entries()) {
    const { data, error } = await supabase
      .from("shopify_product_variants")
      .select("inventory_quantity, product_shopify_gid")
      .eq("shop_id", ctx.shopId)
      .eq("shopify_gid", variantGid)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) continue;

    const current = Number(data.inventory_quantity ?? 0);
    const next = Math.max(0, current - sold.quantity);
    const { error: updateError } = await supabase
      .from("shopify_product_variants")
      .update({
        inventory_quantity: next,
        synced_at: now,
      })
      .eq("shop_id", ctx.shopId)
      .eq("shopify_gid", variantGid);

    if (updateError) throw new Error(updateError.message);
    touchedProducts.add(data.product_shopify_gid as string);
    variantsAdjusted += 1;
  }

  const { data: products, error: productsError } = await supabase
    .from("shopify_products")
    .select("shopify_gid, total_inventory")
    .eq("shop_id", ctx.shopId);

  if (productsError) throw new Error(productsError.message);

  const productRows = products ?? [];
  const lowStockTargets = [...productRows]
    .sort(() => Math.random() - 0.5)
    .slice(0, DEMO_LOW_STOCK_COUNT);
  const outOfStockTargets = [...productRows]
    .filter((row) => !lowStockTargets.some((low) => low.shopify_gid === row.shopify_gid))
    .sort(() => Math.random() - 0.5)
    .slice(0, DEMO_OUT_OF_STOCK_COUNT);

  for (const product of lowStockTargets) {
    const productGid = product.shopify_gid as string;
    const { data: variants, error } = await supabase
      .from("shopify_product_variants")
      .select("shopify_gid")
      .eq("shop_id", ctx.shopId)
      .eq("product_shopify_gid", productGid)
      .limit(1);

    if (error) throw new Error(error.message);
    const variantGid = variants?.[0]?.shopify_gid as string | undefined;
    if (!variantGid) continue;

    const lowQty = randomInt(1, 4);
    const { error: updateError } = await supabase
      .from("shopify_product_variants")
      .update({ inventory_quantity: lowQty, synced_at: now })
      .eq("shop_id", ctx.shopId)
      .eq("shopify_gid", variantGid);

    if (updateError) throw new Error(updateError.message);
    touchedProducts.add(productGid);
  }

  for (const product of outOfStockTargets) {
    const productGid = product.shopify_gid as string;
    const { error } = await supabase
      .from("shopify_product_variants")
      .update({ inventory_quantity: 0, synced_at: now })
      .eq("shop_id", ctx.shopId)
      .eq("product_shopify_gid", productGid);

    if (error) throw new Error(error.message);
    touchedProducts.add(productGid);
  }

  await recomputeProductTotals(ctx, [...touchedProducts]);

  return {
    variantsAdjusted,
    lowStockProducts: lowStockTargets.length,
    outOfStockProducts: outOfStockTargets.length,
  };
}

export async function restoreDemoInventory(ctx: DemoShopContext): Promise<void> {
  const snapshot = await readInventorySnapshot(ctx);
  if (!snapshot) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const now = new Date().toISOString();

  await Promise.all(
    Object.entries(snapshot.variants).map(async ([variantGid, quantity]) => {
      const { error } = await supabase
        .from("shopify_product_variants")
        .update({ inventory_quantity: quantity, synced_at: now })
        .eq("shop_id", ctx.shopId)
        .eq("shopify_gid", variantGid);
      if (error) throw new Error(error.message);
    }),
  );

  await Promise.all(
    Object.entries(snapshot.products).map(async ([productGid, quantity]) => {
      const { error } = await supabase
        .from("shopify_products")
        .update({ total_inventory: quantity, synced_at: now })
        .eq("shop_id", ctx.shopId)
        .eq("shopify_gid", productGid);
      if (error) throw new Error(error.message);
    }),
  );

  const { data, error } = await supabase
    .from("shops")
    .select("sync_state")
    .eq("id", ctx.shopId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const syncState = { ...((data?.sync_state as Record<string, unknown> | null) ?? {}) };
  delete syncState.demoGeneratorInventory;

  const { error: updateError } = await supabase
    .from("shops")
    .update({ sync_state: syncState, updated_at: now })
    .eq("id", ctx.shopId);

  if (updateError) throw new Error(updateError.message);
}
