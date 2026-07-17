import type { Ga4Installation } from "@/lib/db/ga4";
import type { GoogleAdsInstallation } from "@/lib/db/google-ads";
import type { GA4Snapshot } from "@/lib/integrations/types";
import {
  classifyOAuthFailure,
  parseStoredFailureCode,
} from "@/lib/integrations/oauth-failure";
import type { DataSourceStatus } from "@/lib/types";

export type UnifiedConnectionState =
  | "connected"
  | "connected_warning"
  | "sync_failed"
  | "authorization_required"
  | "not_connected"
  | "coming_soon";

export type HealthCheckStatus = "pass" | "fail" | "warn" | "na";

export type HealthCheckRow = {
  label: string;
  status: HealthCheckStatus;
  detail?: string;
};

export type ConnectionHealthBreakdown = {
  authentication: HealthCheckRow;
  permissions: HealthCheckRow;
  accountOrProperty: HealthCheckRow;
  dataSync: HealthCheckRow;
  lastSuccessfulSync: string | null;
  overallHealth: "healthy" | "needs_attention" | "failed" | "not_connected";
  overallLabel: string;
};

export type ConnectionPresentation = {
  state: UnifiedConnectionState;
  statusLabel: string;
  primaryAction: "connect" | "reconnect" | "manage" | "none";
  attentionMessage: string | null;
  guidanceMessage: string | null;
  errorReason: string | null;
  health: ConnectionHealthBreakdown;
  showCachedMetrics: boolean;
  cachedDataNote: string | null;
  canSync: boolean;
};

type InstallHealth = Pick<
  { connection_health: string; error_message: string | null; last_sync_at: string | null; status: string },
  "connection_health" | "error_message" | "last_sync_at" | "status"
>;

export function humanizeSyncError(raw: string | null | undefined, provider: string): string | null {
  if (!raw?.trim()) return null;
  const msg = raw.trim();

  // Prefer already-classified messages (CODE: text).
  if (/^OAUTH_[A-Z_]+:/.test(msg)) {
    return msg.replace(/^OAUTH_[A-Z_]+:\s*/, "");
  }

  const failure = classifyOAuthFailure(provider, msg);
  return failure.message;
}

/** True when stored error means the merchant must reconnect (not just retry). */
export function errorRequiresReconnect(errorMessage: string | null | undefined): boolean {
  const code = parseStoredFailureCode(errorMessage);
  if (
    code === "OAUTH_EXPIRED_TOKEN" ||
    code === "OAUTH_INVALID_CREDENTIALS" ||
    code === "OAUTH_REVOKED_ACCESS" ||
    code === "OAUTH_MISSING_PERMISSIONS"
  ) {
    return true;
  }
  if (!errorMessage) return false;
  return classifyOAuthFailure("unknown", errorMessage).requiresReauthorization;
}

function healthRow(
  label: string,
  status: HealthCheckStatus,
  detail?: string,
): HealthCheckRow {
  return { label, status, detail };
}

function overallFromState(
  state: UnifiedConnectionState,
): ConnectionHealthBreakdown["overallHealth"] {
  if (state === "connected") return "healthy";
  if (state === "connected_warning") return "needs_attention";
  if (state === "sync_failed") return "failed";
  return "not_connected";
}

function overallLabelFromState(state: UnifiedConnectionState): string {
  switch (state) {
    case "connected":
      return "Healthy";
    case "connected_warning":
      return "Needs Attention";
    case "sync_failed":
      return "Sync Failed";
    case "authorization_required":
      return "Authorization Required";
    case "coming_soon":
      return "Coming Soon";
    default:
      return "Not Connected";
  }
}

function statusLabelFromState(state: UnifiedConnectionState): string {
  switch (state) {
    case "connected":
      return "Connected";
    case "connected_warning":
      return "Connected";
    case "sync_failed":
      return "Sync Failed";
    case "authorization_required":
      return "Authorization Required";
    case "coming_soon":
      return "Coming soon";
    default:
      return "Not Connected";
  }
}

