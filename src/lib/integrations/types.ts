/** Phase 6 — live integration payloads attached to StoreSnapshot */

export type GoogleAdsCampaignType =
  | "search"
  | "performance_max"
  | "shopping"
  | "display"
  | "video";

export type GoogleAdsCampaign = {
  id: string;
  name: string;
  type: GoogleAdsCampaignType;
  status: string;
  spend7d: number;
  revenue7d: number;
  roas7d: number;
  impressions7d: number;
  clicks7d: number;
  conversions7d: number;
};

export type GoogleAdsAdGroup = {
  id: string;
  campaignId: string;
  name: string;
  spend7d: number;
  revenue7d: number;
  roas7d: number;
};

export type GoogleAdsKeyword = {
  id: string;
  adGroupId: string;
  text: string;
  matchType: string;
  spend7d: number;
  revenue7d: number;
  roas7d: number;
};

export type GoogleAdsSnapshot = {
  campaigns: GoogleAdsCampaign[];
  adGroups: GoogleAdsAdGroup[];
  keywords: GoogleAdsKeyword[];
  searchTerms: { term: string; spend7d: number; revenue7d: number }[];
  rollups: import("@/lib/ads/types").AdSpendRollups;
  dailySpend: { date: string; spend: number }[];
};

export type TikTokCampaign = {
  id: string;
  name: string;
  spend7d: number;
  revenue7d: number;
  roas7d: number;
  impressions7d: number;
  clicks7d: number;
  conversions7d: number;
};

export type TikTokCreative = {
  id: string;
  campaignId: string;
  name: string;
  spend7d: number;
  revenue7d: number;
  roas7d: number;
  ctr7d: number;
};

export type TikTokAdsSnapshot = {
  campaigns: TikTokCampaign[];
  adGroups: { id: string; campaignId: string; name: string; spend7d: number }[];
  creatives: TikTokCreative[];
  rollups: import("@/lib/ads/types").AdSpendRollups;
  dailySpend: { date: string; spend: number }[];
};

export type KlaviyoSnapshot = {
  campaignRevenue30d: number;
  flowRevenue30d: number;
  emailAttributedRevenue30d: number;
  smsAttributedRevenue30d: number;
  orders30d: number;
  rollups: import("@/lib/ads/types").AdSpendRollups;
};

export type GA4SessionRow = {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  revenue: number;
  conversions: number;
};

export type GA4Snapshot = {
  sessions30d: number;
  /** Extended traffic metrics (Phase 2) */
  users30d?: number;
  newUsers30d?: number;
  returningUsers30d?: number;
  returningUserRatePct?: number;
  engagedSessions30d?: number;
  engagementRatePct?: number;
  avgSessionDurationSec?: number;
  purchases30d?: number;
  purchaseRevenue30d?: number;
  transactions30d?: number;
  ecommerceConversionRatePct?: number;
  landingPages: { path: string; sessions: number; revenue: number }[];
  sourceMedium: GA4SessionRow[];
  utmCampaigns: { campaign: string; sessions: number; revenue: number }[];
  devices: { device: string; sessions: number; revenue: number }[];
  countries: { country: string; sessions: number; revenue: number }[];
  channelGroups?: { channel: string; sessions: number; revenue: number }[];
  /** Daily session counts from GA4 (last 30 days) */
  dailySessions?: { date: string; sessions: number }[];
  syncedAt?: string;
  syncWindowDays?: number;
  /** Ecommerce funnel event counts — only display funnel steps when verified */
  funnelEvents?: {
    productViews30d: number;
    addToCart30d: number;
    checkout30d: number;
    purchases30d: number;
    verified: boolean;
  };
};

export type MetaCapiStatus = {
  enabled: boolean;
  eventsReceived30d: number;
  matchRatePct: number;
  events: {
    purchase: number;
    addToCart: number;
    initiateCheckout: number;
    viewContent: number;
  };
};

export type InventoryPlatformSnapshot = {
  platform: "cin7" | "stocky" | "katana" | "inventory_planner";
  skuCount: number;
  unitsOnHand: number;
  lowStockSkus: number;
  liveSync: boolean;
};

export type AccountingSnapshot = {
  provider: "quickbooks" | "xero";
  actualCogs30d: number;
  operatingExpenses30d: number;
  liveSync: boolean;
};

export type ShippingSnapshot = {
  provider: "shipstation" | "easypost" | "shipbob";
  shippingCost30d: number;
  costPerOrder: number;
  orders30d: number;
  liveSync: boolean;
};

export type SupportSnapshot = {
  provider: "gorgias" | "zendesk";
  tickets30d: number;
  supportCost30d: number;
  costPerTicket: number;
  liveSync: boolean;
};

export type WarehouseSnapshot = {
  avgFulfillmentHours: number;
  packingCostPerOrder: number;
  warehouseCost30d: number;
  processingDelayPct: number;
  liveSync: boolean;
};

