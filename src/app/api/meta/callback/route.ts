import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createMetaOAuthPending } from "@/lib/db/meta-ads";
import {
  exchangeCodeForMetaToken,
  exchangeForLongLivedMetaToken,
  fetchMetaUserProfile,
  getMetaConfig,
} from "@/lib/meta/oauth";
import { ACTIVE_STORE_COOKIE } from "@/lib/store/context";

export async function GET(request: Request) {
  const config = getMetaConfig();
  if (!config) {
    const appUrl = process.env.META_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.redirect(
      `${appUrl}/connections?tab=advertising&error=${encodeURIComponent("meta_oauth_not_configured")}`,
    );
  }

  const url = new URL(request.url);
  const params = url.searchParams;
  const error = params.get("error");
  if (error) {
    return NextResponse.redirect(
      `${config.appUrl}/connections?tab=advertising&error=${encodeURIComponent(error)}`,
    );
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("meta_oauth_state")?.value;
  const state = params.get("state");
  if (!savedState || !state || savedState !== state) {
    return NextResponse.redirect(`${config.appUrl}/connections?tab=advertising&error=invalid_state`);
  }

  const code = params.get("code");
  if (!code) {
    return NextResponse.redirect(`${config.appUrl}/connections?tab=advertising&error=missing_params`);
  }

  const storeId =
    cookieStore.get("meta_oauth_store_id")?.value ??
    cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (!storeId) {
    return NextResponse.redirect(`${config.appUrl}/connections?tab=advertising&error=missing_store`);
  }

  try {
    const shortToken = await exchangeCodeForMetaToken(code);
    const longToken = await exchangeForLongLivedMetaToken(shortToken.access_token);
    const profile = await fetchMetaUserProfile(longToken.access_token);

    const tokenExpiresAt = longToken.expires_in
      ? new Date(Date.now() + longToken.expires_in * 1000).toISOString()
      : undefined;

    const pending = await createMetaOAuthPending({
      storeId,
      metaUserId: profile.id,
      metaUserName: profile.name,
      accessToken: longToken.access_token,
      scopes: (process.env.META_SCOPES ?? "ads_read,business_management")
        .split(",")
        .map((s) => s.trim()),
      tokenExpiresAt,
    });

    const response = NextResponse.redirect(
      `${config.appUrl}/connections/meta/select?session=${pending.id}`,
    );
    response.cookies.delete("meta_oauth_state");
    response.cookies.delete("meta_oauth_store_id");
    response.cookies.set(ACTIVE_STORE_COOKIE, storeId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "meta_install_failed";
    return NextResponse.redirect(
      `${config.appUrl}/connections?tab=advertising&error=${encodeURIComponent(message)}`,
    );
  }
}
