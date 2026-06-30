export type {
  CommercePlatformId,
  CommerceProduct,
  CommerceCollection,
  CommerceCustomer,
  CommerceOrder,
  CommerceDiscount,
  CommerceInventoryItem,
  CommerceStoreMetrics,
  NormalizedCommerceSnapshot,
  MarketplacePlatformId,
} from "./types";

export {
  COMMERCE_PLATFORMS,
  MARKETPLACE_PLATFORMS,
  getCommercePlatform,
  getAvailableCommercePlatforms,
  getPlannedCommercePlatforms,
} from "./registry";

export type { CommerceProviderAdapter, CommerceSyncPartial } from "./provider";
export { mergeCommercePartial } from "./provider";

export {
  normalizeCommerceSnapshot,
  loadNormalizedCommerce,
  mapLegacyProduct,
  mapLegacyCollection,
} from "./normalize";

export {
  shopifyCommerceProvider,
} from "./providers/shopify";

export {
  COMMERCE_PROVIDER_ADAPTERS,
  resolveActiveCommerceProvider,
  getCommerceProvider,
  listConfiguredCommerceProviders,
} from "./providers/registry";
