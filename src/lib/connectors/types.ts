import type {
  ConnectorStatus,
  DataSourceId,
  DataSourceStatus,
} from "@/lib/types";
import type { AdSpendRollups, AdSpendSnapshot, DailyMetricPoint } from "@/lib/ads/types";

export type { AdSpendRollups, AdSpendSnapshot, DailyMetricPoint };

export type ShopifyProduct = CommerceProductLegacy;
export type ShopifyCollection = CommerceCollectionLegacy;

/** @deprecated Import from @/lib/commerce — provider-neutral product model */
export type CommerceProductLegacy = {
  id: string;
  title: string;
  inventoryQuantity: number;
  unitsSold30d: number;
  revenue30d: number;
  price: number;
  compareAtPrice?: number;
  /** Platform inventory unit cost when available */
  unitCost?: number;
  collectionIds: string[];
  tags: string[];
  imageUrl?: string;
  /** When false, Shopify is not tracking inventory quantities for this product */
  inventoryTracked?: boolean;
  /** Optional funnel metric when checkout analytics are synced */
  cartAdds30d?: number;
};

/** @deprecated Import from @/lib/commerce — provider-neutral collection model */
export type CommerceCollectionLegacy = {
  id: string;
  title: string;
  productCount: number;
  homepageFeatured: boolean;
  revenue30d: number;
};

export type { CommercePlatformId } from "@/lib/commerce/types";

export type ProductWindowStats = {
  units: number;
  revenue: number;
  discounts: number;
  refunds: number;
};

export type ProductOrderStats = {
  last7d: ProductWindowStats;
  last30d: ProductWindowStats;
  previous30d: ProductWindowStats;
};

export type ProfitOrderBucket = {
  revenue: number;
  cogs: number;
  shipping: number;
  refunds: number;
  orders: number;
};

export type ProfitOrderRollups = {
  today: ProfitOrderBucket;
  yesterday: ProfitOrderBucket;
  last7d: ProfitOrderBucket;
  last30d: ProfitOrderBucket;
};

export type SalesTrendPeriod = {
  revenue: number;
  orders: number;
  aov: number;
};

export type SalesTrends = {
  thisWeek: SalesTrendPeriod;
  lastWeek: SalesTrendPeriod;
  last30Days: SalesTrendPeriod;
  previous30Days: SalesTrendPeriod;
};

export type MetaCampaignEffectiveStatus =
  | "ACTIVE"
  | "PAUSED"
  | "DRAFT"
  | "ARCHIVED"
  | "DELETED";

export type MetaCampaign = {
  id: string;
  name: string;
  /** @deprecated Use effectiveStatus */
  status: MetaCampaignEffectiveStatus | string;
  /** Normalized bucket for analytics (ACTIVE, PAUSED, …) */
  effectiveStatus: MetaCampaignEffectiveStatus;
  /** Raw effective_status from Meta API — use for display */
  metaEffectiveStatus: string;
  spend7d: number;
  revenue7d: number;
  roas7d: number;
  ctr7d: number;
  frequency7d: number;
  impressions7d: number;
  /** Unique people reached (7d) — from Meta insights when available */
  reach7d?: number;
  clicks7d?: number;
  conversions7d?: number;
  leads7d?: number;
  qualifiedLeads7d?: number;
  videoViews7d?: number;
  thruPlay7d?: number;
  appInstalls7d?: number;
  /** Landing page views (7d) */
  landingPageViews7d?: number;
  /** Bounce rate 0–100 when available */
  bounceRate7d?: number;
  /** Post-install activations (7d) */
  activations7d?: number;
  /** Estimated 7-day profit from attributed revenue */
  profit7d?: number;
  adAccountId?: string;
  adAccountName?: string;
  /** Meta campaign objective (e.g. MESSAGES, OUTCOME_TRAFFIC) */
  objective?: string;
  /** Normalized objective for the decision engine */
  campaignObjective?: import("@/lib/meta/campaign-objectives").CampaignObjective;
  destinationType?: string;
  optimizationGoal?: string;
  /** Daily budget in minor currency units (cents) — campaign or ad set level */
  dailyBudgetCents?: number;
  lifetimeBudgetCents?: number;
  currency?: string;
  startTime?: string;
  stopTime?: string;
};

export type StoreSnapshot = {
  source: ConnectorStatus;
  syncedAt: string;
  /** Active commerce platform — AI layer uses normalized models, not platform-specific APIs */
  commerceProvider?: import("@/lib/commerce/types").CommercePlatformId;
  commerceStoreDomain?: string;
  products: ShopifyProduct[];
  collections: ShopifyCollection[];
  campaigns: MetaCampaign[];
  storeMetrics: {
    revenue30d: number;
    orders30d: number;
    aov30d: number;
    conversionRate30d: number;
  };
  salesTrends?: SalesTrends;
  profitRollups?: ProfitOrderRollups;
  adSpendSnapshot?: AdSpendSnapshot;
  dailyMetrics?: DailyMetricPoint[];
  /** Account-level Meta rollups when available (preferred over campaign scaling) */
  metaAccountRollups?: AdSpendRollups;
  /** Consumed during snapshot aggregation — merged into dailyMetrics */
  metaDailySpend?: { date: string; spend: number }[];
  googleDailySpend?: { date: string; spend: number }[];
  productOrderStats?: Record<string, ProductOrderStats>;
  /** Explicit attribution touchpoint events (demo or future pixel sync) */
  attributionEvents?: import("@/lib/attribution/models").AttributionEvent[];
  /** Phase 6 — connected business systems */
  integrationSnapshot?: import("@/lib/integrations/types").IntegrationSnapshot;
  /** Live Google Ads data from OAuth sync (preferred over demo integration) */
  googleAdsSnapshot?: import("@/lib/integrations/types").GoogleAdsSnapshot;
  tiktokAdsSnapshot?: import("@/lib/integrations/types").TikTokAdsSnapshot;
  klaviyoSnapshot?: import("@/lib/integrations/types").KlaviyoSnapshot;
  ga4Snapshot?: import("@/lib/integrations/types").GA4Snapshot;
  metaCapiStatus?: import("@/lib/integrations/types").MetaCapiStatus;
  operationalCosts?: import("@/lib/integrations/types").OperationalCosts;
  /** Customer-level records for intelligence dashboard (demo or Shopify sync) */
  customerSnapshot?: import("@/lib/customers/types").CustomerSnapshot;
  /** Normalized orders for aggregated customer metrics (Shopify sync or demo) */
  commerceOrders?: import("@/lib/commerce/types").CommerceOrder[];
  /** Shopify customersCount when available from store sync */
  shopifyCustomersCount?: number;
  connectorStates: Partial<Record<DataSourceId, ConnectorStatus>>;
  /** Active demo business scenario when source is demo */
  demoScenario?: import("@/lib/demo/scenarios/types").DemoScenarioId;
};

export interface StoreDataConnector {
  id: DataSourceId;
  label: string;
  getStatus(): Promise<DataSourceStatus>;
  fetchStoreSnapshot(): Promise<Partial<StoreSnapshot>>;
}

export type ConnectorRegistry = Record<DataSourceId, StoreDataConnector | null>;
