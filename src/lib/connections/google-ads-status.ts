import type { GoogleAdsInstallation } from "@/lib/db/google-ads";
import type { DataSourceStatus } from "@/lib/types";
import type { IntegrationConnectionStatus } from "./integration-board.types";
import { resolveGoogleAdsConnectionPresentationV2 } from "./connection-state";

export type GoogleAdsConnectionPresentation = {
  status: IntegrationConnectionStatus;
  statusLabel: string;
  syncFailed: boolean;
  syncPending: boolean;
  errorMessage: string | null;
  primaryAction: "connect" | "reconnect" | "manage" | "none";
};

/**
 * OAuth success ≠ sync success. Only surface sync failure when there is a
 * concrete error message. Empty campaigns / $0 spend is not a failure.
 */
export function resolveGoogleAdsConnectionPresentation(input: {
  connected: boolean;
  oauthConfigured: boolean;
  installations: Pick<
    GoogleAdsInstallation,
    "connection_health" | "error_message" | "last_sync_at" | "status"
  >[];
  connectorSource?: DataSourceStatus;
}): GoogleAdsConnectionPresentation {
  const pres = resolveGoogleAdsConnectionPresentationV2(input);
  return {
    status: pres.state,
    statusLabel:
      pres.state === "connected_warning" && pres.attentionMessage?.includes("first")
        ? "Connected — sync pending"
        : pres.state === "connected_warning"
          ? "Connected — sync issue"
          : pres.statusLabel,
    syncFailed: pres.state === "sync_failed",
    syncPending:
      pres.state === "connected_warning" &&
      (pres.attentionMessage?.includes("first") ?? false),
    errorMessage: pres.errorReason,
    primaryAction: pres.primaryAction,
  };
}

export function resolveGoogleAdsHealthSyncFailed(input: {
  installations: Pick<
    GoogleAdsInstallation,
    "connection_health" | "error_message" | "last_sync_at" | "status"
  >[];
  connectorSource?: DataSourceStatus;
}): boolean {
  return resolveGoogleAdsConnectionPresentation({
    connected: input.installations.length > 0,
    oauthConfigured: true,
    installations: input.installations,
    connectorSource: input.connectorSource,
  }).syncFailed;
}
