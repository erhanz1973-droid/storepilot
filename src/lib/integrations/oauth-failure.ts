/**
 * Shared OAuth / API failure classification for Shopify, Meta, Google Ads, GA4.
 * Maps raw provider errors into actionable reconnect vs retry guidance.
 */

export type OAuthFailureKind =
  | "invalid_credentials"
  | "expired_token"
  | "revoked_access"
  | "missing_permissions"
  | "rate_limit"
  | "temporary_api_failure"
  | "not_configured"
  | "unknown";

export type OAuthFailureAction = "reconnect" | "retry" | "wait_and_retry" | "configure";

export type ClassifiedOAuthFailure = {
  kind: OAuthFailureKind;
  action: OAuthFailureAction;
  /** Short machine code for logs / DB error_message prefix. */
  code: string;
  /** Merchant-facing message — never a generic "connection error". */
  message: string;
  /** Whether connection_health should force authorization_required UX. */
  requiresReauthorization: boolean;
  /** Prefer "error" for auth failures, "degraded" for transient/rate-limit. */
  health: "error" | "degraded";
};

const KIND_TO_ACTION: Record<OAuthFailureKind, OAuthFailureAction> = {
  invalid_credentials: "reconnect",
  expired_token: "reconnect",
  revoked_access: "reconnect",
  missing_permissions: "reconnect",
  rate_limit: "wait_and_retry",
  temporary_api_failure: "retry",
  not_configured: "configure",
  unknown: "retry",
};

const KIND_TO_HEALTH: Record<OAuthFailureKind, "error" | "degraded"> = {
  invalid_credentials: "error",
  expired_token: "error",
  revoked_access: "error",
  missing_permissions: "error",
  rate_limit: "degraded",
  temporary_api_failure: "degraded",
  not_configured: "error",
  unknown: "degraded",
};

function providerLabel(provider: string): string {
  switch (provider) {
    case "shopify":
      return "Shopify";
    case "meta":
    case "meta_ads":
      return "Meta Ads";
    case "google":
    case "google_ads":
      return "Google Ads";
    case "ga4":
      return "Google Analytics 4";
    default:
      return provider;
  }
}

function messageForKind(provider: string, kind: OAuthFailureKind, detail?: string): string {
  const name = providerLabel(provider);
  switch (kind) {
    case "invalid_credentials":
      return `${name} credentials are invalid. Reconnect your account to restore access.`;
    case "expired_token":
      return `${name} authorization expired. Reconnect your account to restore access.`;
    case "revoked_access":
      return `${name} access was revoked. Reconnect and grant the required permissions.`;
    case "missing_permissions":
      return `${name} is missing required permissions. Reconnect and approve all requested scopes.`;
    case "rate_limit":
      return `${name} API rate limit reached. Wait a few minutes and retry sync.`;
    case "temporary_api_failure":
      return `${name} is temporarily unavailable. Retry sync in a few minutes.`;
    case "not_configured":
      return `${name} OAuth is not configured on this server.`;
    default:
      return detail?.trim()
        ? `${name} sync failed: ${detail.trim().slice(0, 240)}`
        : `${name} sync failed. Retry sync, or reconnect if the issue persists.`;
  }
}

function detectKind(raw: string): OAuthFailureKind {
  const lower = raw.toLowerCase();

  if (
    lower.includes("not configured") ||
    lower.includes("oauth_not_configured") ||
    lower.includes("oauth is not configured")
  ) {
    return "not_configured";
  }

  if (
    lower.includes("rate limit") ||
    lower.includes("ratelimit") ||
    lower.includes("too many requests") ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    /\b429\b/.test(lower)
  ) {
    return "rate_limit";
  }

  if (
    lower.includes("permission") ||
    lower.includes("insufficient") ||
    lower.includes("scope") ||
    lower.includes("accessdenied") ||
    lower.includes("access_denied") ||
    lower.includes("forbidden") ||
    /\b403\b/.test(lower)
  ) {
    return "missing_permissions";
  }

  if (
    lower.includes("revoked") ||
    lower.includes("user has not authorized") ||
    lower.includes("has not authorized application") ||
    lower.includes("invalidated") ||
    lower.includes("session has been invalidated")
  ) {
    return "revoked_access";
  }

  if (
    lower.includes("expired") ||
    lower.includes("token has expired") ||
    lower.includes("access token has expired") ||
    lower.includes("invalid_grant") ||
    lower.includes("session expired") ||
    lower.includes("reinstall_required") ||
    lower.includes("reauthorization")
  ) {
    return "expired_token";
  }

  if (
    lower.includes("invalid_token") ||
    lower.includes("invalid oauth") ||
    lower.includes("invalid access token") ||
    lower.includes("invalid credentials") ||
    lower.includes("authentication failed") ||
    lower.includes("unauthorized") ||
    lower.includes("bad signature") ||
    /\b401\b/.test(lower)
  ) {
    return "invalid_credentials";
  }

  if (
    lower.includes("timeout") ||
    lower.includes("econnreset") ||
    lower.includes("enotfound") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("service unavailable") ||
    lower.includes("internal server error") ||
    /\b5\d{2}\b/.test(lower)
  ) {
    return "temporary_api_failure";
  }

  return "unknown";
}

/**
 * Classify a raw provider/sync error into a structured failure with UX action.
 */
export function classifyOAuthFailure(
  provider: string,
  error: unknown,
): ClassifiedOAuthFailure {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String(error ?? "unknown error");

  const kind = detectKind(raw);
  const action = KIND_TO_ACTION[kind];
  const health = KIND_TO_HEALTH[kind];
  const requiresReauthorization =
    action === "reconnect" || kind === "not_configured";

  return {
    kind,
    action,
    code: `OAUTH_${kind.toUpperCase()}`,
    message: messageForKind(provider, kind, raw),
    requiresReauthorization,
    health,
  };
}

/** Persistable error_message: CODE: merchant message */
export function formatClassifiedErrorMessage(failure: ClassifiedOAuthFailure): string {
  return `${failure.code}: ${failure.message}`;
}

/** Extract known code prefix from a stored error_message, if present. */
export function parseStoredFailureCode(errorMessage: string | null | undefined): string | null {
  if (!errorMessage) return null;
  const match = errorMessage.match(/^(OAUTH_[A-Z_]+):/);
  return match?.[1] ?? null;
}
