import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SHOP_DOMAIN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

function normalizeShop(shop: string | null): string | null {
  if (!shop) return null;
  const trimmed = shop.trim().toLowerCase();
  if (!trimmed) return null;
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  return SHOP_DOMAIN.test(domain) ? domain : null;
}

function logEmbeddedRequest(request: NextRequest, phase: string): void {
  const shop = request.nextUrl.searchParams.get("shop");
  const host = request.nextUrl.searchParams.get("host");
  if (!shop && !host && request.nextUrl.pathname !== "/app" && !request.nextUrl.pathname.startsWith("/auth")) {
    return;
  }

  console.log(
    "[embedded-startup]",
    JSON.stringify({
      phase,
      requestUrl: request.url,
      pathname: request.nextUrl.pathname,
      shop,
      host,
      embedded: request.nextUrl.searchParams.get("embedded"),
      hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
    }),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/app") {
    logEmbeddedRequest(request, "redirect /app → /");
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // /auth/* is handled by src/app/auth/[...slug]/route.ts (embedded Shopify OAuth).

  const shop = normalizeShop(request.nextUrl.searchParams.get("shop"));
  if (shop || pathname.startsWith("/auth")) {
    logEmbeddedRequest(request, "embedded request pass-through");
  }

  const requestHeaders = new Headers(request.headers);
  if (shop) {
    requestHeaders.set("x-storepilot-shop-domain", shop);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (shop) {
    response.headers.set(
      "Content-Security-Policy",
      `frame-ancestors https://${shop} https://admin.shopify.com;`,
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
