import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { buildMetaOAuthUrl, isMetaOAuthConfigured } from "@/lib/meta/oauth";
import { resolveActiveStoreId } from "@/lib/store/context";

export async function GET() {
  if (!isMetaOAuthConfigured()) {
    return NextResponse.json({ error: "Meta OAuth is not configured" }, { status: 503 });
  }

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

  return response;
}