function buildPresentation(
  state: UnifiedConnectionState,
  input: {
    health: ConnectionHealthBreakdown;
    attentionMessage?: string | null;
    guidanceMessage?: string | null;
    errorReason?: string | null;
    primaryAction?: ConnectionPresentation["primaryAction"];
    showCachedMetrics?: boolean;
    cachedDataNote?: string | null;
    canSync?: boolean;
  },
): ConnectionPresentation {
  return {
    state,
    statusLabel: statusLabelFromState(state),
    primaryAction: input.primaryAction ?? (state === "not_connected" || state === "authorization_required" ? "connect" : state === "sync_failed" || state === "connected_warning" ? "reconnect" : "manage"),
    attentionMessage: input.attentionMessage ?? input.errorReason ?? null,
    guidanceMessage: input.guidanceMessage ?? null,
    errorReason: input.errorReason ?? null,
    health: input.health,
    showCachedMetrics: input.showCachedMetrics ?? false,
    cachedDataNote: input.cachedDataNote ?? null,
    canSync: input.canSync ?? (state === "connected" || state === "connected_warning" || state === "sync_failed"),
  };
}

function lastSyncFromInstalls(installs: InstallHealth[]): string | null {
  const dates = installs.map((i) => i.last_sync_at).filter(Boolean) as string[];
  if (dates.length === 0) return null;
  return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]!;
}

