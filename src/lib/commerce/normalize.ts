import type { StoreSnapshot, ShopifyCollection, ShopifyProduct } from "@/lib/connectors/types";
import type { CommercePlatformId, NormalizedCommerceSnapshot } from "./types";
import { mergeCommercePartial } from "./provider";
import { getCommercePlatform } from "./registry";
import { isDemoStoreSnapshot } from "@/lib/demo/is-demo-store";
import { allowDemoData } from "@/lib/env/runtime";
import {
  peakOutfittersCommerceCustomers,
  peakOutfittersCommerceOrders,
} from "@/lib/demo/peak-outfitters/orders";

/** @deprecated Use CommerceProduct — alias for migration */
export type { CommerceProduct, CommerceCollection } from "./types";

export function mapLegacyProduct(
  p: ShopifyProduct,
  platform: CommercePlatformId = "shopify",
): import("./types").CommerceProduct {
  return {
    id: p.id,
    externalId: p.id,
    platform,
    title: p.title,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    inventoryQuantity: p.inventoryQuantity,
    unitsSold30d: p.unitsSold30d,
    revenue30d: p.revenue30d,
    unitCost: p.unitCost,
    collectionIds: p.collectionIds,
    tags: p.tags,
    imageUrl: p.imageUrl,
    cartAdds30d: p.cartAdds30d,
  };
}

export function mapLegacyCollection(
  c: ShopifyCollection,
  platform: CommercePlatformId = "shopify",
): import("./types").CommerceCollection {
  return {
    id: c.id,
    externalId: c.id,
    platform,
    title: c.title,
    productCount: c.productCount,
    homepageFeatured: c.homepageFeatured,
    revenue30d: c.revenue30d,
  };
}

/**
 * Normalize any StoreSnapshot into provider-neutral commerce data.
 * AI, insights, and copilot should prefer this over raw connector shapes.
 */
export function normalizeCommerceSnapshot(
  snapshot: StoreSnapshot,
  options?: { storeDomain?: string },
): NormalizedCommerceSnapshot {
  const platform: CommercePlatformId = snapshot.commerceProvider ?? "shopify";
  const def = getCommercePlatform(platform);
  const isLive = snapshot.source === "connected";

  const partial = {
    products: snapshot.products.map((p) => mapLegacyProduct(p, platform)),
    collections: snapshot.collections.map((c) => mapLegacyCollection(c, platform)),
    inventory: snapshot.products.map((p) => {
      const velocity = p.unitsSold30d / 30;
      return {
        productId: p.id,
        title: p.title,
        quantity: p.inventoryQuantity,
        velocityPerDay: velocity,
        daysUntilStockout: velocity > 0 ? Math.floor(p.inventoryQuantity / velocity) : null,
      };
    }),
    metrics: snapshot.storeMetrics,
    syncedAt: snapshot.syncedAt,
    storeDomain: options?.storeDomain ?? snapshot.commerceStoreDomain,
    ...(allowDemoData() && isDemoStoreSnapshot(snapshot)
      ? {
          orders: peakOutfittersCommerceOrders(),
          customers: peakOutfittersCommerceCustomers(snapshot.customerSnapshot),
        }
      : {}),
  };

  return mergeCommercePartial(platform, def?.label ?? "Commerce", partial, isLive);
}

export async function loadNormalizedCommerce(storeId: string): Promise<NormalizedCommerceSnapshot> {
  const { resolveActiveCommerceProvider } = await import("./providers/registry");
  const provider = await resolveActiveCommerceProvider(storeId);
  if (!provider) {
    return mergeCommercePartial("shopify", "Shopify", {}, false);
  }
  const status = await provider.getStatus(storeId);
  const partial = await provider.sync(storeId);
  return mergeCommercePartial(
    provider.platform,
    provider.label,
    partial,
    status.status === "connected",
  );
}
