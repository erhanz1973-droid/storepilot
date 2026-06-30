import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createGoogleOAuthPending } from "@/lib/db/google-ads";
import {
  exchangeCodeForGoogleTokens,
  fetchGoogleUserProfile,
  getGoogleAdsConfig,
} from "@/lib/google-ads/oauth";
import { OAUTH_BASE_URL_COOKIE, resolveOAuthBaseUrl } from "@/lib/oauth/base-url";
import { ACTIVE_STORE_COOKIE } from "@/lib/store/context";

export async function GET(request: Request) {
  const config = getGoogleAdsConfig();
  const fallbackBase = config
    ? resolveOAuthBaseUrl(request, config.appUrl)
    : new URL(request.url).origin;

  if (!config) {
    return NextResponse.redirect(
      `${fallbackBase}/connections?error=${encodeURIComponent("google_oauth_not_configured")}`,
    );
  }

  const url = new URL(request.url);
  const params = url.searchParams;
  const error = params.get("error");
  if (error) {
    return NextResponse.redirect(
      `${fallbackBase}/connections?error=${encodeURIComponent(error)}`,
    );
  }

  const cookieStore = await cookies();
  const oauthBaseUrl =
    cookieStore.get(OAUTH_BASE_URL_COOKIE.google)?.value ??
    resolveOAuthBaseUrl(request, config.appUrl);

  const savedState = cookieStore.get("google_oauth_state")?.value;
  const state = params.get("state");
  if (!savedState || !state || savedState !== state) {
    return NextResponse.redirect(
      `${oauthBaseUrl}/connections?error=invalid_state&provider=google`,
    );
  }

  const code = params.get("code");
  if (!code) {
    return NextResponse.redirect(`${oauthBaseUrl}/connections?error=missing_params`);
  }

  const storeId =
    cookieStore.get("google_oauth_store_id")?.value ??
    cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (!storeId) {
    return NextResponse.redirect(`${oauthBaseUrl}/connections?error=missing_store`);
  }

  try {
    const tokens = await exchangeCodeForGoogleTokens(code, oauthBaseUrl);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        `${oauthBaseUrl}/connections?error=${encodeURIComponent("missing_refresh_token_reauthorize")}`,
      );
    }

    const profile = await fetchGoogleUserProfile(tokens.access_token);
    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined;

    const pending = await createGoogleOAuthPending({
      storeId,
      googleUserId: profile.sub,
      googleUserEmail: profile.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scopes: (tokens.scope ?? config.scopes).split(" ").filter(Boolean),
      tokenExpiresAt,
    });

    const response = NextResponse.redirect(
      `${oauthBaseUrl}/connections/google/select?session=${pending.id}`,
    );
    response.cookies.delete("google_oauth_state");
    response.cookies.delete("google_oauth_store_id");
    response.cookies.delete(OAUTH_BASE_URL_COOKIE.google);
    response.cookies.set(ACTIVE_STORE_COOKIE, storeId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "google_install_failed";
    return NextResponse.redirect(
      `${oauthBaseUrl}/connections?error=${encodeURIComponent(message)}`,
    );
  }
}