export function resolveGa4ConnectionPresentation(input: {
  oauthConfigured: boolean;
  isDemo: boolean;
  install: Ga4Installation | null | undefined;
  connectorSource?: DataSourceStatus;
  cachedSnapshot?: GA4Snapshot | null;
}): ConnectionPresentation {
  const { oauthConfigured, isDemo, install, connectorSource, cachedSnapshot } = input;
  const activeInstall = install?.status === "active" ? install : null;
  const hasProperty = Boolean(activeInstall?.property_id?.trim());
  const installError =
    activeInstall?.connection_health === "error" && activeInstall.error_message?.trim()
      ? humanizeSyncError(activeInstall.error_message, "Google Analytics")
      : null;
  const connectorError =
    connectorSource?.status === "error" && connectorSource.errorMessage?.trim()
      ? humanizeSyncError(connectorSource.errorMessage, "Google Analytics")
      : null;
  const errorReason = installError ?? connectorError;
  const lastSync =
    activeInstall?.last_sync_at ??
    connectorSource?.lastSyncAt ??
    cachedSnapshot?.syncedAt ??
    null;

  if (isDemo && cachedSnapshot?.sessions30d) {
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "pass", "Demo environment"),
      permissions: healthRow("Permissions", "pass"),
      accountOrProperty: healthRow("Property Selected", "pass", cachedSnapshot ? "Demo property" : undefined),
      dataSync: healthRow("Data Sync", "pass", "Demo data"),
      lastSuccessfulSync: lastSync,
      overallHealth: "healthy",
      overallLabel: "Healthy",
    };
    return buildPresentation("connected", {
      health,
      guidanceMessage: "Demo analytics data — connect a real GA4 property in production.",
      primaryAction: "manage",
      canSync: true,
    });
  }

  if (!oauthConfigured) {
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "na"),
      permissions: healthRow("Permissions", "na"),
      accountOrProperty: healthRow("Property Selected", "na"),
      dataSync: healthRow("Data Sync", "na"),
      lastSuccessfulSync: null,
      overallHealth: "not_connected",
      overallLabel: "Not Connected",
    };
    return buildPresentation("not_connected", {
      health,
      guidanceMessage: "Connect Google Analytics 4 to enable sessions, conversion rate, user behavior, and customer journey insights.",
      primaryAction: "none",
      canSync: false,
    });
  }

  if (!activeInstall) {
    const cachedOnly = Boolean(cachedSnapshot?.sessions30d) && !activeInstall;
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "fail"),
      permissions: healthRow("Permissions", "na"),
      accountOrProperty: healthRow("Property Selected", "fail", "No property selected"),
      dataSync: healthRow("Data Sync", "fail"),
      lastSuccessfulSync: cachedOnly ? cachedSnapshot?.syncedAt ?? null : null,
      overallHealth: "not_connected",
      overallLabel: "Not Connected",
    };
    return buildPresentation("authorization_required", {
      health,
      guidanceMessage: "Connect Google Analytics 4 to enable sessions, conversion rate, user behavior, and customer journey insights.",
      showCachedMetrics: cachedOnly,
      cachedDataNote: cachedOnly && cachedSnapshot?.syncedAt
        ? `Source: Last successful sync on ${new Date(cachedSnapshot.syncedAt).toLocaleDateString()}`
        : null,
      canSync: false,
    });
  }

  if (!hasProperty) {
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "pass"),
      permissions: healthRow("Permissions", "pass"),
      accountOrProperty: healthRow("Property Selected", "fail", "Missing"),
      dataSync: healthRow("Data Sync", "fail", "Cannot sync without a property"),
      lastSuccessfulSync: lastSync,
      overallHealth: "needs_attention",
      overallLabel: "Needs Attention",
    };
    return buildPresentation("connected_warning", {
      health,
      attentionMessage: "Property access incomplete",
      guidanceMessage:
        "Google Analytics is connected, but no GA4 property has been selected. Select a property to begin syncing analytics data.",
      primaryAction: "reconnect",
      canSync: false,
    });
  }

  if (errorReason) {
    const rawError =
      activeInstall?.error_message ??
      (connectorSource?.status === "error" ? connectorSource.errorMessage : null);
    const needsReconnect = errorRequiresReconnect(rawError);
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow(
        "Authentication",
        needsReconnect ? "fail" : "pass",
        needsReconnect ? errorReason : undefined,
      ),
      permissions: healthRow("Permissions", needsReconnect ? "fail" : "warn", "May need review"),
      accountOrProperty: healthRow("Property Selected", "pass", activeInstall?.property_name ?? activeInstall?.property_id),
      dataSync: healthRow("Data Sync", "fail", errorReason),
      lastSuccessfulSync: lastSync,
      overallHealth: "failed",
      overallLabel: needsReconnect ? "Authorization Required" : "Sync Failed",
    };
    return buildPresentation(needsReconnect ? "authorization_required" : "sync_failed", {
      health,
      errorReason,
      guidanceMessage: errorReason,
      showCachedMetrics: Boolean(cachedSnapshot?.sessions30d),
      cachedDataNote:
        cachedSnapshot?.sessions30d && lastSync
          ? `Source: Last successful sync on ${new Date(lastSync).toLocaleDateString()}`
          : null,
      primaryAction: "reconnect",
      canSync: !needsReconnect,
    });
  }

  if (activeInstall.connection_health === "degraded") {
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "pass"),
      permissions: healthRow("Permissions", "warn"),
      accountOrProperty: healthRow("Property Selected", "pass", activeInstall.property_name ?? activeInstall.property_id),
      dataSync: healthRow("Data Sync", "warn", "Last sync had issues"),
      lastSuccessfulSync: lastSync,
      overallHealth: "needs_attention",
      overallLabel: "Needs Attention",
    };
    return buildPresentation("connected_warning", {
      health,
      attentionMessage: activeInstall.error_message ?? "Property access may be limited",
      guidanceMessage: "Reconnect or retry sync to restore full analytics synchronization.",
      canSync: true,
    });
  }

  if (!lastSync) {
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "pass"),
      permissions: healthRow("Permissions", "pass"),
      accountOrProperty: healthRow("Property Selected", "pass", activeInstall.property_name ?? activeInstall.property_id),
      dataSync: healthRow("Data Sync", "warn", "Awaiting first sync"),
      lastSuccessfulSync: null,
      overallHealth: "needs_attention",
      overallLabel: "Needs Attention",
    };
    return buildPresentation("connected_warning", {
      health,
      attentionMessage: "Awaiting first successful sync",
      guidanceMessage: "Property is connected. Run Sync Now to pull analytics data.",
      primaryAction: "manage",
      canSync: true,
    });
  }

  const health: ConnectionHealthBreakdown = {
    authentication: healthRow("Authentication", "pass"),
    permissions: healthRow("Permissions", "pass"),
    accountOrProperty: healthRow("Property Selected", "pass", activeInstall.property_name ?? activeInstall.property_id),
    dataSync: healthRow("Data Sync", "pass"),
    lastSuccessfulSync: lastSync,
    overallHealth: "healthy",
    overallLabel: "Healthy",
  };
  return buildPresentation("connected", { health, primaryAction: "manage", canSync: true });
}

