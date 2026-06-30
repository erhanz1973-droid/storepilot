import type {
  CommerceCollection,
  CommerceCustomer,
  CommerceDiscount,
  CommerceInventoryItem,
  CommerceOrder,
  CommercePlatformId,
  CommerceProduct,
  CommerceStoreMetrics,
  NormalizedCommerceSnapshot,
} from "./types";
import type { ConnectorStatus } from "@/lib/types";

/** Raw partial from a platform sync — maps into NormalizedCommerceSnapshot. */
export type CommerceSyncPartial = {
  products?: CommerceProduct[];
  collections?: CommerceCollection[];
  customers?: CommerceCustomer[];
  orders?: CommerceOrder[];
  discounts?: CommerceDiscount[];
  inventory?: CommerceInventoryItem[];
  metrics?: CommerceStoreMetrics;
  storeDomain?: string;
  syncedAt?: string;
};

export type CommerceProviderAdapter = {
  platform: CommercePlatformId;
  label: string;
  /** Legacy connector id (e.g. shopify) for registry compatibility */
  connectorId: string;

  getStatus(storeId: string): Promise<{
    status: ConnectorStatus;
    lastSyncAt?: string;
    errorMessage?: string;
    storeDomain?: string;
  }>;

  sync(storeId: string): Promise<CommerceSyncPartial>;

  isConfigured(): boolean;
};

export function mergeCommercePartial(
  platform: CommercePlatformId,
  platformLabel: string,
  partial: CommerceSyncPartial,
  isLive: boolean,
): NormalizedCommerceSnapshot {
  const metrics = partial.metrics ?? {
    revenue30d: 0,
    orders30d: 0,
    aov30d: 0,
    conversionRate30d: 0,
  };

  return {
    platform,
    platformLabel,
    storeDomain: partial.storeDomain,
    syncedAt: partial.syncedAt ?? new Date().toISOString(),
    isLive,
    products: partial.products ?? [],
    collections: partial.collections ?? [],
    customers: partial.customers ?? [],
    orders: partial.orders ?? [],
    discounts: partial.discounts ?? [],
    inventory: partial.inventory ?? [],
    metrics,
  };
}
