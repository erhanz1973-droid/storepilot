import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  EMBEDDED_SHOP_COOKIE,
  isEmbeddedShopifyRequest,
  normalizeShopDomain,
  resolveShopFromEmbeddedRequest,
} from "@/lib/store/embedded-shop";
import {
  AUTHENTICATED_FLAG_HEADER,
  AUTHENTICATED_SHOP_HEADER,
  hasServiceSecret,
  isApiPath,
  isPublicApiPath,
} from "@/lib/api/route-auth";
import {
  getBearerToken,
  InvalidSessionTokenError,
  verifyShopifySessionToken,
} from "@/lib/shopify/session-token";

function logEmbeddedRequest(request: NextRequest, phase: string, shop: string | null): void {
  const shopParam = request.nextUrl.searchParams.get("shop");
  const host = request.nextUrl.searchParams.get("host");
  if (
    !shop &&
    !host &&
    request.nextUrl.pathname !== "/app" &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    return;
  }

  console.log(
    "[embedded-startup]",
    JSON.stringify({
      phase,
      requestUrl: request.url,
      pathname: request.nextUrl.pathname,
      shop: shopParam,
      resolvedShop: shop,
      host,
      embedded: request.nextUrl.searchParams.get("embedded"),
      hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
    }),
  );
}

function buildFrameAncestorsCsp(shop: string | null): string {
  if (shop) {
    return `frame-ancestors https://${shop} https://admin.shopify.com;`;
  }
  // Standalone / unknown shop: disallow framing (Shopify iframe-protection guidance).
  return "frame-ancestors 'none';";
}

function unauthorized(reason: string): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized", reason },
    {
      status: 401,
      headers: {
        "Content-Security-Policy": "frame-ancestors 'none';",
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Enforce an embedded Shopify session token on protected API routes.
 * Tenant identity is derived ONLY from the verified token (or a trusted service
 * secret) — never from attacker-controllable `?shop=` / `?host=` query params.
 */
async function guardProtectedApi(request: NextRequest): Promise<NextResponse> {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-storepilot-request-url", request.url);
  // Never trust a client-supplied identity header on protected routes.
  requestHeaders.delete(AUTHENTICATED_SHOP_HEADER);
  requestHeaders.delete(AUTHENTICATED_FLAG_HEADER);
  requestHeaders.delete("x-storepilot-embedded");

  if (hasServiceSecret(request)) {
    requestHeaders.set(AUTHENTICATED_FLAG_HEADER, "service");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const token = getBearerToken(request);
  if (!token) {
    return unauthorized("missing_session_token");
  }

  try {
    const { shop } = await verifyShopifySessionToken(token);
    requestHeaders.set(AUTHENTICATED_SHOP_HEADER, shop);
    requestHeaders.set(AUTHENTICATED_FLAG_HEADER, "1");
    requestHeaders.set("x-storepilot-embedded", "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (error) {
    const reason =
      error instanceof InvalidSessionTokenError ? "invalid_session_token" : "auth_error";
    return unauthorized(reason);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (isApiPath(pathname) && !isPublicApiPath(pathname)) {
    return guardProtectedApi(request);
  }

  const shopFromQuery = resolveShopFromEmbeddedRequest({
    shopParam: searchParams.get("shop"),
    hostParam: searchParams.get("host"),
  });
  const shopFromCookie = normalizeShopDomain(
    request.cookies.get(EMBEDDED_SHOP_COOKIE)?.value,
  );
  const shop = shopFromQuery ?? shopFromCookie;
  const embedded = isEmbeddedShopifyRequest({
    embeddedParam: searchParams.get("embedded"),
    hostParam: searchParams.get("host"),
    shopParam: searchParams.get("shop") ?? shopFromCookie,
  });

  if (pathname === "/app") {
    logEmbeddedRequest(request, "redirect /app → /", shop);
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (shop || pathname.startsWith("/auth")) {
    logEmbeddedRequest(request, "embedded request pass-through", shop);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-storepilot-request-url", request.url);
  if (shop) {
    requestHeaders.set("x-storepilot-shop-domain", shop);
  }
  if (embedded) {
    requestHeaders.set("x-storepilot-embedded", "1");
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (shop && embedded) {
    response.cookies.set(EMBEDDED_SHOP_COOKIE, shop, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 60 * 60 * 24 * 90,
    });
  }

  // Always set frame-ancestors on HTML-capable routes (Shopify App Store requirement).
  response.headers.set("Content-Security-Policy", buildFrameAncestorsCsp(shop));

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
