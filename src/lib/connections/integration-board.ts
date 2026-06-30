import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { buildIntegrationHealth } from "@/lib/integrations/health";
import { getDataSourceStatuses } from "@/lib/connectors/registry";
import { isGoogleAdsOAuthConfigured } from "@/lib/google-ads/oauth";
import { isGa4OAuthConfigured } from "@/lib/ga4/oauth";
import { isMetaOAuthConfigured } from "@/lib/meta/oauth";
import { isShopifyOAuthConfigured } from "@/lib/shopify/oauth";
import { shopifyInstallationMissingWriteScopes } from "@/lib/shopify/scopes";
import { getInstallationForStore } from "@/lib/db/shopify";
import { getConnectionsView } from "@/lib/services/connections";
import { resolveActiveStoreId } from "@/lib/store/context";
import { listGoogleAdsInstallationsForStore } from "@/lib/db/google-ads";
import { listGa4Installations } from "@/lib/db/ga4";
import { resolveGoogleAdsConnectionPresentation } from "@/lib/connections/google-ads-status";
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

function statusPresentation(
  planned: boolean,
  connected: boolean,
  oauthConfigured: boolean,
  errored: boolean,
): { status: IntegrationConnectionStatus; statusLabel: string; primaryAction: IntegrationBoardItem["primaryAction"] } {
  if (planned) {
    return { status: "coming_soon", statusLabel: "Coming soon", primaryAction: "none" };
  }
  if (errored) {
    return { status: "error", statusLabel: "Needs attention", primaryAction: "reconnect" };
  }
  if (connected) {
    return { status: "connected", statusLabel: "Connected", primaryAction: "manage" };
  }
  if (oauthConfigured) {
    return { status: "authorization_required", statusLabel: "Authorization required", primaryAction: "connect" };
  }
  return { status: "not_connected", statusLabel: "Not connected", primaryAction: "connect" };
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
      const connected = view.commerceConnected || view.isDemo;
      const needsScopeUpgrade =
        connected && !view.isDemo && shopifyMissingWriteScopes.length > 0;
      const pres = statusPresentation(
        false,
        connected,
        isShopifyOAuthConfigured(),
        health?.syncFailed ?? false,
      );
      if (needsScopeUpgrade) {
        pres.status = "error";
        pres.statusLabel = "Permissions upgrade required";
        pres.primaryAction = "reconnect";
      }
      return {
        id: def.id,
        label: def.label,
        category: def.category,
        ...pres,
        logoInitial: def.logoInitial,
        logoAccent: def.logoAccent,
        planned: false,
        syncEndpoint: def.syncEndpoint,
        summaryLines: connected
          ? needsScopeUpgrade
            ? [`Missing scopes: ${shopifyMissingWriteScopes.join(", ")}`, "Reconnect to enable discounts"]
            : [
                `${snapshot.products.length} Products`,
                `${snapshot.storeMetrics.orders30d} Orders (30d)`,
              ]
          : ["Connect your storefront"],
        detail: {
          type: "shopify",
          connected,
          isDemo: view.isDemo,
          storeDomain: view.commerceDomain,
          products: snapshot.products.length,
          orders30d: snapshot.storeMetrics.orders30d,
          revenue30d: snapshot.storeMetrics.revenue30d,
          lastSyncAt: health?.lastSyncAt ?? snapshot.syncedAt,
          shopifyOAuthConfigured: isShopifyOAuthConfigured(),
          grantedScopes: shopifyGrantedScopes,
          missingWriteScopes: shopifyMissingWriteScopes,
        } satisfies ShopifyIntegrationDetail,
      };
    }

    if (def.id === "meta_ads") {
      const connected = view.metaConnected;
      const pres = statusPresentation(false, connected, isMetaOAuthConfigured(), health?.syncFailed ?? false);
      const business = view.metaAdsAccounts.map((a) => a.businessName).filter(Boolean)[0] ?? null;
      return {
        id: def.id,
        label: def.label,
        category: def.category,
        ...pres,
        logoInitial: def.logoInitial,
        logoAccent: def.logoAccent,
        planned: false,
        syncEndpoint: def.syncEndpoint,
        summaryLines: connected
          ? [
              `${view.metaCampaignTotals.totalCount} Campaigns`,
              `${formatCurrency(snapshot.campaigns.reduce((s, c) => s + c.spend7d, 0))} Spend (7d)`,
            ]
          : ["Connect Meta Ads"],
        detail: {
          type: "meta_ads",
          connected,
          metaOAuthConfigured: view.metaOAuthConfigured,
          businessName: business,
          accountCount: view.metaAdsAccounts.length,
          lastSyncAt: health?.lastSyncAt ?? null,
          activeCampaigns: view.metaCampaignTotals.activeCount,
          pausedCampaigns: view.metaCampaignTotals.pausedCount,
          spend7d: snapshot.campaigns.reduce((s, c) => s + c.spend7d, 0),
          accounts: view.metaAdsAccounts,
        } satisfies MetaAdsIntegrationDetail,
      };
    }

    if (def.id === "google_ads") {
      const connected = view.googleConnected;
      const googleSource = dataSources.find((d) => d.id === "google_ads");
      const googleState = resolveGoogleAdsConnectionPresentation({
        connected,
        oauthConfigured: view.googleOAuthConfigured,
        installations: googleInstalls,
        connectorSource: googleSource,
      });
      const spendToday = snapshot.googleAdsSnapshot?.rollups.today.spend ?? 0;
      return {
        id: def.id,
        label: def.label,
        category: def.category,
        status: googleState.status,
        statusLabel: googleState.statusLabel,
        primaryAction: googleState.primaryAction,
        attentionMessage: googleState.errorMessage,
        logoInitial: def.logoInitial,
        logoAccent: def.logoAccent,
        planned: false,
        syncEndpoint: def.syncEndpoint,
        summaryLines: connected
          ? [
              `${snapshot.googleAdsSnapshot?.campaigns.length ?? view.googleCampaignTotals.totalCount} Campaigns`,
              `${formatCurrency(spendToday)} Spend (today)`,
            ]
          : ["Connect Google Ads"],
        detail: {
          type: "google_ads",
          connected,
          googleOAuthConfigured: view.googleOAuthConfigured,
          accountCount: view.googleAdsAccounts.length,
          lastSyncAt: health?.lastSyncAt ?? null,
          enabledCampaigns: view.googleCampaignTotals.enabledCount,
          pausedCampaigns: view.googleCampaignTotals.pausedCount,
          spendToday,
          accounts: view.googleAdsAccounts,
          syncPending: googleState.syncPending,
          attentionMessage: googleState.errorMessage,
        } satisfies GoogleAdsIntegrationDetail,
      };
    }

    if (def.id === "ga4") {
      const ga4Install = ga4Installs[0];
      const connected = Boolean(ga4Install) || Boolean(snapshot.ga4Snapshot?.sessions30d);
      const ga4Health = dataSources.find((d) => d.id === "ga4");
      const pres = statusPresentation(
        false,
        connected,
        isGa4OAuthConfigured(),
        ga4Health?.status === "error",
      );
      const ga4 = snapshot.ga4Snapshot;
      return {
        id: def.id,
        label: def.label,
        category: def.category,
        ...pres,
        logoInitial: def.logoInitial,
        logoAccent: def.logoAccent,
        planned: false,
        syncEndpoint: def.syncEndpoint,
        summaryLines: connected
          ? [
              `${(ga4?.sessions30d ?? 0).toLocaleString()} Sessions (30d)`,
              ga4?.engagementRatePct != null
                ? `${ga4.engagementRatePct.toFixed(0)}% Engagement`
                : "Sync for engagement metrics",
            ]
          : ["Connect GA4"],
        detail: {
          type: "ga4",
          connected,
          ga4OAuthConfigured: isGa4OAuthConfigured(),
          propertyName: ga4Install?.property_name ?? null,
          propertyId: ga4Install?.property_id ?? null,
          measurementId: ga4Install?.measurement_id ?? null,
          lastSyncAt: ga4Health?.lastSyncAt ?? ga4Install?.last_sync_at ?? ga4?.syncedAt ?? null,
          sessions30d: ga4?.sessions30d ?? null,
          engagementRatePct: ga4?.engagementRatePct ?? null,
          ecommerceConversionRatePct: ga4?.ecommerceConversionRatePct ?? null,
          installationId: ga4Install?.id ?? null,
        } satisfies Ga4IntegrationDetail,
      };
    }

    if (def.planned) {
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
        detail: {
          type: "generic",
          connected: false,
          description: def.description,
          configured: false,
        },
      };
    }

    const connected = health?.status === "connected" || health?.status === "demo";
    const configured = health?.status === "waiting";
    const pres = statusPresentation(false, connected, configured, health?.syncFailed ?? false);

    return {
      id: def.id,
      label: def.label,
      category: def.category,
      ...pres,
      logoInitial: def.logoInitial,
      logoAccent: def.logoAccent,
      planned: false,
      syncEndpoint: health?.syncEndpoint,
      summaryLines: health?.metrics.slice(0, 2).map((m) => `${m.value} ${m.label}`) ?? [def.description],
      detail: {
        type: "generic",
        connected,
        description: def.description,
        configured,
        preview: health?.metrics[0]?.value,
      },
    };
  });

  return { items, view };
}
