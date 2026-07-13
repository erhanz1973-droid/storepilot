import { getActiveStoreIdForShopDomain } from "@/lib/db/shopify";
import { getShopifyApp } from "@/lib/shopify/shopify-app.server";
import { persistInstallationFromSession } from "@/lib/shopify/persist-installation.server";
import { logEmbeddedBootstrap } from "@/lib/store/embedded-context";

export type EmbeddedBootstrapResult = {
  shop: string;
  storeId: string | null;
  sessionId: string;
  persisted: boolean;
};

function isEmbeddedBootstrapRequest(request: Request): boolean {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");
  const embedded = url.searchParams.get("embedded");
  const headerShop = request.headers.get("x-storepilot-shop-domain");
  const headerEmbedded = request.headers.get("x-storepilot-embedded");
  return Boolean(shop || host || embedded === "1" || headerShop || headerEmbedded === "1");
}

/**
 * Runs Shopify authenticate.admin + installation persistence.
 * Must only be called from a Route Handler (or Server Action) so cookie
 * mutations from the Shopify SDK are legal in Next.js.
 */
export async function runEmbeddedShopifyBootstrap(
  request: Request,
): Promise<EmbeddedBootstrapResult | { skipped: true; reason: string }> {
  if (!isEmbeddedBootstrapRequest(request)) {
    return { skipped: true, reason: "not_embedded" };
  }

  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  const headerShop = request.headers.get("x-storepilot-shop-domain");
  const shopDomain = shopParam ?? headerShop;

  logEmbeddedBootstrap("route bootstrap start", {
    shopDomain: shopDomain
      ? shopDomain.includes(".")
        ? shopDomain
        : `${shopDomain}.myshopify.com`
      : null,
    shopSource: shopParam ? "header" : headerShop ? "header" : null,
    storeId: shopDomain ? await getActiveStoreIdForShopDomain(
      shopDomain.includes(".") ? shopDomain : `${shopDomain}.myshopify.com`,
    ) : null,
    installationFound: shopDomain
      ? Boolean(
          await getActiveStoreIdForShopDomain(
            shopDomain.includes(".") ? shopDomain : `${shopDomain}.myshopify.com`,
          ),
        )
      : false,
  });

  // Reconstruct the document URL for Shopify session-token / bounce handling.
  // Client calls /api/shopify/bootstrap?... with the same search params as the page.
  const documentUrl =
    request.headers.get("x-storepilot-request-url") ??
    request.url.replace(/\/api\/shopify\/bootstrap/, "/");

  console.log("[embedded-bootstrap] before authenticate.admin", {
    requestUrl: documentUrl,
    shopDomain,
    hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
    hasIdToken: documentUrl.includes("id_token=") || url.searchParams.has("id_token"),
  });

  const authRequest = new Request(documentUrl, {
    method: "GET",
    headers: request.headers,
  });

  const { session } = await getShopifyApp().authenticate.admin(authRequest);
  const persisted = await persistInstallationFromSession(session, "embedded-bootstrap");

  const storeId =
    persisted?.storeId ?? (await getActiveStoreIdForShopDomain(session.shop));

  const result: EmbeddedBootstrapResult = {
    shop: session.shop,
    storeId,
    sessionId: session.id,
    persisted: Boolean(persisted),
  };

  console.log(
    "[embedded-bootstrap]",
    JSON.stringify({
      phase: "authenticate.admin complete",
      ...result,
      isOnline: session.isOnline,
      hasAccessToken: Boolean(session.accessToken),
    }),
  );

  return result;
}
