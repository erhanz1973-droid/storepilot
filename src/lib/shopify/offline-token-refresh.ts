import { encryptToken } from "@/lib/shopify/crypto";
import { getShopifyConfig } from "@/lib/shopify/oauth";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { accessTokenFingerprint, logShopifyTokenDiagnostics } from "@/lib/shopify/token-diagnostics";
import { ShopifyMerchantReauthorizationRequiredError } from "@/lib/shopify/auth-errors";

export type RefreshedOfflineTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number | null;
  refreshTokenExpiresIn: number | null;
};

export type OfflineRefreshFailureReason =
  | "missing_refresh_token"
  | "invalid_grant"
  | "expired_refresh_token"
  | "refresh_http_error"
  | "incomplete_token_pair"
  | "oauth_not_configured";

/** Structured metrics for offline refresh + single GraphQL retry. */
export type ShopifyRefreshMetrics = {
  refreshAttempted: boolean;
  refreshSucceeded: boolean;
  refreshFailed: boolean;
  retrySucceeded: boolean;
  retryFailed: boolean;
};

export function emptyShopifyRefreshMetrics(): ShopifyRefreshMetrics {
  return {
    refreshAttempted: false,
    refreshSucceeded: false,
    refreshFailed: false,
    retrySucceeded: false,
    retryFailed: false,
  };
}

export function logShopifyRefreshMetrics(
  shopDomain: string,
  metrics: ShopifyRefreshMetrics,
  extra?: Record<string, unknown>,
): void {
  console.log(
    "[shopify-refresh-metrics]",
    JSON.stringify({
      shopDomain,
      refreshAttempted: metrics.refreshAttempted,
      refreshSucceeded: metrics.refreshSucceeded,
      refreshFailed: metrics.refreshFailed,
      retrySucceeded: metrics.retrySucceeded,
      retryFailed: metrics.retryFailed,
      ...extra,
    }),
  );
}

export type OfflineRefreshAttemptResult =
  | {
      status: "refreshed";
      tokens: RefreshedOfflineTokens;
      merchantReauthorizationRequired: false;
      failureReason: null;
      detail: null;
    }
  | {
      status: "reauthorization_required";
      tokens: null;
      merchantReauthorizationRequired: true;
      failureReason: OfflineRefreshFailureReason;
      detail: string;
    };

export function classifyRefreshFailure(
  httpStatus: number,
  body: string,
): OfflineRefreshFailureReason {
  const lower = body.toLowerCase();
  if (/invalid_grant/.test(lower)) return "invalid_grant";
  if (
    /refresh.?token.*(expired|invalid|revoked)/.test(lower) ||
    /(expired|invalid|revoked).*refresh.?token/.test(lower) ||
    /token.*expired/.test(lower)
  ) {
    return "expired_refresh_token";
  }
  if (httpStatus === 400 || httpStatus === 401) {
    // Shopify often returns 400 with invalid_grant; treat remaining 4xx as unusable refresh.
    return "expired_refresh_token";
  }
  return "refresh_http_error";
}

/**
 * Exchange a Shopify offline refresh_token for a new access_token (+ rotated refresh_token).
 * Required when `expiringOfflineAccessTokens` is enabled (access tokens expire ~60 minutes).
 */
export async function refreshShopifyOfflineAccessToken(
  shop: string,
  refreshToken: string,
): Promise<RefreshedOfflineTokens> {
  const config = getShopifyConfig();
  if (!config) {
    throw new ShopifyMerchantReauthorizationRequiredError(
      shop,
      "oauth_not_configured",
      "Shopify OAuth is not configured — cannot refresh offline access token",
    );
  }

  const endpoint = `https://${shop}/admin/oauth/access_token`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: config.apiKey,
      client_secret: config.apiSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = {};
  }

  logShopifyTokenDiagnostics({
    shopDomain: shop,
    currentApiKeyPrefix: config.apiKey.slice(0, 6),
    storedClientIdPrefix: config.apiKey.slice(0, 6),
    tokenDecryptSucceeded: true,
    appMatch: true,
    reinstallRequired: false,
    sessionType: "offline",
    graphqlEndpoint: endpoint,
    httpStatus: response.status,
    tokenFingerprint: accessTokenFingerprint(
      typeof json.access_token === "string" ? json.access_token : null,
    ),
    reason: response.ok
      ? "offline refresh_token grant succeeded"
      : `offline refresh_token grant failed: ${text.slice(0, 180)}`,
  });

  if (!response.ok) {
    const failureReason = classifyRefreshFailure(response.status, text);
    throw new ShopifyMerchantReauthorizationRequiredError(
      shop,
      failureReason,
      `Shopify offline token refresh HTTP ${response.status}: ${text.slice(0, 200)}`,
    );
  }

  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  const nextRefresh = typeof json.refresh_token === "string" ? json.refresh_token : "";
  if (!accessToken || !nextRefresh) {
    throw new ShopifyMerchantReauthorizationRequiredError(
      shop,
      "incomplete_token_pair",
      "Shopify offline token refresh returned incomplete token pair",
    );
  }

  return {
    accessToken,
    refreshToken: nextRefresh,
    expiresIn: typeof json.expires_in === "number" ? json.expires_in : null,
    refreshTokenExpiresIn:
      typeof json.refresh_token_expires_in === "number" ? json.refresh_token_expires_in : null,
  };
}

