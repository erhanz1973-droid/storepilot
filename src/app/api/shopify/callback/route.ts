import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createStoreForShop,
  findStoreByShopDomain,
  upsertShopifyInstallation,
} from "@/lib/db/shopify";
import {
  exchangeCodeForToken,
  getShopifyConfig,
  normalizeShopDomain,
  registerAppWebhooks,
  verifyOAuthHmac,
} from "@/lib/shopify/oauth";
import { syncShopifyStore } from "@/lib/shopify/sync";
import { updateShopifySyncResult } from "@/lib/db/shopify";
import { ACTIVE_STORE_COOKIE } from "@/lib/store/context";
import { trackAlphaEvent } from "@/lib/analytics/alpha-funnel";

export async function GET(request: Request) {
  const config = getShopifyConfig();
  if (!config) {
    const appUrl = process.env.SHOPIFY_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.redirect(
      `${appUrl}/connections?tab=commerce&error=oauth_not_configured`,
    );
  }

  const url = new URL(request.url);
  const params = url.searchParams;

  if (!verifyOAuthHmac(params)) {
    return NextResponse.redirect(`${config.appUrl}/connections?tab=commerce&error=invalid_hmac`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("shopify_oauth_state")?.value;
  const state = params.get("state");
  if (!savedState || !state || savedState !== state) {
    return NextResponse.redirect(`${config.appUrl}/connections?tab=commerce&error=invalid_state`);
  }

  const shopParam = params.get("shop");
  const code = params.get("code");
  if (!shopParam || !code) {
    return NextResponse.redirect(`${config.appUrl}/connections?tab=commerce&error=missing_params`);
  }

  let shop: string;
  try {
    shop = normalizeShopDomain(shopParam);
  } catch {
    return NextResponse.redirect(`${config.appUrl}/connections?tab=commerce&error=invalid_shop`);
  }

  try {
    const tokenResult = await exchangeCodeForToken(shop, code);
    const scopes = tokenResult.scope.split(",").map((s) => s.trim());

    let storeId = await findStoreByShopDomain(shop);
    if (!storeId) {
      storeId = await createStoreForShop(shop, shop);
    }

    await upsertShopifyInstallation({
      storeId,
      shopDomain: shop,
      accessToken: tokenResult.access_token,
      scopes,
      clientId: config.apiKey,
    });

    await registerAppWebhooks(shop, tokenResult.access_token);

    try {
      const syncResult = await syncShopifyStore(shop, tokenResult.access_token, {
        storedClientId: config.apiKey,
      });
      await updateShopifySyncResult(storeId, syncResult.stats, syncResult.snapshot, {
        shopName: syncResult.shopName,
        shopifyPlan: syncResult.shopifyPlan,
      });
    } catch {
      // Initial sync failure is non-fatal; store is still connected
    }

    await trackAlphaEvent(storeId, "installation_completed", { shop });
    await trackAlphaEvent(storeId, "shopify_connected", { shop, source: "oauth_callback" });

    const response = NextResponse.redirect(`${config.appUrl}/first-run?installed=1`);
    response.cookies.set(ACTIVE_STORE_COOKIE, storeId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    response.cookies.delete("shopify_oauth_state");
    response.cookies.delete("shopify_oauth_shop");

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "install_failed";
    return NextResponse.redirect(
      `${config.appUrl}/connections?tab=commerce&error=${encodeURIComponent(message)}`,
    );
  }
}
