"use client";

import { useRouter } from "next/navigation";
import type { MetaAdsAccountView } from "@/lib/services/connected-store";
import type { MetaCampaignSyncStats } from "@/lib/meta/campaign-stats";
import { ConnectMetaAdsButton } from "@/components/ConnectMetaAdsButton";
import { EmptyState } from "@/components/ui/EmptyState";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function CampaignMetrics({ campaigns }: { campaigns: MetaCampaignSyncStats }) {
  return (
    <div className="metrics-row" style={{ marginTop: 8 }}>
      <div className="metric-pill">
        <span>Active</span>
        <span>{campaigns.activeCount}</span>
      </div>
      <div className="metric-pill">
        <span>Draft</span>
        <span>{campaigns.draftCount}</span>
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

export function MetaAdsConnectionPanel({
  connected,
  metaOAuthConfigured,
  accounts,
  campaignTotals,
}: {
  connected: boolean;
  metaOAuthConfigured: boolean;
  accounts: MetaAdsAccountView[];
  campaignTotals: MetaCampaignSyncStats;
}) {
  const router = useRouter();

  async function handleDisconnect(installationId: string) {
    if (!confirm("Disconnect this Meta Ad Account? Campaign data and recommendations will stop.")) {
      return;
    }
    await fetch(`/api/meta/accounts?id=${installationId}`, { method: "DELETE" });
    router.refresh();
  }

  if (!metaOAuthConfigured) {
    return (
      <EmptyState
        title="Meta Ads isn't configured yet"
        reason="This environment is missing Meta OAuth credentials."
        nextStep="After Meta is configured, StorePilot will import campaigns and surface advertising recommendations."
        description="Set META_APP_ID, META_APP_SECRET, META_APP_URL, and META_TOKEN_ENCRYPTION_KEY in your environment."
      />
    );
  }

  if (!connected) {
    return (
      <div className="card">
        <EmptyState
          title="Connect Meta Ads to unlock advertising recommendations"
          reason="We're not analyzing Facebook/Instagram campaigns yet because Meta isn't connected."
          nextStep="After you connect, StorePilot will review spend, ROAS, and campaign health for executive decisions."
        />
        <div style={{ marginTop: 12 }}>
          <ConnectMetaAdsButton />
        </div>
      </div>
    );
  }

  const businessNames = [...new Set(accounts.map((a) => a.businessName).filter(Boolean))] as string[];
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
        <span>Business</span>
        <strong>{businessNames.join(", ") || "—"}</strong>
      </div>

      <div className="breakdown-row">
        <span>Ad accounts</span>
        <strong>{accounts.length}</strong>
      </div>

      <div className="breakdown-row">
        <span>Last sync</span>
        <strong>{formatDate(latestSync ?? null)}</strong>
      </div>

      <CampaignMetrics campaigns={campaignTotals} />

      {campaignTotals.activeCount === 0 ? (
        <p className="muted" style={{ margin: "8px 0 0" }}>
          No active Meta campaigns found.
        </p>
      ) : null}

      <div style={{ marginTop: 8 }}>
        <p className="muted" style={{ margin: "0 0 8px" }}>
          Connected ad accounts
        </p>
        <div className="stack">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="breakdown-row"
              style={{ alignItems: "flex-start", gap: 12 }}
            >
              <div style={{ flex: 1 }}>
                <strong>{account.adAccountName ?? account.adAccountId}</strong>
                <p className="muted" style={{ margin: "4px 0 8px", fontSize: "0.9rem" }}>
                  {account.businessName ?? "Meta Business"} · last sync {formatDate(account.lastSyncAt)}
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

      <div style={{ marginTop: 8 }}>
        <p className="muted" style={{ margin: "0 0 8px" }}>
          Connect additional ad accounts from another Business Manager.
        </p>
        <ConnectMetaAdsButton compact />
      </div>
    </div>
  );
}