export async function persistRefreshedOfflineTokens(input: {
  installationId?: string | null;
  shopDomain: string;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresIn?: number | null;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const accessEnc = encryptToken(input.accessToken);
  const refreshEnc = encryptToken(input.refreshToken);
  const refreshExpiresAt =
    input.refreshTokenExpiresIn != null
      ? new Date(Date.now() + input.refreshTokenExpiresIn * 1000).toISOString()
      : null;

  if (!supabase) {
    console.log(
      "[shopify-persist]",
      JSON.stringify({
        phase: "persistRefreshedOfflineTokens",
        shopDomain: input.shopDomain,
        installationId: input.installationId ?? null,
        tokenFingerprint: accessTokenFingerprint(input.accessToken),
        skipped: "no supabase admin client",
      }),
    );
    return;
  }

  let query = supabase
    .from("shopify_installations")
    .update({
      access_token_encrypted: accessEnc,
      refresh_token_encrypted: refreshEnc,
      refresh_token_expires_at: refreshExpiresAt,
      connection_health: "healthy",
      error_message: null,
      status: "active",
    } as Record<string, unknown>);

  if (input.installationId) {
    query = query.eq("id", input.installationId);
  } else {
    query = query.eq("shop_domain", input.shopDomain).eq("status", "active");
  }

  const { error } = await query;
  if (error) {
    throw new Error(`Failed to persist refreshed Shopify tokens: ${error.message}`);
  }

  console.log(
    "[shopify-persist]",
    JSON.stringify({
      phase: "persistRefreshedOfflineTokens",
      shopDomain: input.shopDomain,
      installationId: input.installationId ?? null,
      tokenFingerprint: accessTokenFingerprint(input.accessToken),
      sessionType: "offline",
    }),
  );
}

/**
 * On Admin API HTTP 401, attempt exactly one offline refresh + persist.
 * Never retries the refresh itself. Failures that mean the refresh token is unusable
 * return merchantReauthorizationRequired=true immediately.
 */
export async function refreshOfflineAccessTokenAfter401(input: {
  shopDomain: string;
  installationId?: string | null;
  refreshToken?: string | null;
  tokenFingerprint?: string | null;
  metrics?: ShopifyRefreshMetrics;
}): Promise<OfflineRefreshAttemptResult> {
  const metrics = input.metrics ?? emptyShopifyRefreshMetrics();
  metrics.refreshAttempted = true;

  const refreshToken = input.refreshToken?.trim();
  if (!refreshToken) {
    metrics.refreshFailed = true;
    metrics.refreshSucceeded = false;
    logShopifyTokenDiagnostics({
      shopDomain: input.shopDomain,
      currentApiKeyPrefix: null,
      storedClientIdPrefix: null,
      tokenDecryptSucceeded: true,
      appMatch: null,
      reinstallRequired: true,
      installationId: input.installationId ?? null,
      sessionType: "offline",
      tokenFingerprint: input.tokenFingerprint ?? null,
      httpStatus: 401,
      reason:
        "GraphQL/Admin HTTP 401 with no refresh_token — merchantReauthorizationRequired=true",
    });
    logShopifyRefreshMetrics(input.shopDomain, metrics, {
      failureReason: "missing_refresh_token",
      merchantReauthorizationRequired: true,
    });
    return {
      status: "reauthorization_required",
      tokens: null,
      merchantReauthorizationRequired: true,
      failureReason: "missing_refresh_token",
      detail:
        "Offline access token rejected and no refresh_token stored — merchant must reauthorize",
    };
  }

  try {
    const refreshed = await refreshShopifyOfflineAccessToken(input.shopDomain, refreshToken);
    await persistRefreshedOfflineTokens({
      installationId: input.installationId,
      shopDomain: input.shopDomain,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      refreshTokenExpiresIn: refreshed.refreshTokenExpiresIn,
    });
    metrics.refreshSucceeded = true;
    metrics.refreshFailed = false;
    logShopifyRefreshMetrics(input.shopDomain, metrics, {
      merchantReauthorizationRequired: false,
    });
    return {
      status: "refreshed",
      tokens: refreshed,
      merchantReauthorizationRequired: false,
      failureReason: null,
      detail: null,
    };
  } catch (error) {
    metrics.refreshSucceeded = false;
    metrics.refreshFailed = true;

    if (error instanceof ShopifyMerchantReauthorizationRequiredError) {
      logShopifyRefreshMetrics(input.shopDomain, metrics, {
        failureReason: error.failureReason,
        merchantReauthorizationRequired: true,
      });
      return {
        status: "reauthorization_required",
        tokens: null,
        merchantReauthorizationRequired: true,
        failureReason: error.failureReason,
        detail: error.reason,
      };
    }

    const detail = error instanceof Error ? error.message : String(error);
    const failureReason = classifyRefreshFailure(0, detail);
    logShopifyRefreshMetrics(input.shopDomain, metrics, {
      failureReason,
      merchantReauthorizationRequired: true,
    });
    return {
      status: "reauthorization_required",
      tokens: null,
      merchantReauthorizationRequired: true,
      failureReason,
      detail,
    };
  }
}
