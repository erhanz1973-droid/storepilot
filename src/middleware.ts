import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isEmbeddedShopifyRequest,
  resolveShopFromEmbeddedRequest,
} from "@/lib/store/embedded-shop";
import {
  AUTHENTICATED_FLAG_HEADER,
  AUTHENTICATED_SHOP_HEADER,
  CSP_SHOP_HINT_HEADER,
  hasServiceSecret,
  isApiPath,
  isPublicApiPath,
} from "@/lib/api/route-auth";
import {
  getBearerToken,
  InvalidSessionTokenError,
  verifyShopifySessionToken,
} from "@/lib/shopify/session-token";
import {
  isMarketingHost,
  isMarketingPath,
  resolveRequestHost,
} from "@/lib/marketing/site";

/** Public files under /public — must not require a Shopify session. */
function isPublicStaticPath(pathname: string): boolean {
  if (
    pathname.startsWith("/images/") ||
    pathname === "/icon.png" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return true;
  }
  return /\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?)$/i.test(pathname);
}

function logEmbeddedRequest(request: NextRequest, phase: string, cspShop: string | null): void {
  const shopParam = request.nextUrl.searchParams.get("shop");
  const host = request.nextUrl.searchParams.get("host");
  if (
    !cspShop &&
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
      cspShop,
      host,
      embedded: request.nextUrl.searchParams.get("embedded"),
      hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
      hasIdToken: Boolean(request.nextUrl.searchParams.get("id_token")),
    }),
  );
}

function buildFrameAncestorsCsp(shop: string | null): string {
  if (shop) {
    return `frame-ancestors https://${shop} https://admin.shopify.com;`;
  }
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

function stripClientIdentityHeaders(headers: Headers): void {
  // Never trust client-supplied identity headers.
  headers.delete(AUTHENTICATED_SHOP_HEADER);
  headers.delete(AUTHENTICATED_FLAG_HEADER);
  headers.delete(CSP_SHOP_HINT_HEADER);
  headers.delete("x-storepilot-shop-domain");
  headers.delete("x-storepilot-embedded");
}

/**
 * Enforce an embedded Shopify session token on protected API routes.
 * Tenant identity is derived ONLY from the verified token (or a trusted service
 * secret) — never from attacker-controllable `?shop=` / `?host=` query params.
 */
async function guardProtectedApi(request: NextRequest): Promise<NextResponse> {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-storepilot-request-url", request.url);
  stripClientIdentityHeaders(requestHeaders);

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

/**
 * For HTML/document requests: optionally verify Shopify `id_token` query param
 * (session token). Never trust bare ?shop= / host for tenant identity.
 */
async function tryVerifyDocumentSession(
  request: NextRequest,
): Promise<string | null> {
  const idToken =
    request.nextUrl.searchParams.get("id_token") ??
    getBearerToken(request);
  if (!idToken) return null;
  try {
    const { shop } = await verifyShopifySessionToken(idToken);
    return shop;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (isApiPath(pathname) && !isPublicApiPath(pathname)) {
    return guardProtectedApi(request);
  }

  // Query/host shop is ONLY used for CSP frame-ancestors — never for tenant ID.
  const cspShop = resolveShopFromEmbeddedRequest({
    shopParam: searchParams.get("shop"),
    hostParam: searchParams.get("host"),
  });
  const embedded = isEmbeddedShopifyRequest({
    embeddedParam: searchParams.get("embedded"),
    hostParam: searchParams.get("host"),
    shopParam: searchParams.get("shop"),
  });

  if (pathname === "/app") {
    logEmbeddedRequest(request, "redirect /app → /", cspShop);
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (cspShop || pathname.startsWith("/auth")) {
    logEmbeddedRequest(request, "embedded request pass-through", cspShop);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-storepilot-request-url", request.url);
  stripClientIdentityHeaders(requestHeaders);

  const verifiedShop = await tryVerifyDocumentSession(request);
  if (verifiedShop) {
    requestHeaders.set(AUTHENTICATED_SHOP_HEADER, verifiedShop);
    requestHeaders.set(AUTHENTICATED_FLAG_HEADER, "1");
    requestHeaders.set("x-storepilot-embedded", "1");
  } else if (embedded) {
    // Mark embedded UX without granting tenant identity.
    requestHeaders.set("x-storepilot-embedded", "1");
  }

  // CSP hint only — resolvers must ignore this header.
  if (cspShop) {
    requestHeaders.set(CSP_SHOP_HINT_HEADER, cspShop);
  }

  if (!isApiPath(pathname) && !verifiedShop) {
    const isPublicDocument =
      pathname.startsWith("/auth") ||
      isPublicStaticPath(pathname) ||
      (isMarketingPath(pathname) &&
        isMarketingHost(resolveRequestHost(request.headers)));

    if (!isPublicDocument) {
      if (embedded) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/auth/login";
        return NextResponse.redirect(loginUrl);
      }
      return unauthorized("missing_session_token");
    }
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Do NOT set EMBEDDED_SHOP_COOKIE from unverified query shop (B1).
  // Tenant binding cookie is set only after authenticate.admin in bootstrap.

  response.headers.set(
    "Content-Security-Policy",
    buildFrameAncestorsCsp(verifiedShop ?? cspShop),
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