export function resolveGoogleAdsConnectionPresentationV2(input: {
  connected: boolean;
  oauthConfigured: boolean;
  installations: Pick<
    GoogleAdsInstallation,
    "connection_health" | "error_message" | "last_sync_at" | "status"
  >[];
  connectorSource?: DataSourceStatus;
}): ConnectionPresentation {
  const { connected, oauthConfigured, installations, connectorSource } = input;

  if (!connected) {
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", oauthConfigured ? "warn" : "na"),
      permissions: healthRow("Permissions", "na"),
      accountOrProperty: healthRow("Account Selected", "na"),
      dataSync: healthRow("Data Sync", "na"),
      lastSuccessfulSync: null,
      overallHealth: "not_connected",
      overallLabel: oauthConfigured ? "Authorization Required" : "Not Connected",
    };
    return buildPresentation(oauthConfigured ? "authorization_required" : "not_connected", {
      health,
      guidanceMessage: "Connect Google Ads to sync campaign spend, ROAS, and attribution data.",
      canSync: false,
    });
  }

  const installError = installations.find(
    (i) => i.connection_health === "error" && i.error_message?.trim(),
  );
  const errorReason = humanizeSyncError(
    installError?.error_message ??
      (connectorSource?.status === "error" ? connectorSource.errorMessage : null),
    "Google Ads",
  );
  const lastSync = lastSyncFromInstalls(installations) ?? connectorSource?.lastSyncAt ?? null;
  const hasAccount = installations.some((i) => i.status === "active");

  if (errorReason) {
    const rawError =
      installError?.error_message ??
      (connectorSource?.status === "error" ? connectorSource.errorMessage : null);
    const needsReconnect = errorRequiresReconnect(rawError);
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow(
        "Authentication",
        needsReconnect ? "fail" : "pass",
        needsReconnect ? errorReason : undefined,
      ),
      permissions: healthRow("Permissions", needsReconnect ? "fail" : "warn"),
      accountOrProperty: healthRow("Account Selected", hasAccount ? "pass" : "fail"),
      dataSync: healthRow("Data Sync", "fail", errorReason),
      lastSuccessfulSync: lastSync,
      overallHealth: "failed",
      overallLabel: needsReconnect ? "Authorization Required" : "Sync Failed",
    };
    return buildPresentation(needsReconnect ? "authorization_required" : "sync_failed", {
      health,
      errorReason,
      guidanceMessage: errorReason,
      primaryAction: "reconnect",
      canSync: !needsReconnect,
    });
  }

  const degraded = installations.some((i) => i.connection_health === "degraded");
  if (!lastSync) {
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "pass"),
      permissions: healthRow("Permissions", "pass"),
      accountOrProperty: healthRow("Account Selected", "pass"),
      dataSync: healthRow("Data Sync", "warn", "Awaiting first sync"),
      lastSuccessfulSync: null,
      overallHealth: "needs_attention",
      overallLabel: "Needs Attention",
    };
    return buildPresentation("connected_warning", {
      health,
      attentionMessage: "Awaiting first successful sync",
      guidanceMessage: "Account connected. Run Sync Now to pull campaign data.",
      primaryAction: "manage",
      canSync: true,
    });
  }

  if (degraded) {
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "pass"),
      permissions: healthRow("Permissions", "warn"),
      accountOrProperty: healthRow("Account Selected", "pass"),
      dataSync: healthRow("Data Sync", "warn", "Partial sync issues"),
      lastSuccessfulSync: lastSync,
      overallHealth: "needs_attention",
      overallLabel: "Needs Attention",
    };
    return buildPresentation("connected_warning", {
      health,
      attentionMessage: installations.find((i) => i.connection_health === "degraded")?.error_message ?? "Sync issue detected",
      guidanceMessage: "Retry sync or reconnect if campaign data looks stale.",
      canSync: true,
    });
  }

  const health: ConnectionHealthBreakdown = {
    authentication: healthRow("Authentication", "pass"),
    permissions: healthRow("Permissions", "pass"),
    accountOrProperty: healthRow("Account Selected", "pass"),
    dataSync: healthRow("Data Sync", "pass"),
    lastSuccessfulSync: lastSync,
    overallHealth: "healthy",
    overallLabel: "Healthy",
  };
  return buildPresentation("connected", { health, primaryAction: "manage", canSync: true });
}

