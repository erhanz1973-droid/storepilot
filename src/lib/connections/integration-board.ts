import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { buildIntegrationHealth } from "@/lib/integrations/health";
import { getDataSourceStatuses } from "@/lib/connectors/registry";
import { isGoogleAdsOAuthConfigured } from "@/lib/google-ads/oauth";
import { isGa4OAuthConfigured } from "@/lib/ga4/oauth";
import { buildGa4FunnelOnboardingSteps } from "@/lib/ga4/onboarding";
import { isMetaOAuthConfigured } from "@/lib/meta/oauth";
import { isShopifyOAuthConfigured } from "@/lib/shopify/oauth";
import { shopifyInstallationMissingWriteScopes } from "@/lib/shopify/scopes";
import { getInstallationForStore } from "@/lib/db/shopify";
import { getConnectionsView } from "@/lib/services/connections";
import { resolveActiveStoreId } from "@/lib/store/context";
import { listGoogleAdsInstallationsForStore } from "@/lib/db/google-ads";
import { listGa4Installations } from "@/lib/db/ga4";
import {
  presentationShowsAsConnected,
  resolveGa4ConnectionPresentation,
  resolveGoogleAdsConnectionPresentationV2,
  resolveMetaConnectionPresentation,
  resolveShopifyConnectionPresentation,
  type ConnectionPresentation,
} from "@/lib/connections/connection-state";
import type { ConnectionCategory } from "./catalog";

export type {
  IntegrationBoardItem,
  IntegrationBoardPayload,
  IntegrationConnectionStatus,
  IntegrationDetail,
  ShopifyIntegrationDetail,
  MetaAdsIntegrationDetail,
  GoogleAdsIntegrationDetail,
  Ga4IntegrationDetail,
  GenericIntegrationDetail,
} from "./integration-board.types";

export {
  CONNECTIONS_CATEGORY_ORDER,
  CONNECTIONS_CATEGORY_LABELS,
} from "./integration-board.types";

import type {
  Ga4IntegrationDetail,
  GoogleAdsIntegrationDetail,
  IntegrationBoardItem,
  IntegrationBoardPayload,
  IntegrationConnectionStatus,
  MetaAdsIntegrationDetail,
  ShopifyIntegrationDetail,
} from "./integration-board.types";

type PageIntegrationDef = {
  id: string;
  label: string;
  category: ConnectionCategory;
  logoInitial: string;
  logoAccent: string;
  planned: boolean;
  description: string;
  syncEndpoint?: string;
};

