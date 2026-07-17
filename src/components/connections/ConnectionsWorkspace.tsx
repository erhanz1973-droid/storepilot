"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConnectShopifyForm } from "@/components/ConnectShopifyForm";
import { ConnectGoogleAdsButton } from "@/components/ConnectGoogleAdsButton";
import { ConnectGa4Button } from "@/components/ConnectGa4Button";
import { Ga4FunnelOnboardingPanel } from "@/components/connections/Ga4FunnelOnboardingPanel";
import { ConnectMetaAdsButton } from "@/components/ConnectMetaAdsButton";
import { MetaValidationPanel } from "@/components/connections/MetaValidationPanel";
import { SyncFeedbackBanner } from "@/components/connections/SyncFeedbackBanner";
import type {
  IntegrationBoardItem,
  IntegrationBoardPayload,
  IntegrationConnectionStatus,
} from "@/lib/connections/integration-board.types";
import {
  CONNECTIONS_CATEGORY_LABELS,
  CONNECTIONS_CATEGORY_ORDER,
} from "@/lib/connections/integration-board.types";
import type { ConnectionHealthBreakdown } from "@/lib/connections/connection-state";
import type { ConnectionCategory } from "@/lib/connections/catalog";
import { presentationShowsAsConnected } from "@/lib/connections/connection-state";
import { runIntegrationSync, type SyncFeedback } from "@/lib/connections/sync-feedback";
import { redirectTop } from "@/lib/shopify/embedded-navigation";
import { TopLevelOAuthLink } from "@/components/connections/TopLevelOAuthLink";

const STATUS_DOT: Record<IntegrationConnectionStatus, string> = {
  connected: "var(--low)",
  connected_warning: "#d4a017",
  sync_failed: "var(--critical)",
  authorization_required: "#d4a017",
  not_connected: "var(--muted)",
  coming_soon: "var(--muted)",
};

const STATUS_EMOJI: Record<IntegrationConnectionStatus, string> = {
  connected: "🟢",
  connected_warning: "🟡",
  sync_failed: "🔴",
  authorization_required: "⚪",
  not_connected: "⚪",
  coming_soon: "⚪",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleString();
}

function healthIcon(status: "pass" | "fail" | "warn" | "na") {
  if (status === "pass") return "✅";
  if (status === "fail") return "❌";
  if (status === "warn") return "⚠";
  return "—";
}

function ConnectionHealthPanel({ health }: { health: ConnectionHealthBreakdown }) {
  const rows = [
    health.authentication,
    health.permissions,
    health.accountOrProperty,
    health.dataSync,
  ];
  return (
    <div className="conn-health-panel">
      <div className="conn-health-head">
        <span className="muted">Connection Health</span>
        <strong className={`conn-health-overall conn-health-${health.overallHealth}`}>
          {health.overallLabel === "Healthy" ? "✓ " : health.overallHealth === "needs_attention" ? "⚠ " : ""}
          {health.overallLabel}
        </strong>
      </div>
      <div className="conn-health-grid">
        {rows.map((row) => (
          <div key={row.label} className="conn-health-row">
            <span>{row.label}</span>
            <span>
              {healthIcon(row.status)} {row.detail ?? (row.status === "pass" ? "OK" : row.status === "fail" ? "Failed" : row.status === "warn" ? "Warning" : "—")}
            </span>
          </div>
        ))}
        <div className="conn-health-row">
          <span>Last Successful Sync</span>
          <strong>{formatDate(health.lastSuccessfulSync)}</strong>
        </div>
      </div>
    </div>
  );
}

function ConnectionStatusBanner({ item }: { item: IntegrationBoardItem }) {
  if (item.status === "connected" && !item.attentionMessage) return null;

  const tone =
    item.status === "sync_failed"
      ? "error"
      : item.status === "connected_warning"
        ? "warning"
        : item.status === "authorization_required" || item.status === "not_connected"
          ? "neutral"
          : null;

  if (!tone) return null;

  return (
    <div className={`conn-status-banner conn-status-banner-${tone}`}>
      <strong>
        {STATUS_EMOJI[item.status]} {item.statusLabel}
        {item.status === "connected_warning" && item.attentionMessage ? ` — ${item.attentionMessage}` : ""}
      </strong>
      {(item.guidanceMessage || item.errorReason) && (
        <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem", lineHeight: 1.45 }}>
          {item.errorReason ?? item.guidanceMessage}
        </p>
      )}
    </div>
  );
}

