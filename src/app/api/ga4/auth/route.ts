import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildGa4OAuthUrl, getGa4OAuthConfig, isGa4OAuthConfigured } from "@/lib/ga4/oauth";
import { OAUTH_BASE_URL_COOKIE, resolveOAuthBaseUrl } from "@/lib/oauth/base-url";
import { ACTIVE_STORE_COOKIE, resolveActiveStoreId } from "@/lib/store/context";
import { getSupabaseAdmin } from "@/lib/supabase/client";

async function resolveStoreIdFromRequest(request: Request): Promise<string> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("store_id")?.trim();
  if (fromQuery) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data } = await supabase.from("stores").select("id").eq("id", fromQuery).maybeSingle();
      if (data?.id) return fromQuery;
    } else {
      return fromQuery;
    }
  }
  return resolveActiveStoreId();
}

export async function GET(request: Request) {
  const config = getGa4OAuthConfig();
  if (!isGa4OAuthConfigured() || !config) {
    const appUrl = process.env.GA4_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.redirect(
      `${appUrl}/connections?error=${encodeURIComponent("ga4_oauth_not_configured")}`,
    );
  }

  const oauthBaseUrl = resolveOAuthBaseUrl(request, config.appUrl);
  const storeId = await resolveStoreIdFromRequest(request);
  const state = randomBytes(16).toString("hex");

  const response = NextResponse.redirect(buildGa4OAuthUrl(state, oauthBaseUrl));
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };

  response.cookies.set("ga4_oauth_state", state, cookieOptions);
  response.cookies.set("ga4_oauth_store_id", storeId, cookieOptions);
  response.cookies.set(OAUTH_BASE_URL_COOKIE.ga4, oauthBaseUrl, cookieOptions);
  response.cookies.set(ACTIVE_STORE_COOKIE, storeId, cookieOptions);

  return response;
}
