import { cookies, headers } from "next/headers";
import { getActiveStoreIdForShopDomain } from "@/lib/db/shopify";
import { getShopifyApp } from "@/lib/shopify/shopify-app.server";
import { persistInstallationFromSession } from "@/lib/shopify/persist-installation.server";
import { embeddedActiveStoreCookieValue } from "@/lib/store/context";
import { logEmbeddedBootstrap } from "@/lib/store/embedded-context";

export type EmbeddedBootstrapResult = {
  shop: string;
  storeId: string | null;
  sessionId: string;
};

function headerRecord(headerStore: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headerStore.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

/**
 * Runs Shopify token exchange on embedded document requests so offline tokens
 * are persisted before dashboard RSC renders.
 */
export async function ensureEmbeddedShopifyBootstrap(): Promise<EmbeddedBootstrapResult | null> {
  const headerStore = await headers();
  const shopDomain = headerStore.get("x-storepilot-shop-domain");
  const embedded = headerStore.get("x-storepilot-embedded") === "1";
  const requestUrl = headerStore.get("x-storepilot-request-url");

  if (!embedded && !shopDomain) {
    return null;
  }

  logEmbeddedBootstrap("layout bootstrap start", {
    shopDomain,
    shopSource: shopDomain ? "header" : null,
    storeId: shopDomain ? await getActiveStoreIdForShopDomain(shopDomain) : null,
    installationFound: shopDomain ? Boolean(await getActiveStoreIdForShopDomain(shopDomain)) : false,
  });

  if (!requestUrl) {
    console.log("[embedded-bootstrap] skip authenticate.admin — missing x-storepilot-request-url");
    return shopDomain ? { shop: shopDomain, storeId: null, sessionId: "" } : null;
  }

  console.log("[embedded-bootstrap] before authenticate.admin", {
    requestUrl,
    shopDomain,
    hasAuthorizationHeader: Boolean(headerStore.get("authorization")),
    hasIdToken: requestUrl.includes("id_token="),
  });

  try {
    const request = new Request(requestUrl, {
      method: "GET",
      headers: headerRecord(headerStore),
    });

    const { session } = await getShopifyApp().authenticate.admin(request);

    const persisted = await persistInstallationFromSession(session, "embedded-bootstrap");

    const storeId =
      persisted?.storeId ??
      (await getActiveStoreIdForShopDomain(session.shop));

    if (storeId) {
      const cookieStore = await cookies();
      const { name, value, options } = embeddedActiveStoreCookieValue(storeId);
      cookieStore.set(name, value, options);
    }

    const result: EmbeddedBootstrapResult = {
      shop: session.shop,
      storeId,
      sessionId: session.id,
    };

    console.log(
      "[embedded-bootstrap]",
      JSON.stringify({
        phase: "authenticate.admin complete",
        ...result,
        isOnline: session.isOnline,
        hasAccessToken: Boolean(session.accessToken),
        persisted: Boolean(persisted),
      }),
    );

    return result;
  } catch (errorOrResponse) {
    if (errorOrResponse instanceof Response) {
      console.log("[embedded-bootstrap] authenticate.admin returned Response", {
        status: errorOrResponse.status,
        location: errorOrResponse.headers.get("location"),
        contentType: errorOrResponse.headers.get("content-type"),
      });
      throw errorOrResponse;
    }

    const message =
      errorOrResponse instanceof Error ? errorOrResponse.message : String(errorOrResponse);
    console.error("[embedded-bootstrap] authenticate.admin exception", { message });
    throw errorOrResponse;
  }
}
