import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { buildMetaOAuthUrl, isMetaOAuthConfigured } from "@/lib/meta/oauth";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { ACTIVE_STORE_COOKIE, resolveActiveStoreId } from "@/lib/store/context";

async function resolveStoreIdFromRequest(request: Request): Promise<string> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("store_id")?.trim();
  if (fromQuery) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data } = await supabase.from("stores").select("id").eq("id", fromQuery).maybeSingle();
      if (data?.id) return fromQuery;
    } else {
      return fromQuery;
    }
  }
  return resolveActiveStoreId();
}

export async function GET(request: Request) {
  if (!isMetaOAuthConfigured()) {
    return NextResponse.json({ error: "Meta OAuth is not configured" }, { status: 503 });
  }

  const storeId = await resolveStoreIdFromRequest(request);
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
