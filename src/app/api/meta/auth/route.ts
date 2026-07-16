import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { buildMetaOAuthUrl, isMetaOAuthConfigured } from "@/lib/meta/oauth";
import { ACTIVE_STORE_COOKIE, resolveActiveStoreId } from "@/lib/store/context";

export async function GET() {
  if (!isMetaOAuthConfigured()) {
    return NextResponse.json({ error: "Meta OAuth is not configured" }, { status: 503 });
  }

  // Store is resolved from the server-side (bootstrap-bound) context only —
  // never from a client-supplied ?store_id= to prevent cross-tenant binding.
  const storeId = await resolveActiveStoreId();
  const state = randomBytes(16).toString("hex");

  const response = NextResponse.redirect(buildMetaOAuthUrl(state));
  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set("meta_oauth_store_id", storeId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set(ACTIVE_STORE_COOKIE, storeId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return response;
}
