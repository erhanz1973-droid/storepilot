import type { CommerceProviderAdapter, CommerceSyncPartial } from "../provider";
import type { CommercePlatformId } from "../types";
import type { ShopifyCollection, ShopifyProduct, StoreSnapshot } from "@/lib/connectors/types";
import { getInstallationByStoreId, getInstallationForStore } from "@/lib/db/shopify";
import { isShopifyOAuthConfigured } from "@/lib/shopify/oauth";
import { syncShopifyStore } from "@/lib/shopify/sync";
import { updateShopifySyncResult } from "@/lib/db/shopify";
import { DEMO_STORE_ID } from "@/lib/types";
import { getPeakOutfittersSnapshot } from "@/lib/connectors/demo-data";
import { PEAK_OUTFITTERS } from "@/lib/demo/peak-outfitters/constants";
import {
  peakOutfittersCommerceCustomers,
  peakOutfittersCommerceOrders,
} from "@/lib/demo/peak-outfitters/orders";
import { TokenDecryptionError, logTokenDecryptionFailure } from "@/lib/crypto/decrypt-errors";

const PLATFORM: CommercePlatformId = "shopify";

function mapProduct(p: ShopifyProduct): import("../types").CommerceProduct {
  return {
    id: p.id,
    externalId: p.id,
    platform: PLATFORM,
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

function mapCollection(c: ShopifyCollection): import("../types").CommerceCollection {
  return {
    id: c.id,
    externalId: c.id,
    platform: PLATFORM,
    title: c.title,
    productCount: c.productCount,
    homepageFeatured: c.homepageFeatured,
    revenue30d: c.revenue30d,
  };
}

function mapSnapshotToPartial(
  snapshot: Partial<
    Pick<
      StoreSnapshot,
      "products" | "collections" | "storeMetrics" | "syncedAt" | "customerSnapshot"
    >
  >,
  storeDomain?: string,
  options?: { includeDemoRecords?: boolean },
): CommerceSyncPartial {
  return {
    products: (snapshot.products ?? []).map(mapProduct),
    collections: (snapshot.collections ?? []).map(mapCollection),
    inventory: (snapshot.products ?? []).map((p) => {
      const velocity = p.unitsSold30d / 30;
      return {
        productId: p.id,
        title: p.title,
        quantity: p.inventoryQuantity,
        velocityPerDay: velocity,
        daysUntilStockout: velocity > 0 ? Math.floor(p.inventoryQuantity / velocity) : null,
      };
    }),
    ...(options?.includeDemoRecords
      ? {
          orders: peakOutfittersCommerceOrders(),
          customers: peakOutfittersCommerceCustomers(snapshot.customerSnapshot),
        }
      : {}),
    metrics: snapshot.storeMetrics ?? {
      revenue30d: 0,
      orders30d: 0,
      aov30d: 0,
      conversionRate30d: 0,
    },
    syncedAt: snapshot.syncedAt ?? new Date().toISOString(),
    storeDomain,
  };
}

export const shopifyCommerceProvider: CommerceProviderAdapter = {
  platform: PLATFORM,
  label: "Shopify",
  connectorId: "shopify",

  isConfigured() {
    return isShopifyOAuthConfigured();
  },

  async getStatus(storeId: string) {
    if (storeId === DEMO_STORE_ID) {
      return { status: "demo" as const, storeDomain: "demo.storepilot.ai" };
    }
    const installation = await getInstallationForStore(storeId);
    if (!installation) {
      return { status: "disconnected" as const };
    }
    if (installation.connection_health === "error") {
      return {
        status: "error" as const,
        lastSyncAt: installation.last_sync_at ?? undefined,
        errorMessage: installation.error_message ?? "Connection error",
        storeDomain: installation.shop_domain,
      };
    }

    try {
      await getInstallationByStoreId(storeId);
    } catch (error) {
      if (error instanceof TokenDecryptionError) {
        logTokenDecryptionFailure("shopify", error, "commerce.getStatus");
        return {
          status: "error" as const,
          lastSyncAt: installation.last_sync_at ?? undefined,
          errorMessage: "Token decryption failed: invalid encryption key",
          storeDomain: installation.shop_domain,
        };
      }
      throw error;
    }

    return {
      status: "connected" as const,
      lastSyncAt: installation.last_sync_at ?? undefined,
      storeDomain: installation.shop_domain,
    };
  },

  async sync(storeId: string): Promise<CommerceSyncPartial> {
    const demoSnapshot = getPeakOutfittersSnapshot();
    if (storeId === DEMO_STORE_ID) {
      return mapSnapshotToPartial(demoSnapshot, PEAK_OUTFITTERS.shopDomain, {
        includeDemoRecords: true,
      });
    }

    let installation;
    try {
      installation = await getInstallationByStoreId(storeId);
    } catch (error) {
      if (error instanceof TokenDecryptionError) {
        logTokenDecryptionFailure("shopify", error, "commerce.sync");
        return mapSnapshotToPartial(demoSnapshot, PEAK_OUTFITTERS.shopDomain, {
          includeDemoRecords: true,
        });
      }
      throw error;
    }
    if (!installation) {
      return mapSnapshotToPartial(demoSnapshot, PEAK_OUTFITTERS.shopDomain, {
        includeDemoRecords: true,
      });
    }

    const result = await syncShopifyStore(installation.shop_domain, installation.accessToken, {
      storedClientId: installation.clientId,
      installationId: installation.id,
      refreshToken: installation.refreshToken,
    });
    await updateShopifySyncResult(installation.store_id, result.stats, result.snapshot, {
      shopName: result.shopName,
      shopifyPlan: result.shopifyPlan,
    });

    return mapSnapshotToPartial(result.snapshot, installation.shop_domain);
  },
};
