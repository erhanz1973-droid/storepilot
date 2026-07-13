import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  EMBEDDED_SHOP_COOKIE,
  isEmbeddedShopifyRequest,
  resolveShopFromEmbeddedRequest,
} from "@/lib/store/embedded-shop";

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

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const shop = resolveShopFromEmbeddedRequest({
    shopParam: searchParams.get("shop"),
    hostParam: searchParams.get("host"),
  });
  const embedded = isEmbeddedShopifyRequest({
    embeddedParam: searchParams.get("embedded"),
    hostParam: searchParams.get("host"),
    shopParam: searchParams.get("shop"),
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
