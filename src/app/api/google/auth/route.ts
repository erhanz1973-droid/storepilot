import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildGoogleAdsOAuthUrl, getGoogleAdsConfig, isGoogleAdsOAuthConfigured } from "@/lib/google-ads/oauth";
import { OAUTH_BASE_URL_COOKIE, resolveOAuthBaseUrl } from "@/lib/oauth/base-url";
import { resolveActiveStoreId } from "@/lib/store/context";
import { randomBytes } from "crypto";

export async function GET(request: Request) {
  const config = getGoogleAdsConfig();
  if (!isGoogleAdsOAuthConfigured() || !config) {
    const appUrl = process.env.GOOGLE_ADS_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.redirect(
      `${appUrl}/connections?error=${encodeURIComponent("google_oauth_not_configured")}`,
    );
  }

  const oauthBaseUrl = resolveOAuthBaseUrl(request, config.appUrl);
  const storeId = await resolveActiveStoreId();
  const state = randomBytes(16).toString("hex");

  const response = NextResponse.redirect(buildGoogleAdsOAuthUrl(state, oauthBaseUrl));
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };

  response.cookies.set("google_oauth_state", state, cookieOptions);
  response.cookies.set("google_oauth_store_id", storeId, cookieOptions);
  response.cookies.set(OAUTH_BASE_URL_COOKIE.google, oauthBaseUrl, cookieOptions);

  return response;
}