function formatCurrency(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function IntegrationCard({
  item,
  selected,
  onSelect,
}: {
  item: IntegrationBoardItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="card integration-card"
      onClick={onSelect}
      style={{
        textAlign: "left",
        width: "100%",
        cursor: "pointer",
        borderColor: selected ? "var(--accent)" : undefined,
        boxShadow: selected ? "0 0 0 1px var(--accent)" : undefined,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: item.logoAccent,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: item.logoInitial.length > 2 ? "0.65rem" : "1rem",
            flexShrink: 0,
          }}
        >
          {item.logoInitial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <strong>{item.label}</strong>
            <span style={{ fontSize: "0.75rem", color: STATUS_DOT[item.status], whiteSpace: "nowrap" }}>
              {STATUS_EMOJI[item.status]} {item.statusLabel}
            </span>
          </div>
          {item.summaryLines.map((line) => (
            <p key={line} className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
              {line}
            </p>
          ))}
          {item.attentionMessage && item.status !== "connected_warning" && (
            <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "var(--critical)" }}>
              {item.attentionMessage.slice(0, 120)}
            </p>
          )}
          {item.primaryAction !== "none" && (
            <span className="muted" style={{ fontSize: "0.8rem", marginTop: 8, display: "inline-block" }}>
              {item.primaryAction === "manage" ? "Manage →" : item.primaryAction === "reconnect" ? "Reconnect →" : "Connect →"}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function DetailActions({
  syncEndpoint,
  onSync,
  syncing,
  showReconnect,
  onReconnect,
  showViewError,
  onViewError,
  showDisconnect,
  onDisconnect,
  canSync = true,
}: {
  syncEndpoint?: string;
  onSync?: () => void;
  syncing?: boolean;
  showReconnect?: boolean;
  onReconnect?: () => void;
  showViewError?: boolean;
  onViewError?: () => void;
  showDisconnect?: boolean;
  onDisconnect?: () => void;
  canSync?: boolean;
}) {
  return (
    <div className="actions-row" style={{ marginTop: 16 }}>
      {syncEndpoint && onSync && canSync && (
        <button type="button" className="btn btn-secondary" onClick={onSync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      )}
      {showReconnect && onReconnect && (
        <button type="button" className="btn btn-secondary" onClick={onReconnect}>
          Reconnect
        </button>
      )}
      {showViewError && onViewError && (
        <button type="button" className="btn btn-ghost" onClick={onViewError}>
          View details
        </button>
      )}
      {showDisconnect && onDisconnect && (
        <button type="button" className="btn btn-ghost" onClick={onDisconnect}>
          Disconnect
        </button>
      )}
    </div>
  );
}

function IntegrationDetailPanel({
  item,
  shopDomain,
}: {
  item: IntegrationBoardItem;
  shopDomain: string | null;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<SyncFeedback | null>(null);

  async function handleSync() {
    console.log("[sync-trace] ConnectionsWorkspace handleSync click", {
      integrationId: item.id,
      syncEndpoint: item.syncEndpoint,
      syncing,
    });
    if (!item.syncEndpoint) {
      console.log("[sync-trace] ConnectionsWorkspace handleSync blocked — no syncEndpoint");
      return;
    }
    setSyncing(true);
    setSyncFeedback(null);
    try {
      console.log("[sync-trace] ConnectionsWorkspace runIntegrationSync →", item.syncEndpoint);
      const feedback = await runIntegrationSync(item.syncEndpoint, item.id);
      console.log("[sync-trace] ConnectionsWorkspace runIntegrationSync result", feedback);
      setSyncFeedback(feedback);
      if (feedback.kind === "success") {
        router.refresh();
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnectGoogle(id: string) {
    if (!confirm("Disconnect this Google Ads account?")) return;
    await fetch(`/api/google/accounts?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleDisconnectGa4(id: string) {
    if (!confirm("Disconnect GA4? Behavioral analytics will stop syncing.")) return;
    await fetch(`/api/ga4/accounts?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleDisconnectMeta(id: string) {
    if (!confirm("Disconnect this Meta ad account?")) return;
    await fetch(`/api/meta/accounts?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (item.detail.type === "shopify") {
    const d = item.detail;
    if (!d.connected && d.shopifyOAuthConfigured) {
      return (
        <div className="card">
          <h3>Shopify</h3>
          <p className="muted" style={{ marginTop: 4, marginBottom: 16 }}>
            Connect your storefront to sync products, orders, and inventory.
          </p>
          <ConnectShopifyForm />
        </div>
      );
    }

    return (
      <div className="card">
        <h3>Shopify</h3>
        <ConnectionStatusBanner item={item} />
        <ConnectionHealthPanel health={item.health} />
        {d.missingWriteScopes.length > 0 && !d.isDemo && (
          <div className="shopify-scope-alert" style={{ marginTop: 12 }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.9rem", lineHeight: 1.45 }}>
              Missing permissions: <strong>{d.missingWriteScopes.join(", ")}</strong>. Reconnect
              Shopify to enable automatic discounts and product updates from StorePilot.
            </p>
            {d.storeDomain && (
              <a
                href={`/api/shopify/auth?shop=${encodeURIComponent(d.storeDomain)}`}
                className="btn btn-primary"
              >
                Reconnect Shopify
              </a>
            )}
          </div>
        )}
        <div className="stack" style={{ marginTop: 16 }}>
          <div className="breakdown-row">
            <span>Store</span>
            <strong>{d.storeDomain ?? shopDomain ?? (d.isDemo ? "Demo store" : "—")}</strong>
          </div>
          <div className="breakdown-row">
            <span>Products</span>
            <strong>{d.products}</strong>
          </div>
          <div className="breakdown-row">
            <span>Orders (30 days)</span>
            <strong>{d.orders30d}</strong>
          </div>
          <div className="breakdown-row">
            <span>Revenue (30 days)</span>
            <strong>{formatCurrency(d.revenue30d)}</strong>
          </div>
          <div className="breakdown-row">
            <span>Last successful sync</span>
            <strong>{formatDate(d.lastSyncAt)}</strong>
          </div>
        </div>
        {syncFeedback && (
          <SyncFeedbackBanner
            kind={syncFeedback.kind}
            message={syncFeedback.message}
            detail={syncFeedback.detail}
            onDismiss={() => setSyncFeedback(null)}
          />
        )}
        <DetailActions
          syncEndpoint={item.syncEndpoint}
          onSync={handleSync}
          syncing={syncing}
          canSync={item.canSync}
          showReconnect={d.connected && !d.isDemo}
          onReconnect={() => {
            if (d.storeDomain) {
              redirectTop(`/api/shopify/auth?shop=${encodeURIComponent(d.storeDomain)}`);
            }
          }}
        />
        {d.storeDomain && d.connected && (
          <div className="actions-row" style={{ marginTop: 8 }}>
            <a
              href={`https://${d.storeDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              View store
            </a>
          </div>
        )}
      </div>
    );
  }

  if (item.detail.type === "meta_ads") {
    const d = item.detail;
    if (!presentationShowsAsConnected(item.status)) {
      return (
        <div className="card">
          <h3>Meta Ads</h3>
          <p className="muted" style={{ marginTop: 4, marginBottom: 16 }}>
            After connecting Meta Ads, campaign spend will automatically be included in Blended ROAS,
            Attribution, and AI recommendations.
          </p>
          {d.metaOAuthConfigured ? <ConnectMetaAdsButton /> : (
            <p className="muted">Meta OAuth is not configured for this environment.</p>
          )}
        </div>
      );
    }

    return (
      <div className="card">
        <h3>Meta Ads</h3>
        <ConnectionStatusBanner item={item} />
        <ConnectionHealthPanel health={item.health} />
        <div className="stack" style={{ marginTop: 16 }}>
          <div className="breakdown-row">
            <span>Business</span>
            <strong>{d.businessName ?? "—"}</strong>
          </div>
          <div className="breakdown-row">
            <span>Selected ad account</span>
            <strong>{d.accounts[0]?.adAccountName ?? d.accounts[0]?.adAccountId ?? "—"}</strong>
          </div>
          <div className="breakdown-row">
            <span>Last successful sync</span>
            <strong>{formatDate(d.lastSyncAt)}</strong>
          </div>
          <div className="breakdown-row">
            <span>Campaigns</span>
            <strong>{d.activeCampaigns} active · {d.pausedCampaigns} paused</strong>
          </div>
          <div className="breakdown-row">
            <span>Spend (7 days)</span>
            <strong>{formatCurrency(d.spend7d)}</strong>
          </div>
        </div>
        {syncFeedback && (
          <SyncFeedbackBanner
            kind={syncFeedback.kind}
            message={syncFeedback.message}
            detail={syncFeedback.detail}
            onDismiss={() => setSyncFeedback(null)}
          />
        )}
        <DetailActions
          syncEndpoint={item.syncEndpoint}
          onSync={handleSync}
          syncing={syncing}
          canSync={item.canSync}
          showReconnect
          onReconnect={() => {
            redirectTop("/api/meta/auth");
          }}
        />
        {d.accounts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
              Aktif bağlantı (insights yalnızca bu hesap için)
            </p>
            {d.accounts.map((account) => (
              <div key={account.id} className="breakdown-row" style={{ alignItems: "center", marginBottom: 8 }}>
                <span>{account.adAccountName ?? account.adAccountId}</span>
                <button type="button" className="btn btn-ghost" onClick={() => handleDisconnectMeta(account.id)}>
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <TopLevelOAuthLink
            href="/api/meta/auth"
            className="btn btn-ghost"
            style={{ alignSelf: "flex-start" }}
          >
            Farklı ad account seç
          </TopLevelOAuthLink>
        </div>
        <MetaValidationPanel />
      </div>
    );
  }

  if (item.detail.type === "google_ads") {
    const d = item.detail;
    if (!presentationShowsAsConnected(item.status)) {
      return (
        <div className="card">
          <h3>Google Ads</h3>
          <p className="muted" style={{ marginTop: 4, marginBottom: 16 }}>
            After connecting Google Ads, advertising spend will automatically be included in Blended
            ROAS, Attribution, and AI recommendations.
          </p>
          {d.googleOAuthConfigured ? <ConnectGoogleAdsButton /> : (
            <p className="muted">Google Ads OAuth is not configured for this environment.</p>
          )}
        </div>
      );
    }

    return (
      <div className="card">
        <h3>Google Ads</h3>
        <ConnectionStatusBanner item={item} />
        <ConnectionHealthPanel health={item.health} />
        {d.syncPending && !d.attentionMessage && item.status === "connected_warning" && (
          <p className="muted" style={{ marginTop: 8, marginBottom: 0, fontSize: "0.9rem" }}>
            Account connected. Run <strong>Sync Now</strong> below to pull campaign data. Zero
            campaigns or spend is normal for new accounts.
          </p>
        )}
        {d.attentionMessage && item.status === "sync_failed" && (
          <div className="conn-status-banner conn-status-banner-error" style={{ marginTop: 12 }}>
            <strong>Sync Failed</strong>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
              {d.attentionMessage}
            </p>
          </div>
        )}
        <div className="stack" style={{ marginTop: 16 }}>
          <div className="breakdown-row">
            <span>Connected accounts</span>
            <strong>{d.accountCount}</strong>
          </div>
          <div className="breakdown-row">
            <span>Last successful sync</span>
            <strong>{formatDate(d.lastSyncAt)}</strong>
          </div>
          <div className="breakdown-row">
            <span>Campaigns</span>
            <strong>{d.enabledCampaigns} enabled · {d.pausedCampaigns} paused</strong>
          </div>
          <div className="breakdown-row">
            <span>Spend (today)</span>
            <strong>{formatCurrency(d.spendToday)}</strong>
          </div>
        </div>
        {syncFeedback && (
          <SyncFeedbackBanner
            kind={syncFeedback.kind}
            message={syncFeedback.message}
            detail={syncFeedback.detail}
            onDismiss={() => setSyncFeedback(null)}
          />
        )}
        <DetailActions
          syncEndpoint={item.syncEndpoint}
          onSync={handleSync}
          syncing={syncing}
          canSync={item.canSync}
          showReconnect
          onReconnect={() => {
            redirectTop("/api/google/auth");
          }}
        />
        {d.accounts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>Connected accounts</p>
            {d.accounts.map((account) => (
              <div key={account.id} className="breakdown-row" style={{ alignItems: "center", marginBottom: 8 }}>
                <span>{account.customerName ?? account.customerId}</span>
                <button type="button" className="btn btn-ghost" onClick={() => handleDisconnectGoogle(account.id)}>
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <ConnectGoogleAdsButton compact />
        </div>
      </div>
    );
  }

  if (item.detail.type === "ga4") {
    const d = item.detail;
    if (!presentationShowsAsConnected(item.status) && item.status !== "authorization_required") {
      return (
        <div className="card">
          <h3>Google Analytics 4</h3>
          <ConnectionStatusBanner item={item} />
          <p className="muted" style={{ marginTop: 4, marginBottom: 16 }}>
            {item.guidanceMessage ??
              "Connect GA4 for sessions, landing pages, funnel event tracking, and behavioral analytics."}
          </p>
          <Ga4FunnelOnboardingPanel steps={d.funnelOnboardingSteps} />
          <ul className="conn-benefits-list muted" style={{ fontSize: "0.9rem", margin: "16px 0" }}>
            <li>Sessions</li>
            <li>Conversion Rate</li>
            <li>User Behavior</li>
            <li>Customer Journey</li>
          </ul>
          {d.ga4OAuthConfigured ? <ConnectGa4Button /> : (
            <p className="muted">GA4 OAuth is not configured for this environment.</p>
          )}
        </div>
      );
    }

    if (item.status === "authorization_required") {
      return (
        <div className="card">
          <h3>Google Analytics 4</h3>
          <ConnectionStatusBanner item={item} />
          <ConnectionHealthPanel health={item.health} />
          <Ga4FunnelOnboardingPanel steps={d.funnelOnboardingSteps} compact />
          <p className="muted" style={{ marginTop: 12 }}>
            {item.guidanceMessage}
          </p>
          {d.ga4OAuthConfigured ? <ConnectGa4Button /> : (
            <p className="muted">GA4 OAuth is not configured for this environment.</p>
          )}
        </div>
      );
    }

    return (
      <div className="card">
        <h3>Google Analytics 4</h3>
        <ConnectionStatusBanner item={item} />
        <ConnectionHealthPanel health={item.health} />
        {!d.funnelEventsVerified && (
          <div style={{ marginTop: 16 }}>
            <Ga4FunnelOnboardingPanel steps={d.funnelOnboardingSteps} compact />
          </div>
        )}
        <div className="stack" style={{ marginTop: 16 }}>
          <div className="breakdown-row">
            <span>Property</span>
            <strong>{d.propertyName ?? d.propertyId ?? "—"}</strong>
          </div>
          {d.measurementId && (
            <div className="breakdown-row">
              <span>Measurement ID</span>
              <strong>{d.measurementId}</strong>
            </div>
          )}
          <div className="breakdown-row">
            <span>Status</span>
            <strong>{item.health.overallLabel}</strong>
          </div>
          <div className="breakdown-row">
            <span>Last successful sync</span>
            <strong>{formatDate(d.lastSuccessfulSyncAt ?? d.lastSyncAt)}</strong>
          </div>
          {d.sessions30d != null && (
            <div className="breakdown-row">
              <span>Sessions (30 days)</span>
              <div>
                <strong>{d.sessions30d.toLocaleString()}</strong>
                {d.cachedDataNote && (
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
                    ({d.cachedDataNote})
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="breakdown-row">
            <span>Engagement rate</span>
            <strong>
              {d.engagementRatePct != null ? `${d.engagementRatePct.toFixed(1)}%` : "—"}
            </strong>
          </div>
          <div className="breakdown-row">
            <span>Ecommerce CVR</span>
            <strong>
              {d.ecommerceConversionRatePct != null
                ? `${d.ecommerceConversionRatePct.toFixed(2)}%`
                : "—"}
            </strong>
          </div>
        </div>
        {syncFeedback && (
          <SyncFeedbackBanner
            kind={syncFeedback.kind}
            message={syncFeedback.message}
            detail={syncFeedback.detail}
            onDismiss={() => setSyncFeedback(null)}
          />
        )}
        <DetailActions
          syncEndpoint={item.syncEndpoint}
          onSync={handleSync}
          syncing={syncing}
          canSync={item.canSync}
          showReconnect
          onReconnect={() => {
            redirectTop("/api/ga4/auth");
          }}
        />
        {d.installationId && (
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => handleDisconnectGa4(d.installationId!)}
            >
              Disconnect
            </button>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <ConnectGa4Button compact />
        </div>
      </div>
    );
  }

  const d = item.detail;
  return (
    <div className="card">
      <h3>{item.label}</h3>
      <p className="muted" style={{ marginTop: 8 }}>{d.description}</p>
      {item.planned ? (
        <p className="muted" style={{ marginTop: 16, fontSize: "0.9rem" }}>
          This integration is on the roadmap. You will be able to connect it here when it launches.
        </p>
      ) : d.connected ? (
        <>
          {d.preview && (
            <div className="breakdown-row" style={{ marginTop: 16 }}>
              <span>Preview</span>
              <strong>{d.preview}</strong>
            </div>
          )}
          {syncFeedback && (
            <SyncFeedbackBanner
              kind={syncFeedback.kind}
              message={syncFeedback.message}
              detail={syncFeedback.detail}
              onDismiss={() => setSyncFeedback(null)}
            />
          )}
          <DetailActions syncEndpoint={item.syncEndpoint} onSync={handleSync} syncing={syncing} />
        </>
      ) : (
        <p className="muted" style={{ marginTop: 16, fontSize: "0.9rem" }}>
          {d.configured
            ? "Authorization is available — connect to start syncing data."
            : "Not connected yet."}
        </p>
      )}
    </div>
  );
}

export function ConnectionsWorkspace({ payload }: { payload: IntegrationBoardPayload }) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as ConnectionCategory | null;
  const initialTab =
    tabParam && CONNECTIONS_CATEGORY_ORDER.includes(tabParam)
      ? tabParam
      : CONNECTIONS_CATEGORY_ORDER[0];

  const tabItemsForInit = payload.items.filter((item) => item.category === initialTab);
  const initialSelectedId =
    tabItemsForInit.find((i) => i.status === "connected")?.id ??
    tabItemsForInit.find((i) => i.id === "shopify")?.id ??
    tabItemsForInit[0]?.id;

  const [activeTab, setActiveTab] = useState<ConnectionCategory>(initialTab);
  const [selectedId, setSelectedId] = useState(initialSelectedId);

  useEffect(() => {
    if (tabParam && CONNECTIONS_CATEGORY_ORDER.includes(tabParam)) {
      setActiveTab(tabParam);
      const first = payload.items.find((i) => i.category === tabParam);
      if (first) setSelectedId(first.id);
    }
  }, [tabParam, payload.items]);

  const tabItems = useMemo(
    () => payload.items.filter((item) => item.category === activeTab),
    [payload.items, activeTab],
  );

  const selected = tabItems.find((i) => i.id === selectedId) ?? tabItems[0];

  return (
    <div className="connections-workspace">
      <div className="connections-tabs" role="tablist">
        {CONNECTIONS_CATEGORY_ORDER.map((category) => {
          const count = payload.items.filter((i) => i.category === category).length;
          if (!count) return null;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={activeTab === category}
              className={`connections-tab ${activeTab === category ? "active" : ""}`}
              onClick={() => {
                setActiveTab(category);
                const first = payload.items.find((i) => i.category === category);
                if (first) setSelectedId(first.id);
              }}
            >
              {CONNECTIONS_CATEGORY_LABELS[category]}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
          marginTop: 16,
          marginBottom: 20,
        }}
      >
        {tabItems.map((item) => (
          <IntegrationCard
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            onSelect={() => setSelectedId(item.id)}
          />
        ))}
      </div>

      {selected && (
        <IntegrationDetailPanel item={selected} shopDomain={payload.view.commerceDomain} />
      )}
    </div>
  );
}