export function mapPresentationToBoardStatus(
  state: UnifiedConnectionState,
): import("./integration-board.types").IntegrationConnectionStatus {
  return state;
}

export function presentationShowsAsConnected(state: UnifiedConnectionState): boolean {
  return state === "connected" || state === "connected_warning" || state === "sync_failed";
}

export function resolveShopifyConnectionPresentation(input: {
  connected: boolean;
  isDemo: boolean;
  oauthConfigured: boolean;
  missingScopes: string[];
  syncFailed: boolean;
  errorMessage?: string | null;
  lastSyncAt: string | null;
}): ConnectionPresentation {
  const { connected, isDemo, oauthConfigured, missingScopes, syncFailed, errorMessage, lastSyncAt } = input;

  if (!connected) {
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "na"),
      permissions: healthRow("Permissions", "na"),
      accountOrProperty: healthRow("Store Connected", "na"),
      dataSync: healthRow("Data Sync", "na"),
      lastSuccessfulSync: null,
      overallHealth: "not_connected",
      overallLabel: "Not Connected",
    };
    return buildPresentation(oauthConfigured ? "authorization_required" : "not_connected", {
      health,
      guidanceMessage: "Connect Shopify to sync products, orders, inventory, and customers.",
      canSync: false,
    });
  }

  if (missingScopes.length > 0 && !isDemo) {
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "pass"),
      permissions: healthRow("Permissions", "fail", `Missing: ${missingScopes.join(", ")}`),
      accountOrProperty: healthRow("Store Connected", "pass"),
      dataSync: healthRow("Data Sync", "warn"),
      lastSuccessfulSync: lastSyncAt,
      overallHealth: "needs_attention",
      overallLabel: "Needs Attention",
    };
    return buildPresentation("connected_warning", {
      health,
      attentionMessage: "Permissions upgrade required",
      guidanceMessage: "Reconnect Shopify to grant missing permissions for discounts and product updates.",
      primaryAction: "reconnect",
      canSync: true,
    });
  }

  if (syncFailed && errorMessage) {
    const reason = humanizeSyncError(errorMessage, "Shopify");
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "pass"),
      permissions: healthRow("Permissions", "pass"),
      accountOrProperty: healthRow("Store Connected", "pass"),
      dataSync: healthRow("Data Sync", "fail", reason ?? undefined),
      lastSuccessfulSync: lastSyncAt,
      overallHealth: "failed",
      overallLabel: "Sync Failed",
    };
    return buildPresentation("sync_failed", {
      health,
      errorReason: reason,
      guidanceMessage: reason ?? undefined,
      primaryAction: "reconnect",
      canSync: true,
    });
  }

  const health: ConnectionHealthBreakdown = {
    authentication: healthRow("Authentication", "pass", isDemo ? "Demo store" : undefined),
    permissions: healthRow("Permissions", "pass"),
    accountOrProperty: healthRow("Store Connected", "pass"),
    dataSync: healthRow("Data Sync", lastSyncAt ? "pass" : "warn", lastSyncAt ? undefined : "Awaiting sync"),
    lastSuccessfulSync: lastSyncAt,
    overallHealth: lastSyncAt ? "healthy" : "needs_attention",
    overallLabel: lastSyncAt ? "Healthy" : "Needs Attention",
  };
  return buildPresentation(lastSyncAt ? "connected" : "connected_warning", {
    health,
    attentionMessage: lastSyncAt ? null : "Awaiting first successful sync",
    primaryAction: "manage",
    canSync: true,
  });
}

