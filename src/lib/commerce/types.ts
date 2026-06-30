/** Supported and planned ecommerce platforms — AI layer consumes only normalized models. */

export type CommercePlatformId =
  | "shopify"
  | "amazon_seller"
  | "woocommerce"
  | "bigcommerce"
  | "wix"
  | "squarespace"
  | "magento"
  | "prestashop"
  | "opencart";

export type MarketplacePlatformId = "amazon" | "ebay" | "etsy";

export type CommercePlatformStatus = "available" | "planned" | "beta";

export type CommercePlatformDefinition = {
  id: CommercePlatformId;
  label: string;
  description: string;
  status: CommercePlatformStatus;
  connectHref?: string;
  /** Maps to legacy connector id when available */
  connectorId?: string;
};

export type MarketplaceDefinition = {
  id: MarketplacePlatformId;
  label: string;
  description: string;
  status: CommercePlatformStatus;
};

/** Provider-neutral commerce entities — AI and insights consume these only. */

export type CommerceProduct = {
  id: string;
  externalId: string;
  platform: CommercePlatformId;
  title: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  inventoryQuantity: number;
  unitsSold30d: number;
  revenue30d: number;
  unitCost?: number;
  collectionIds: string[];
  tags: string[];
  imageUrl?: string;
  cartAdds30d?: number;
};

export type CommerceCollection = {
  id: string;
  externalId: string;
  platform: CommercePlatformId;
  title: string;
  productCount: number;
  homepageFeatured: boolean;
  revenue30d: number;
};

export type CommerceCustomer = {
  id: string;
  externalId: string;
  platform: CommercePlatformId;
  email?: string;
  ordersCount: number;
  totalSpent: number;
  isReturning: boolean;
};

export type CommerceOrderLine = {
  productId: string;
  title: string;
  quantity: number;
  revenue: number;
  unitCost?: number;
};

export type CommerceOrder = {
  id: string;
  externalId: string;
  platform: CommercePlatformId;
  createdAt: string;
  revenue: number;
  cogs: number;
  shipping: number;
  discounts: number;
  refunds: number;
  isNewCustomer: boolean;
  customerId?: string;
  customerEmail?: string;
  lines: CommerceOrderLine[];
};

export type CommerceDiscount = {
  id: string;
  externalId: string;
  platform: CommercePlatformId;
  code?: string;
  title: string;
  usageCount30d: number;
  revenueImpact30d: number;
};

export type CommerceInventoryItem = {
  productId: string;
  title: string;
  quantity: number;
  daysUntilStockout: number | null;
  velocityPerDay: number;
};

export type CommerceStoreMetrics = {
  revenue30d: number;
  orders30d: number;
  aov30d: number;
  conversionRate30d: number;
};

/** Normalized commerce snapshot — the only shape the AI layer should depend on. */
export type NormalizedCommerceSnapshot = {
  platform: CommercePlatformId;
  platformLabel: string;
  storeDomain?: string;
  syncedAt: string;
  isLive: boolean;
  products: CommerceProduct[];
  collections: CommerceCollection[];
  customers: CommerceCustomer[];
  orders: CommerceOrder[];
  discounts: CommerceDiscount[];
  inventory: CommerceInventoryItem[];
  metrics: CommerceStoreMetrics;
};
