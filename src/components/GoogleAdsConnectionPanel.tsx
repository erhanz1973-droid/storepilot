"use client";

import { useRouter } from "next/navigation";
import type { GoogleAdsAccountView } from "@/lib/services/connections";
import type { GoogleCampaignSyncStats } from "@/lib/google-ads/campaign-stats";
import { ConnectGoogleAdsButton } from "@/components/ConnectGoogleAdsButton";
import { EmptyState } from "@/components/ui/EmptyState";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function CampaignMetrics({ campaigns }: { campaigns: GoogleCampaignSyncStats }) {
  return (
    <div className="metrics-row" style={{ marginTop: 8 }}>
      <div className="metric-pill">
        <span>Enabled</span>
        <span>{campaigns.enabledCount}</span>
      </div>
      <div className="metric-pill">
        <span>Paused</span>
        <span>{campaigns.pausedCount}</span>
      </div>
      <div className="metric-pill">
        <span>Total</span>
        <span>{campaigns.totalCount}</span>
      </div>
    </div>
  );
}

export function GoogleAdsConnectionPanel({
  connected,
  googleOAuthConfigured,
  accounts,
  campaignTotals,
}: {
  connected: boolean;
  googleOAuthConfigured: boolean;
  accounts: GoogleAdsAccountView[];
  campaignTotals: GoogleCampaignSyncStats;
}) {
  const router = useRouter();

  async function handleDisconnect(installationId: string) {
    if (!confirm("Disconnect this Google Ads account? Spend data will stop syncing.")) return;
    await fetch(`/api/google/accounts?id=${installationId}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleSync() {
    await fetch("/api/google/sync", { method: "POST" });
    router.refresh();
  }

  if (!googleOAuthConfigured) {
    return (
      <EmptyState
        title="Google Ads OAuth not configured"
        description="Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN, and GOOGLE_ADS_APP_URL."
      />
    );
  }

  if (!connected) {
    return <ConnectGoogleAdsButton />;
  }

  const latestSync = accounts
    .map((a) => a.lastSyncAt)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <div className="stack">
      <div className="breakdown-row">
        <span>Status</span>
        <strong style={{ color: "var(--low)" }}>Connected</strong>
      </div>

      <div className="breakdown-row">
        <span>Customer accounts</span>
        <strong>{accounts.length}</strong>
      </div>

      <div className="breakdown-row">
        <span>Last sync</span>
        <strong>{formatDate(latestSync ?? null)}</strong>
      </div>

      <CampaignMetrics campaigns={campaignTotals} />

      <div className="actions-row">
        <button type="button" className="btn btn-secondary" onClick={handleSync}>
          Sync now
        </button>
        <ConnectGoogleAdsButton compact />
      </div>

      <div style={{ marginTop: 8 }}>
        <p className="muted" style={{ margin: "0 0 8px" }}>
          Connected accounts
        </p>
        <div className="stack">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="breakdown-row"
              style={{ alignItems: "flex-start", gap: 12 }}
            >
              <div style={{ flex: 1 }}>
                <strong>{account.customerName ?? account.customerId}</strong>
                <p className="muted" style={{ margin: "4px 0 8px", fontSize: "0.9rem" }}>
                  {account.customerId} · last sync {formatDate(account.lastSyncAt)}
                </p>
                <CampaignMetrics campaigns={account.campaigns} />
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => handleDisconnect(account.id)}
              >
                Disconnect
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
