import type { Session } from "@shopify/shopify-api";

import { getShopifyApp } from "@/lib/shopify/shopify-app.server";
import { getInstallationByShopDomain } from "@/lib/db/shopify";
import { resolveEmbeddedShopDomain } from "@/lib/store/embedded-context";

export type EmbeddedAuthResult = {
  session: Session;
  shop: string;
  storeId: string | null;
  installationFound: boolean;
};

export type EmbeddedStartupDiagnostics = {
  requestUrl: string;
  shop: string | null;
  host: string | null;
  sessionFound: boolean;
  installationFound: boolean;
  authenticatedShop: string | null;
  storeId: string | null;
};

function shopFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const raw = url.searchParams.get("shop");
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return normalized.includes(".") ? normalized : `${normalized}.myshopify.com`;
}

export async function readEmbeddedStartupDiagnostics(
  request: Request,
): Promise<EmbeddedStartupDiagnostics> {
  const url = new URL(request.url);
  const shop = shopFromRequest(request) ?? (await resolveEmbeddedShopDomain());
  const installation = shop ? await getInstallationByShopDomain(shop) : null;

  return {
    requestUrl: url.toString(),
    shop,
    host: url.searchParams.get("host"),
    sessionFound: false,
    installationFound: installation != null,
    authenticatedShop: installation?.shop_domain ?? null,
    storeId: installation?.store_id ?? null,
  };
}

export function logEmbeddedStartupDiagnostics(
  phase: string,
  diagnostics: EmbeddedStartupDiagnostics,
  extra?: Record<string, unknown>,
): void {
  console.log(
    "[embedded-auth]",
    JSON.stringify({
      phase,
      ...diagnostics,
      ...extra,
    }),
  );
}

/**
 * Runs Shopify embedded admin authentication for /auth/* routes.
 * Returns thrown Response objects (redirects) for the route handler.
 */
export async function runEmbeddedAuth(request: Request): Promise<Response> {
  const pre = await readEmbeddedStartupDiagnostics(request);
  logEmbeddedStartupDiagnostics("before authenticate.admin", pre, {
    hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
  });

  try {
    const { session } = await getShopifyApp().authenticate.admin(request);
    const installation = await getInstallationByShopDomain(session.shop);

    logEmbeddedStartupDiagnostics("authenticate.admin success", pre, {
      sessionFound: true,
      authenticatedShop: session.shop,
      installationFound: installation != null,
      storeId: installation?.store_id ?? null,
      sessionId: session.id,
    });

    return Response.json({
      ok: true,
      shop: session.shop,
      storeId: installation?.store_id ?? null,
    });
  } catch (errorOrResponse) {
    if (errorOrResponse instanceof Response) {
      logEmbeddedStartupDiagnostics("authenticate.admin redirect/response", pre, {
        status: errorOrResponse.status,
      });
      return errorOrResponse;
    }

    const message = errorOrResponse instanceof Error ? errorOrResponse.message : String(errorOrResponse);
    console.error("[embedded-auth] authenticate.admin exception", {
      ...pre,
      message,
      stack: errorOrResponse instanceof Error ? errorOrResponse.stack : undefined,
    });
    throw errorOrResponse;
  }
}

export { getShopifyApp };