export type OperationalCosts = {
  shippingCost30d: number;
  supportCost30d: number;
  warehouseCost30d: number;
  packingCost30d: number;
  /** Overrides estimated COGS when accounting connected */
  actualCogs30d: number | null;
  sources: string[];
};

export type IntegrationSnapshot = {
  googleAds?: GoogleAdsSnapshot;
  tiktokAds?: TikTokAdsSnapshot;
  klaviyo?: KlaviyoSnapshot;
  ga4?: GA4Snapshot;
  metaCapi?: MetaCapiStatus;
  inventory?: InventoryPlatformSnapshot;
  accounting?: AccountingSnapshot;
  shipping?: ShippingSnapshot;
  support?: SupportSnapshot;
  warehouse?: WarehouseSnapshot;
  operationalCosts?: OperationalCosts;
  connectedCount: number;
  estimatedCount: number;
  liveDataPct: number;
};

export type IntegrationDefinition = {
  id: string;
  label: string;
  category: "ads" | "email" | "analytics" | "inventory" | "finance" | "operations";
  priority: number;
  description: string;
  envKeys: string[];
  dataPoints: string[];
};

export const PHASE6_INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: "google_ads",
    label: "Google Ads",
    category: "ads",
    priority: 1,
    description: "Search, Shopping, Performance Max campaigns",
    envKeys: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"],
    dataPoints: ["Campaigns", "Ad Groups", "Keywords", "Search Terms", "PMax", "Shopping"],
  },
  {
    id: "tiktok",
    label: "TikTok Ads",
    category: "ads",
    priority: 2,
    description: "Campaigns, ad groups, creatives, conversions",
    envKeys: ["TIKTOK_ADS_ACCESS_TOKEN", "TIKTOK_ADS_ADVERTISER_ID"],
    dataPoints: ["Campaigns", "Ad Groups", "Creatives", "Daily Spend", "Conversions"],
  },
  {
    id: "klaviyo",
    label: "Klaviyo",
    category: "email",
    priority: 3,
    description: "Email & SMS revenue attribution",
    envKeys: ["KLAVIYO_API_KEY"],
    dataPoints: ["Campaign Revenue", "Flow Revenue", "Email Attribution", "SMS Attribution"],
  },
  {
    id: "ga4",
    label: "Google Analytics 4",
    category: "analytics",
    priority: 4,
    description: "Sessions, UTMs, landing pages, devices",
    envKeys: ["GA4_CLIENT_ID", "GA4_CLIENT_SECRET", "GA4_APP_URL"],
    dataPoints: ["Sessions", "UTM", "Source/Medium", "Landing Pages", "Device", "Geo"],
  },
  {
    id: "meta_capi",
    label: "Meta Conversion API",
    category: "analytics",
    priority: 5,
    description: "Server-side purchase and funnel events",
    envKeys: ["META_CAPI_PIXEL_ID", "META_CAPI_ACCESS_TOKEN"],
    dataPoints: ["Purchase", "Add To Cart", "Initiate Checkout", "View Content"],
  },
  {
    id: "inventory",
    label: "Inventory Platform",
    category: "inventory",
    priority: 6,
    description: "Cin7, Stocky, Katana, Inventory Planner",
    envKeys: ["INVENTORY_PROVIDER", "INVENTORY_API_KEY"],
    dataPoints: ["Live SKU counts", "Reorder points", "Warehouse levels"],
  },
  {
    id: "accounting",
    label: "Accounting",
    category: "finance",
    priority: 7,
    description: "QuickBooks or Xero actual COGS",
    envKeys: ["ACCOUNTING_PROVIDER", "QUICKBOOKS_REALM_ID", "XERO_TENANT_ID"],
    dataPoints: ["Actual COGS", "Operating expenses"],
  },
  {
    id: "shipping",
    label: "Shipping",
    category: "operations",
    priority: 8,
    description: "ShipStation, EasyPost, ShipBob",
    envKeys: ["SHIPPING_PROVIDER", "SHIPSTATION_API_KEY"],
    dataPoints: ["Per-order shipping cost", "Carrier breakdown"],
  },
  {
    id: "support",
    label: "Customer Support",
    category: "operations",
    priority: 9,
    description: "Gorgias or Zendesk ticket costs",
    envKeys: ["SUPPORT_PROVIDER", "GORGIAS_API_KEY", "ZENDESK_SUBDOMAIN"],
    dataPoints: ["Ticket volume", "Support cost allocation"],
  },
  {
    id: "warehouse",
    label: "Warehouse & Fulfillment",
    category: "operations",
    priority: 10,
    description: "Fulfillment time, packing, processing delays",
    envKeys: ["WAREHOUSE_PROVIDER", "WAREHOUSE_API_KEY"],
    dataPoints: ["Fulfillment time", "Packing cost", "Processing delays"],
  },
];