export function resolveMetaConnectionPresentation(input: {
  connected: boolean;
  oauthConfigured: boolean;
  syncFailed: boolean;
  errorMessage?: string | null;
  lastSyncAt: string | null;
  hasAccount: boolean;
}): ConnectionPresentation {
  const { connected, oauthConfigured, syncFailed, errorMessage, lastSyncAt, hasAccount } = input;

  if (!connected) {
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "na"),
      permissions: healthRow("Permissions", "na"),
      accountOrProperty: healthRow("Ad Account Selected", "na"),
      dataSync: healthRow("Data Sync", "na"),
      lastSuccessfulSync: null,
      overallHealth: "not_connected",
      overallLabel: "Not Connected",
    };
    return buildPresentation(oauthConfigured ? "authorization_required" : "not_connected", {
      health,
      guidanceMessage: "Connect Meta Ads to sync campaign spend, ROAS, and attribution.",
      canSync: false,
    });
  }

  if (!hasAccount) {
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow("Authentication", "pass"),
      permissions: healthRow("Permissions", "pass"),
      accountOrProperty: healthRow("Ad Account Selected", "fail", "Missing"),
      dataSync: healthRow("Data Sync", "fail"),
      lastSuccessfulSync: lastSyncAt,
      overallHealth: "needs_attention",
      overallLabel: "Needs Attention",
    };
    return buildPresentation("connected_warning", {
      health,
      attentionMessage: "No ad account selected",
      guidanceMessage: "Select a Meta ad account to begin syncing campaign data.",
      primaryAction: "reconnect",
      canSync: false,
    });
  }

  if (syncFailed && errorMessage) {
    const reason = humanizeSyncError(errorMessage, "Meta Ads");
    const needsReconnect = errorRequiresReconnect(errorMessage);
    const health: ConnectionHealthBreakdown = {
      authentication: healthRow(
        "Authentication",
        needsReconnect ? "fail" : "pass",
        needsReconnect ? reason ?? undefined : undefined,
      ),
      permissions: healthRow("Permissions", needsReconnect ? "fail" : "warn"),
      accountOrProperty: healthRow("Ad Account Selected", "pass"),
      dataSync: healthRow("Data Sync", "fail", reason ?? undefined),
      lastSuccessfulSync: lastSyncAt,
      overallHealth: "failed",
      overallLabel: needsReconnect ? "Authorization Required" : "Sync Failed",
    };
    return buildPresentation(needsReconnect ? "authorization_required" : "sync_failed", {
      health,
      errorReason: reason,
      guidanceMessage: reason ?? undefined,
      primaryAction: "reconnect",
      canSync: !needsReconnect,
    });
  }

  const health: ConnectionHealthBreakdown = {
    authentication: healthRow("Authentication", "pass"),
    permissions: healthRow("Permissions", "pass"),
    accountOrProperty: healthRow("Ad Account Selected", "pass"),
    dataSync: healthRow("Data Sync", lastSyncAt ? "pass" : "warn"),
    lastSuccessfulSync: lastSyncAt,
    overallHealth: lastSyncAt ? "healthy" : "needs_attention",
    overallLabel: lastSyncAt ? "Healthy" : "Needs Attention",
  };
  return buildPresentation(lastSyncAt ? "connected" : "connected_warning", {
    health,
    attentionMessage: lastSyncAt ? null : "Awaiting first successful sync",
    primaryAction: "manage",
    canSync: true,
  });
}

