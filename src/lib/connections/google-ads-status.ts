import type { GoogleAdsInstallation } from "@/lib/db/google-ads";
import type { DataSourceStatus } from "@/lib/types";
import type { IntegrationConnectionStatus } from "./integration-board.types";

export type GoogleAdsConnectionPresentation = {
  status: IntegrationConnectionStatus;
  statusLabel: string;
  syncFailed: boolean;
  syncPending: boolean;
  errorMessage: string | null;
  primaryAction: "connect" | "reconnect" | "manage" | "none";
};

/**
 * OAuth success ≠ sync success. Only surface "Needs attention" when there is a
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
  const { connected, oauthConfigured, installations, connectorSource } = input;

  if (!connected) {
    if (oauthConfigured) {
      return {
        status: "authorization_required",
        statusLabel: "Authorization required",
        syncFailed: false,
        syncPending: false,
        errorMessage: null,
        primaryAction: "connect",
      };
    }
    return {
      status: "not_connected",
      statusLabel: "Not connected",
      syncFailed: false,
      syncPending: false,
      errorMessage: null,
      primaryAction: "connect",
    };
  }

  const installError = installations.find(
    (i) => i.connection_health === "error" && i.error_message?.trim(),
  );
  const connectorError =
    connectorSource?.status === "error" && connectorSource.errorMessage?.trim()
      ? connectorSource.errorMessage.trim()
      : null;
  const errorMessage = installError?.error_message?.trim() ?? connectorError ?? null;

  if (errorMessage) {
    return {
      status: "error",
      statusLabel: "Needs attention",
      syncFailed: true,
      syncPending: false,
      errorMessage,
      primaryAction: "reconnect",
    };
  }

  const hasSynced =
    installations.some((i) => i.last_sync_at) || Boolean(connectorSource?.lastSyncAt);
  const syncDegraded = installations.some((i) => i.connection_health === "degraded");

  if (!hasSynced) {
    return {
      status: "connected",
      statusLabel: syncDegraded ? "Connected — sync pending" : "Connected — sync pending",
      syncFailed: false,
      syncPending: true,
      errorMessage: null,
      primaryAction: "manage",
    };
  }

  if (syncDegraded) {
    return {
      status: "connected",
      statusLabel: "Connected — sync issue",
      syncFailed: false,
      syncPending: false,
      errorMessage: installations.find((i) => i.connection_health === "degraded")?.error_message?.trim() ?? null,
      primaryAction: "manage",
    };
  }

  return {
    status: "connected",
    statusLabel: "Connected",
    syncFailed: false,
    syncPending: false,
    errorMessage: null,
    primaryAction: "manage",
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
