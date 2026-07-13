import { NextResponse } from "next/server";
import { runEmbeddedShopifyBootstrap } from "@/lib/shopify/embedded-bootstrap.server";
import { embeddedActiveStoreCookieValue } from "@/lib/store/context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Embedded Shopify bootstrap Route Handler.
 *
 * authenticate.admin() may set session cookies — that is only legal here
 * (Route Handler), never in a React Server Component / layout.tsx.
 *
 * Client: EmbeddedShopifyBootstrap fetches this with the page search params.
 */
export async function GET(request: Request) {
  try {
    const result = await runEmbeddedShopifyBootstrap(request);

    if ("skipped" in result) {
      return NextResponse.json({ ok: true, skipped: true, reason: result.reason });
    }

    const response = NextResponse.json({
      ok: true,
      skipped: false,
      shop: result.shop,
      storeId: result.storeId,
      sessionId: result.sessionId,
      persisted: result.persisted,
    });

    if (result.storeId) {
      const { name, value, options } = embeddedActiveStoreCookieValue(result.storeId);
      response.cookies.set(name, value, options);
    }

    return response;
  } catch (errorOrResponse) {
    if (errorOrResponse instanceof Response) {
      console.log("[embedded-bootstrap] authenticate.admin returned Response", {
        status: errorOrResponse.status,
        location: errorOrResponse.headers.get("location"),
        contentType: errorOrResponse.headers.get("content-type"),
      });
      // Forward Shopify redirects / App Bridge bounce responses (includes Set-Cookie).
      return errorOrResponse;
    }

    const message =
      errorOrResponse instanceof Error ? errorOrResponse.message : String(errorOrResponse);
    console.error("[embedded-bootstrap] route handler failed", { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
