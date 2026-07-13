import { DataSourceStatus } from "@/components/DataSourceStatus";
import { ConnectShopifyForm } from "@/components/ConnectShopifyForm";
import { MetaAdsConnectionPanel } from "@/components/MetaAdsConnectionPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { getConnectedStoreView } from "@/lib/services/connected-store";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function healthLabel(health: string) {
  const labels: Record<string, string> = {
    healthy: "Healthy",
    degraded: "Degraded",
    error: "Error",
    disconnected: "Disconnected",
    demo: "Demo mode",
  };
  return labels[health] ?? health;
}

export default async function ConnectedStorePage({
  searchParams,
}: {
  searchParams: Promise<{ installed?: string; meta_connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const store = await getConnectedStoreView();

  return (
    <>
      <div className="page-header">
        <h2>Connected Store</h2>
        <p>
          {store.isDemo
            ? "No Shopify store connected — using demo data for analysis."
            : `Live data from ${store.shopDomain}`}
        </p>
      </div>

      {params.installed === "1" && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--low)" }}>
          <p style={{ margin: 0 }}>Shopify store connected successfully. Initial sync complete.</p>
        </div>
      )}

      {params.meta_connected === "1" && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--low)" }}>
          <p style={{ margin: 0 }}>
            Meta Ads connected successfully. Live campaign sync complete.
          </p>
        </div>
      )}

      {params.error && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--critical)" }}>
          <p style={{ margin: 0 }}>Connection error: {decodeURIComponent(params.error)}</p>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Store Details</h3>
          <div className="stack">
            <div className="breakdown-row">
              <span>Store name</span>
              <strong>{store.shopName ?? "—"}</strong>
            </div>
            <div className="breakdown-row">
              <span>Shopify plan</span>
              <strong>{store.shopifyPlan ?? "—"}</strong>
            </div>
            <div className="breakdown-row">
              <span>Domain</span>
              <strong>{store.shopDomain ?? "Demo"}</strong>
            </div>
            <div className="breakdown-row">
              <span>Last sync</span>
              <strong>{formatDate(store.lastSyncAt)}</strong>
            </div>
            <div className="breakdown-row">
              <span>Connection health</span>
              <strong>{healthLabel(store.connectionHealth)}</strong>
            </div>
            {store.errorMessage && (
              <p className="muted" style={{ margin: 0 }}>
                {store.errorMessage}
              </p>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Sync Stats</h3>
          <div className="metrics-row">
            <div className="metric-pill">
              <span>Products</span>
              <span>{store.stats.productCount}</span>
            </div>
            <div className="metric-pill">
              <span>Inventory units</span>
              <span>{store.stats.inventoryCount}</span>
            </div>
            <div className="metric-pill">
              <span>Orders (30d)</span>
              <span>{store.stats.orderCount}</span>
            </div>
            <div className="metric-pill">
              <span>Customers</span>
              <span>{store.stats.customerCount}</span>
            </div>
            <div className="metric-pill">
              <span>Collections</span>
              <span>{store.stats.collectionCount}</span>
            </div>
            <div className="metric-pill">
              <span>Discounts</span>
              <span>
                {store.stats.discountsUnavailable
                  ? "Unavailable"
                  : store.stats.discountCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Data Sources</h3>
        <DataSourceStatus sources={store.dataSources} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Meta Ads</h3>
        {store.metaDevOverride ? (
          <p className="muted" style={{ margin: 0 }}>
            Local dev override active — set META_APP_ID for production OAuth.
          </p>
        ) : (
          <MetaAdsConnectionPanel
            connected={store.metaConnected}
            metaOAuthConfigured={store.metaOAuthConfigured}
            accounts={store.metaAdsAccounts}
            campaignTotals={store.metaCampaignTotals}
          />
        )}
      </div>

      {store.isDemo && (
        <div className="card">
          <h3>Connect Shopify</h3>
          {store.oauthConfigured ? (
            <ConnectShopifyForm />
          ) : (
            <EmptyState
              title="Shopify OAuth not configured"
              description="Set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and SHOPIFY_APP_URL in your environment to enable store connections."
            />
          )}
        </div>
      )}
    </>
  );
}
