import type { ConnectionsView } from "@/lib/services/connections";
import type { ConnectionCategory } from "./catalog";

export type IntegrationConnectionStatus =
  | "connected"
  | "authorization_required"
  | "not_connected"
  | "coming_soon"
  | "error";

export type IntegrationBoardItem = {
  id: string;
  label: string;
  category: ConnectionCategory;
  status: IntegrationConnectionStatus;
  statusLabel: string;
  logoInitial: string;
  logoAccent: string;
  summaryLines: string[];
  primaryAction: "connect" | "reconnect" | "manage" | "none";
  planned: boolean;
  syncEndpoint?: string;
  attentionMessage?: string | null;
  detail: IntegrationDetail;
};

export type ShopifyIntegrationDetail = {
  type: "shopify";
  connected: boolean;
  isDemo: boolean;
  storeDomain: string | null;
  products: number;
  orders30d: number;
  revenue30d: number;
  lastSyncAt: string | null;
  shopifyOAuthConfigured: boolean;
  grantedScopes: string[];
  missingWriteScopes: string[];
};

export type MetaAdsIntegrationDetail = {
  type: "meta_ads";
  connected: boolean;
  metaOAuthConfigured: boolean;
  businessName: string | null;
  accountCount: number;
  lastSyncAt: string | null;
  activeCampaigns: number;
  pausedCampaigns: number;
  spend7d: number;
  accounts: ConnectionsView["metaAdsAccounts"];
};

export type GoogleAdsIntegrationDetail = {
  type: "google_ads";
  connected: boolean;
  googleOAuthConfigured: boolean;
  accountCount: number;
  lastSyncAt: string | null;
  enabledCampaigns: number;
  pausedCampaigns: number;
  spendToday: number;
  accounts: ConnectionsView["googleAdsAccounts"];
  syncPending?: boolean;
  attentionMessage?: string | null;
};

export type Ga4IntegrationDetail = {
  type: "ga4";
  connected: boolean;
  ga4OAuthConfigured: boolean;
  propertyName: string | null;
  propertyId: string | null;
  measurementId: string | null;
  lastSyncAt: string | null;
  sessions30d: number | null;
  engagementRatePct: number | null;
  ecommerceConversionRatePct: number | null;
  installationId: string | null;
};

export type GenericIntegrationDetail = {
  type: "generic";
  connected: boolean;
  description: string;
  configured: boolean;
  preview?: string;
};

export type IntegrationDetail =
  | ShopifyIntegrationDetail
  | MetaAdsIntegrationDetail
  | GoogleAdsIntegrationDetail
  | Ga4IntegrationDetail
  | GenericIntegrationDetail;

export type IntegrationBoardPayload = {
  items: IntegrationBoardItem[];
  view: ConnectionsView;
};

export const CONNECTIONS_CATEGORY_ORDER: ConnectionCategory[] = [
  "commerce",
  "advertising",
  "analytics",
  "marketing",
  "finance",
  "business_systems",
];

export const CONNECTIONS_CATEGORY_LABELS: Record<ConnectionCategory, string> = {
  commerce: "Commerce Platforms",
  advertising: "Advertising",
  analytics: "Analytics",
  marketing: "Marketing",
  finance: "Finance",
  business_systems: "Business Systems",
  payments: "Finance",
  marketplace: "Commerce Platforms",
  marketplaces: "Commerce Platforms",
};
