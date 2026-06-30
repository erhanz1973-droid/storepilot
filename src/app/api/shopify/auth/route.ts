import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  buildOAuthUrl,
  getShopifyConfig,
  isShopifyOAuthConfigured,
  normalizeShopDomain,
} from "@/lib/shopify/oauth";

export async function GET(request: Request) {
  if (!isShopifyOAuthConfigured()) {
    return NextResponse.json({ error: "Shopify OAuth is not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const shopParam = searchParams.get("shop");
  if (!shopParam) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  let shop: string;
  try {
    shop = normalizeShopDomain(shopParam);
  } catch {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
  }

  const state = randomBytes(16).toString("hex");
  const oauthUrl = buildOAuthUrl(shop, state);

  const response = NextResponse.redirect(oauthUrl);
  response.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set("shopify_oauth_shop", shop, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
