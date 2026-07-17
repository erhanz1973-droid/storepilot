/**
 * Meta long-lived user token lifecycle.
 *
 * Meta does not issue refresh tokens. Long-lived user tokens (~60 days) can be
 * extended by calling fb_exchange_token again while the current token is still
 * valid. Once expired/revoked, the merchant must reconnect via OAuth.
 *
 * @see https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
 */

import {
  classifyOAuthFailure,
  formatClassifiedErrorMessage,
  type ClassifiedOAuthFailure,
} from "@/lib/integrations/oauth-failure";
import {
  exchangeForLongLivedMetaToken,
  isMetaOAuthConfigured,
} from "@/lib/meta/oauth";

/** Refresh when fewer than this many ms remain before expiry. */
export const META_TOKEN_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type MetaTokenLifecycleResult =
  | {
      status: "valid";
      accessToken: string;
      refreshed: false;
    }
  | {
      status: "refreshed";
      accessToken: string;
      refreshed: true;
      tokenExpiresAt: string | null;
      expiresInSeconds: number | null;
    }
  | {
      status: "reconnect_required";
      accessToken: null;
      refreshed: false;
      failure: ClassifiedOAuthFailure;
    };

export function isMetaTokenExpired(tokenExpiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!tokenExpiresAt) return false;
  const expires = new Date(tokenExpiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  return expires <= now;
}

export function isMetaTokenWithinRefreshWindow(
  tokenExpiresAt: string | null | undefined,
  now = Date.now(),
  windowMs = META_TOKEN_REFRESH_WINDOW_MS,
): boolean {
  if (!tokenExpiresAt) return false;
  const expires = new Date(tokenExpiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  const remaining = expires - now;
  return remaining > 0 && remaining <= windowMs;
}

/**
 * Ensure a usable Meta access token.
 * - Expired → reconnect_required (never silently continue).
 * - Within refresh window → attempt fb_exchange_token extension.
 * - Otherwise → return current token.
 */
export async function ensureMetaAccessToken(input: {
  accessToken: string;
  tokenExpiresAt: string | null;
}): Promise<MetaTokenLifecycleResult> {
  const now = Date.now();

  if (isMetaTokenExpired(input.tokenExpiresAt, now)) {
    const failure = classifyOAuthFailure(
      "meta",
      "Meta access token has expired. Reconnect required.",
    );
    return {
      status: "reconnect_required",
      accessToken: null,
      refreshed: false,
      failure: {
        ...failure,
        kind: "expired_token",
        action: "reconnect",
        code: "OAUTH_EXPIRED_TOKEN",
        message: failure.message,
        requiresReauthorization: true,
        health: "error",
      },
    };
  }

  if (!isMetaTokenWithinRefreshWindow(input.tokenExpiresAt, now)) {
    return {
      status: "valid",
      accessToken: input.accessToken,
      refreshed: false,
    };
  }

  if (!isMetaOAuthConfigured()) {
    const failure = classifyOAuthFailure("meta", "Meta OAuth is not configured");
    return {
      status: "reconnect_required",
      accessToken: null,
      refreshed: false,
      failure,
    };
  }

  try {
    const exchanged = await exchangeForLongLivedMetaToken(input.accessToken);
    const expiresIn = exchanged.expires_in ?? null;
    const tokenExpiresAt =
      expiresIn != null && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null;

    return {
      status: "refreshed",
      accessToken: exchanged.access_token,
      refreshed: true,
      tokenExpiresAt,
      expiresInSeconds: expiresIn,
    };
  } catch (error) {
    const failure = classifyOAuthFailure("meta", error);
    // If extension fails for auth reasons, force reconnect. Transient failures
    // still surface as reconnect when we're already inside the expiry window —
    // continuing with a soon-to-expire token would silently fail later.
    if (failure.requiresReauthorization || failure.kind === "unknown") {
      return {
        status: "reconnect_required",
        accessToken: null,
        refreshed: false,
        failure: {
          ...failure,
          kind: failure.kind === "unknown" ? "expired_token" : failure.kind,
          action: "reconnect",
          code:
            failure.kind === "unknown" ? "OAUTH_EXPIRED_TOKEN" : failure.code,
          message:
            failure.kind === "unknown"
              ? "Meta Ads authorization could not be renewed. Reconnect your account to restore access."
              : failure.message,
          requiresReauthorization: true,
          health: "error",
        },
      };
    }

    // Rate limit / temporary: keep current token if still valid.
    return {
      status: "valid",
      accessToken: input.accessToken,
      refreshed: false,
    };
  }
}

export function metaReconnectErrorMessage(failure: ClassifiedOAuthFailure): string {
  return formatClassifiedErrorMessage(failure);
}
