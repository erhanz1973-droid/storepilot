import type {
  ProductOrderStats,
  ProfitOrderRollups,
  SalesTrends,
  ShopifyProduct,
  StoreSnapshot,
} from "@/lib/connectors/types";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { LinkedShopContext } from "./resolve-linked-shop";
import { loadShopMetrics, type ShopMetrics } from "./shop-metrics";
import {
  applyAdvertisingLayer,
  loadHybridAdvertisingLayer,
  type HybridDataSources,
} from "@/lib/executive/hybrid";

type ProductRow = {
  shopify_gid: string;
  title: string;
  total_inventory: number;
  tags: string[];
  featured_image_url: string | null;
};

type VariantRow = {
  product_shopify_gid: string;
  price: number | null;
  compare_at_price: number | null;
  unit_cost: number | null;
  inventory_quantity: number;
  inventory_tracked: boolean;
};

function buildProfitRollups(metrics: ShopMetrics): ProfitOrderRollups | undefined {
  if (!metrics.profitAvailable) return undefined;

  const revenue30d = metrics.revenue30d;
  const orders30d = metrics.orders30d;
  const cogs30d = metrics.netProfit30d != null ? metrics.revenue30d - metrics.netProfit30d : 0;
  const dailyRev = revenue30d / 30;
  const dailyCogs = cogs30d / 30;
  const dailyOrders = orders30d / 30;

  const bucket = (mult: number) => ({
    revenue: Math.round(dailyRev * mult * 100) / 100,
    cogs: Math.round(dailyCogs * mult * 100) / 100,
    shipping: 0,
    refunds: 0,
    orders: Math.round(dailyOrders * mult),
  });

  return {
    today: bucket(1),
    yesterday: bucket(1),
    last7d: bucket(7),
    last30d: {
      revenue: revenue30d,
      cogs: Math.round(cogs30d),
      shipping: 0,
      refunds: 0,
      orders: orders30d,
    },
  };
}

function buildSalesTrends(metrics: ShopMetrics): SalesTrends {
  const aov30d = metrics.averageOrderValue30d;
  return {
    thisWeek: {
      revenue: Math.round(metrics.revenue30d * 0.26),
      orders: Math.round(metrics.orders30d * 0.26),
      aov: aov30d,
    },
    lastWeek: {
      revenue: Math.round(metrics.revenue30d * 0.24),
      orders: Math.round(metrics.orders30d * 0.24),
      aov: aov30d,
    },
    last30Days: {
      revenue: metrics.revenue30d,
      orders: metrics.orders30d,
      aov: aov30d,
    },
    previous30Days: {
      revenue: metrics.revenuePrev30d,
      orders: metrics.ordersPrev30d,
      aov: metrics.averageOrderValuePrev30d,
    },
  };
}

async function loadCatalogProducts(
  shopId: string,
  metrics: ShopMetrics,
): Promise<{
  products: ShopifyProduct[];
  productOrderStats: Record<string, ProductOrderStats>;
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { products: [], productOrderStats: {} };

  const [productsRes, variantsRes] = await Promise.all([
    supabase
      .from("shopify_products")
      .select("shopify_gid, title, total_inventory, tags, featured_image_url")
      .eq("shop_id", shopId),
    supabase
      .from("shopify_product_variants")
      .select(
        "product_shopify_gid, price, compare_at_price, unit_cost, inventory_quantity, inventory_tracked",
      )
      .eq("shop_id", shopId),
  ]);

  if (productsRes.error) throw new Error(productsRes.error.message);
  if (variantsRes.error) throw new Error(variantsRes.error.message);

  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const variant of (variantsRes.data ?? []) as VariantRow[]) {
    const list = variantsByProduct.get(variant.product_shopify_gid) ?? [];
    list.push(variant);
    variantsByProduct.set(variant.product_shopify_gid, list);
  }

  const products: ShopifyProduct[] = [];
  const productOrderStats: Record<string, ProductOrderStats> = {};

  for (const row of (productsRes.data ?? []) as ProductRow[]) {
    const gid = row.shopify_gid;
    const variants = variantsByProduct.get(gid) ?? [];
    const primary = variants[0];
    const sales = metrics.productSalesByGid.get(gid);

    const unitsSold30d = sales?.units30d ?? 0;
    const revenue30d = sales?.revenue30d ?? 0;
    const unitsPrev30d = sales?.unitsPrev30d ?? 0;
    const revenuePrev30d = sales?.revenuePrev30d ?? 0;

    products.push({
      id: gid,
      title: row.title,
      inventoryQuantity: Number(row.total_inventory ?? 0),
      unitsSold30d,
      revenue30d,
      price: Number(primary?.price ?? 0),
      compareAtPrice:
        primary?.compare_at_price != null ? Number(primary.compare_at_price) : undefined,
      unitCost: primary?.unit_cost != null ? Number(primary.unit_cost) : undefined,
      collectionIds: [],
      tags: row.tags ?? [],
      imageUrl: row.featured_image_url ?? undefined,
      inventoryTracked: primary?.inventory_tracked ?? true,
    });

    if (sales) {
      productOrderStats[gid] = {
        last30d: {
          units: unitsSold30d,
          revenue: revenue30d,
          discounts: 0,
          refunds: 0,
        },
        previous30d: {
          units: unitsPrev30d,
          revenue: revenuePrev30d,
          discounts: 0,
          refunds: 0,
        },
        last7d: {
          units: Math.round(unitsSold30d * 0.26),
          revenue: Math.round(revenue30d * 0.26),
          discounts: 0,
          refunds: 0,
        },
      };
    }
  }

  return { products, productOrderStats };
}

export async function buildLiveStoreSnapshot(
  linked: LinkedShopContext,
): Promise<{ snapshot: StoreSnapshot; metrics: ShopMetrics; dataSources: HybridDataSources }> {
  const metrics = await loadShopMetrics(linked.shopDomain);
  if (!metrics) {
    throw new Error(`No shop metrics for ${linked.shopDomain}`);
  }

  const { products, productOrderStats } = await loadCatalogProducts(
    linked.shopId,
    metrics,
  );

  const syncedAt = metrics.syncedAt ?? new Date().toISOString();

  const shopifySnapshot: StoreSnapshot = {
    source: "connected",
    syncedAt,
    commerceProvider: "shopify",
    commerceStoreDomain: linked.shopDomain,
    products,
    collections: [],
    campaigns: [],
    storeMetrics: {
      revenue30d: metrics.revenue30d,
      orders30d: metrics.orders30d,
      aov30d: metrics.averageOrderValue30d,
      conversionRate30d: 0,
    },
    salesTrends: buildSalesTrends(metrics),
    profitRollups: buildProfitRollups(metrics),
    productOrderStats,
    shopifyCustomersCount: metrics.customerCount,
    connectorStates: {
      shopify: "connected",
      meta_ads: "disconnected",
      google_ads: "disconnected",
    },
  };

  const adLayer = await loadHybridAdvertisingLayer(linked.storeId, shopifySnapshot);
  const snapshot = applyAdvertisingLayer(shopifySnapshot, adLayer);

  return { snapshot, metrics, dataSources: adLayer.sources };
}