export const CONNECTIONS_PAGE_INTEGRATIONS: PageIntegrationDef[] = [
  { id: "shopify", label: "Shopify", category: "commerce", logoInitial: "S", logoAccent: "#95bf47", planned: false, description: "Store catalog, orders, inventory, and customers.", syncEndpoint: "/api/shopify/sync" },
  { id: "amazon_seller", label: "Amazon Seller Central", category: "commerce", logoInitial: "A", logoAccent: "#ff9900", planned: true, description: "Seller catalog, FBA inventory, and orders." },
  { id: "woocommerce", label: "WooCommerce", category: "commerce", logoInitial: "W", logoAccent: "#7f54b3", planned: true, description: "WordPress storefront products and orders." },
  { id: "bigcommerce", label: "BigCommerce", category: "commerce", logoInitial: "B", logoAccent: "#34313f", planned: true, description: "Enterprise storefront catalog and orders." },
  { id: "wix", label: "Wix", category: "commerce", logoInitial: "W", logoAccent: "#0c6efc", planned: true, description: "Wix Stores products and orders." },
  { id: "magento", label: "Magento", category: "commerce", logoInitial: "M", logoAccent: "#f26322", planned: true, description: "Adobe Commerce catalog and order APIs." },
  { id: "squarespace", label: "Squarespace Commerce", category: "commerce", logoInitial: "Sq", logoAccent: "#ffffff", planned: true, description: "Squarespace product and order sync." },
  { id: "prestashop", label: "PrestaShop", category: "commerce", logoInitial: "P", logoAccent: "#df0067", planned: true, description: "Open-source ecommerce catalog and orders." },
  { id: "opencart", label: "OpenCart", category: "commerce", logoInitial: "OC", logoAccent: "#23a8e0", planned: true, description: "OpenCart store products and sales data." },
  { id: "google_ads", label: "Google Ads", category: "advertising", logoInitial: "G", logoAccent: "#4285f4", planned: false, description: "Search, Shopping, and Performance Max campaigns.", syncEndpoint: "/api/google/sync" },
  { id: "meta_ads", label: "Meta Ads", category: "advertising", logoInitial: "M", logoAccent: "#0668E1", planned: false, description: "Facebook and Instagram ad performance.", syncEndpoint: "/api/meta/sync" },
  { id: "tiktok", label: "TikTok Ads", category: "advertising", logoInitial: "T", logoAccent: "#010101", planned: false, description: "TikTok campaign spend and conversions." },
  { id: "pinterest_ads", label: "Pinterest Ads", category: "advertising", logoInitial: "P", logoAccent: "#e60023", planned: true, description: "Pinterest shopping and awareness ads." },
  { id: "ga4", label: "Google Analytics 4", category: "analytics", logoInitial: "A", logoAccent: "#e37400", planned: false, description: "Sessions, landing pages, and attribution data.", syncEndpoint: "/api/ga4/sync" },
  { id: "merchant_center", label: "Google Merchant Center", category: "analytics", logoInitial: "MC", logoAccent: "#34a853", planned: true, description: "Product feed and Shopping performance." },
  { id: "klaviyo", label: "Klaviyo", category: "marketing", logoInitial: "K", logoAccent: "#2c2c2c", planned: false, description: "Email flows and campaign revenue." },
  { id: "mailchimp", label: "Mailchimp", category: "marketing", logoInitial: "MC", logoAccent: "#ffe01b", planned: true, description: "Email campaigns and audience segments." },
  { id: "stripe", label: "Stripe", category: "finance", logoInitial: "S", logoAccent: "#635bff", planned: true, description: "Payment revenue and fee reconciliation." },
  { id: "paypal", label: "PayPal", category: "finance", logoInitial: "PP", logoAccent: "#003087", planned: true, description: "PayPal transactions and payouts." },
  { id: "erp", label: "ERP", category: "business_systems", logoInitial: "ERP", logoAccent: "#5c6bc0", planned: true, description: "Inventory, COGS, and fulfillment systems." },
  { id: "accounting", label: "Accounting Systems", category: "business_systems", logoInitial: "AC", logoAccent: "#00897b", planned: true, description: "QuickBooks, Xero, and accounting integrations." },
  { id: "custom_api", label: "Custom APIs", category: "business_systems", logoInitial: "API", logoAccent: "#78909c", planned: true, description: "Webhook and REST integrations for custom data sources." },
];

function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function boardItemFromPresentation(
  def: PageIntegrationDef,
  pres: ConnectionPresentation,
  extras: Omit<
    IntegrationBoardItem,
    | keyof ConnectionPresentation
    | "id"
    | "label"
    | "category"
    | "planned"
    | "logoInitial"
    | "logoAccent"
    | "detail"
    | "health"
    | "status"
    | "statusLabel"
    | "primaryAction"
    | "attentionMessage"
    | "guidanceMessage"
    | "errorReason"
    | "cachedDataNote"
    | "showCachedMetrics"
    | "canSync"
  > & {
    detail: IntegrationBoardItem["detail"];
  },
): IntegrationBoardItem {
  const statusLabel =
    pres.state === "connected_warning"
      ? "Connected"
      : pres.state === "sync_failed"
        ? "Sync Failed"
        : pres.statusLabel;

  return {
    ...extras,
    id: def.id,
    label: def.label,
    category: def.category,
    status: pres.state,
    statusLabel,
    logoInitial: def.logoInitial,
    logoAccent: def.logoAccent,
    planned: def.planned,
    primaryAction: pres.primaryAction,
    attentionMessage: pres.attentionMessage,
    guidanceMessage: pres.guidanceMessage,
    errorReason: pres.errorReason,
    cachedDataNote: pres.cachedDataNote,
    showCachedMetrics: pres.showCachedMetrics,
    canSync: pres.canSync,
    health: pres.health,
    syncEndpoint: def.syncEndpoint,
  };
}

function comingSoonItem(def: PageIntegrationDef): IntegrationBoardItem {
  const health = {
    authentication: { label: "Authentication", status: "na" as const },
    permissions: { label: "Permissions", status: "na" as const },
    accountOrProperty: { label: "Account", status: "na" as const },
    dataSync: { label: "Data Sync", status: "na" as const },
    lastSuccessfulSync: null,
    overallHealth: "not_connected" as const,
    overallLabel: "Coming Soon",
  };
  return {
    id: def.id,
    label: def.label,
    category: def.category,
    status: "coming_soon",
    statusLabel: "Coming soon",
    logoInitial: def.logoInitial,
    logoAccent: def.logoAccent,
    summaryLines: ["Available in a future release"],
    primaryAction: "none",
    planned: true,
    health,
    detail: {
      type: "generic",
      connected: false,
      description: def.description,
      configured: false,
    },
  };
}

