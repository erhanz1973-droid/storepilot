import type { IntegrationHealthCard } from "@/lib/integrations/health";
import type { SyncMonitoringRow } from "./types";

const CRON_ADS_INTERVAL = "Every 4 hours (Railway Cron)";

export function buildSyncMonitoring(cards: IntegrationHealthCard[]): SyncMonitoringRow[] {
  return cards
    .filter((c) => ["shopify", "meta_ads", "google_ads", "ga4"].includes(c.id))
    .map((card) => ({
      provider: card.label,
      lastSync: card.lastSyncAt,
      nextScheduledSync:
        card.status === "connected" &&
        (card.id === "ga4" || card.id === "meta_ads" || card.id === "google_ads")
          ? CRON_ADS_INTERVAL
          : card.syncEndpoint
            ? "Manual / on connect"
            : null,
      avgDurationMs: null,
      failedSyncCount: card.syncFailed ? 1 : 0,
      queueStatus: card.syncFailed ? "Attention" : card.status === "connected" ? "Idle" : "—",
      progressLabel: card.syncFailed ? "Last sync failed" : null,
    }));
}