export async function buildIntegrationBoard(): Promise<IntegrationBoardPayload> {
  const storeId = await resolveActiveStoreId();
  const [view, snapshot, dataSources, googleInstalls, ga4Installs] = await Promise.all([
    getConnectionsView(),
    aggregateStoreSnapshot(storeId),
    getDataSourceStatuses(storeId),
    listGoogleAdsInstallationsForStore(storeId),
    listGa4Installations(storeId),
  ]);
  const healthCards = await buildIntegrationHealth(snapshot, dataSources, storeId);
  const healthById = new Map(healthCards.map((c) => [c.id, c]));
  const shopifyInstallation = await getInstallationForStore(storeId);
  const shopifyGrantedScopes = shopifyInstallation?.scopes ?? [];
  const shopifyMissingWriteScopes = shopifyInstallationMissingWriteScopes(shopifyGrantedScopes);

  const items: IntegrationBoardItem[] = CONNECTIONS_PAGE_INTEGRATIONS.map((def) => {
    const health = healthById.get(def.id);

    if (def.id === "shopify") {
      const commerceConnected = view.commerceConnected || view.isDemo;
      const pres = resolveShopifyConnectionPresentation({
        connected: commerceConnected,
        isDemo: view.isDemo,
        oauthConfigured: isShopifyOAuthConfigured(),
        missingScopes: shopifyMissingWriteScopes,
        syncFailed: health?.syncFailed ?? false,
        errorMessage: health?.errorMessage,
        lastSyncAt: health?.lastSyncAt ?? snapshot.syncedAt,
      });
      return boardItemFromPresentation(def, pres, {
        summaryLines: commerceConnected
          ? shopifyMissingWriteScopes.length > 0 && !view.isDemo
            ? [`Missing scopes: ${shopifyMissingWriteScopes.join(", ")}`, "Reconnect to enable discounts"]
            : [
                `${snapshot.products.length} Products`,
                `${snapshot.storeMetrics.orders30d} Orders (30d)`,
              ]
          : ["Connect your storefront"],
        detail: {
          type: "shopify",
          connected: commerceConnected,
          isDemo: view.isDemo,
          storeDomain: view.commerceDomain,
          products: snapshot.products.length,
          orders30d: snapshot.storeMetrics.orders30d,
          revenue30d: snapshot.storeMetrics.revenue30d,
          lastSyncAt: pres.health.lastSuccessfulSync ?? snapshot.syncedAt,
          shopifyOAuthConfigured: isShopifyOAuthConfigured(),
          grantedScopes: shopifyGrantedScopes,
          missingWriteScopes: shopifyMissingWriteScopes,
        } satisfies ShopifyIntegrationDetail,
      });
    }

    if (def.id === "meta_ads") {
      const pres = resolveMetaConnectionPresentation({
        connected: view.metaConnected,
        oauthConfigured: view.metaOAuthConfigured,
        syncFailed: health?.syncFailed ?? false,
        errorMessage: health?.errorMessage,
        lastSyncAt: health?.lastSyncAt ?? view.metaAdsAccounts[0]?.lastSyncAt ?? null,
        hasAccount: view.metaAdsAccounts.length > 0,
      });
      const business = view.metaAdsAccounts.map((a) => a.businessName).filter(Boolean)[0] ?? null;
      return boardItemFromPresentation(def, pres, {
        summaryLines: presentationShowsAsConnected(pres.state)
          ? [
              `${view.metaCampaignTotals.totalCount} Campaigns`,
              `${formatCurrency(snapshot.campaigns.reduce((s, c) => s + c.spend7d, 0))} Spend (7d)`,
            ]
          : ["Connect Meta Ads"],
        detail: {
          type: "meta_ads",
          connected: presentationShowsAsConnected(pres.state),
          metaOAuthConfigured: view.metaOAuthConfigured,
          businessName: business,
          accountCount: view.metaAdsAccounts.length,
          lastSyncAt: pres.health.lastSuccessfulSync,
          activeCampaigns: view.metaCampaignTotals.activeCount,
          pausedCampaigns: view.metaCampaignTotals.pausedCount,
          spend7d: snapshot.campaigns.reduce((s, c) => s + c.spend7d, 0),
          accounts: view.metaAdsAccounts,
        } satisfies MetaAdsIntegrationDetail,
      });
    }

    if (def.id === "google_ads") {
      const googleSource = dataSources.find((d) => d.id === "google_ads");
      const pres = resolveGoogleAdsConnectionPresentationV2({
        connected: view.googleConnected,
        oauthConfigured: view.googleOAuthConfigured,
        installations: googleInstalls,
        connectorSource: googleSource,
      });
      const spendToday = snapshot.googleAdsSnapshot?.rollups.today.spend ?? 0;
      return boardItemFromPresentation(def, pres, {
        summaryLines: presentationShowsAsConnected(pres.state)
          ? [
              `${snapshot.googleAdsSnapshot?.campaigns.length ?? view.googleCampaignTotals.totalCount} Campaigns`,
              `${formatCurrency(spendToday)} Spend (today)`,
            ]
          : ["Connect Google Ads"],
        detail: {
          type: "google_ads",
          connected: presentationShowsAsConnected(pres.state),
          googleOAuthConfigured: view.googleOAuthConfigured,
          accountCount: view.googleAdsAccounts.length,
          lastSyncAt: pres.health.lastSuccessfulSync,
          enabledCampaigns: view.googleCampaignTotals.enabledCount,
          pausedCampaigns: view.googleCampaignTotals.pausedCount,
          spendToday,
          accounts: view.googleAdsAccounts,
          syncPending: pres.state === "connected_warning" && !pres.health.lastSuccessfulSync,
          attentionMessage: pres.attentionMessage,
        } satisfies GoogleAdsIntegrationDetail,
      });
    }

    if (def.id === "ga4") {
      const ga4Install = ga4Installs[0];
      const ga4Health = dataSources.find((d) => d.id === "ga4");
      const ga4 = snapshot.ga4Snapshot;
      const pres = resolveGa4ConnectionPresentation({
        oauthConfigured: isGa4OAuthConfigured(),
        isDemo: view.isDemo,
        install: ga4Install,
        connectorSource: ga4Health,
        cachedSnapshot: ga4,
      });
      const showMetrics = pres.state === "connected" || pres.showCachedMetrics;
      return boardItemFromPresentation(def, pres, {
        summaryLines: showMetrics && ga4?.sessions30d
          ? [
              `${ga4.sessions30d.toLocaleString()} Sessions (30d)`,
              ga4.engagementRatePct != null
                ? `${ga4.engagementRatePct.toFixed(0)}% Engagement`
                : "Sync for engagement metrics",
            ]
          : pres.state === "not_connected" || pres.state === "authorization_required"
            ? ["Connect GA4 for sessions & behavior"]
            : [pres.attentionMessage ?? pres.guidanceMessage ?? "Complete GA4 setup"],
        detail: {
          type: "ga4",
          connected: presentationShowsAsConnected(pres.state),
          ga4OAuthConfigured: isGa4OAuthConfigured(),
          propertyName: ga4Install?.property_name ?? null,
          propertyId: ga4Install?.property_id ?? null,
          measurementId: ga4Install?.measurement_id ?? null,
          lastSyncAt: pres.health.lastSuccessfulSync,
          lastSuccessfulSyncAt: pres.health.lastSuccessfulSync,
          sessions30d: showMetrics ? (ga4?.sessions30d ?? null) : null,
          engagementRatePct: showMetrics ? (ga4?.engagementRatePct ?? null) : null,
          ecommerceConversionRatePct: showMetrics ? (ga4?.ecommerceConversionRatePct ?? null) : null,
          installationId: ga4Install?.id ?? null,
          funnelEventsVerified: Boolean(
            ga4?.funnelEvents?.verified && (ga4?.funnelEvents?.productViews30d ?? 0) > 0,
          ),
          funnelOnboardingSteps: buildGa4FunnelOnboardingSteps(snapshot),
          cachedDataNote: pres.cachedDataNote,
          showCachedMetrics: pres.showCachedMetrics,
        } satisfies Ga4IntegrationDetail,
      });
    }

    if (def.planned) {
      return comingSoonItem(def);
    }

    const connected = health?.status === "connected" || health?.status === "demo";
    const genericPres = connected
      ? resolveShopifyConnectionPresentation({
          connected: true,
          isDemo: health?.status === "demo",
          oauthConfigured: true,
          missingScopes: [],
          syncFailed: health?.syncFailed ?? false,
          errorMessage: health?.errorMessage,
          lastSyncAt: health?.lastSyncAt ?? null,
        })
      : resolveShopifyConnectionPresentation({
          connected: false,
          isDemo: false,
          oauthConfigured: health?.status === "waiting",
          missingScopes: [],
          syncFailed: false,
          lastSyncAt: null,
        });

    return boardItemFromPresentation(def, genericPres, {
      summaryLines: health?.metrics.slice(0, 2).map((m) => `${m.value} ${m.label}`) ?? [def.description],
      detail: {
        type: "generic",
        connected,
        description: def.description,
        configured: health?.status === "waiting",
        preview: health?.metrics[0]?.value,
      },
    });
  });

  return { items, view };
}
