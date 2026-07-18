import { NextResponse } from "next/server";
import {
  deleteGoogleOAuthPending,
  getGoogleOAuthPending,
  upsertGoogleAdsInstallations,
} from "@/lib/db/google-ads";
import { syncGoogleAdsForStore } from "@/lib/google-ads/store-sync";
import { getGoogleAdsConfig } from "@/lib/google-ads/oauth";
import { buildEmbeddedAdminReturnUrl } from "@/lib/shopify/embedded-return-url";

type ConnectBody = {
  sessionId: string;
  customers: { id: string; name: string }[];
};

export async function POST(request: Request) {
  const config = getGoogleAdsConfig();
  if (!config) {
    return NextResponse.json({ error: "Google Ads OAuth is not configured" }, { status: 503 });
  }

  let body: ConnectBody;
  try {
    body = (await request.json()) as ConnectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, customers } = body;
  if (!sessionId || !customers?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const pending = await getGoogleOAuthPending(sessionId);
  if (!pending) {
    return NextResponse.json({ error: "Session expired or invalid" }, { status: 404 });
  }

  try {
    const installations = await upsertGoogleAdsInstallations({
      storeId: pending.store_id,
      googleUserId: pending.google_user_id,
      googleUserEmail: pending.google_user_email ?? undefined,
      accessToken: pending.accessToken,
      refreshToken: pending.refreshToken,
      scopes: pending.scopes,
      tokenExpiresAt: pending.token_expires_at ?? undefined,
      customers,
    });

    await deleteGoogleOAuthPending(sessionId);

    try {
      await syncGoogleAdsForStore(pending.store_id);
    } catch {
      // non-fatal initial sync failure
    }

    const fallbackUrl = `${config.appUrl}/connections?google_connected=1`;
    const redirectUrl =
      (await buildEmbeddedAdminReturnUrl(
        pending.store_id,
        "/connections?google_connected=1",
      )) ?? fallbackUrl;

    return NextResponse.json({
      ok: true,
      redirectUrl,
      installations: installations.map((i) => ({
        id: i.id,
        customerId: i.customer_id,
        customerName: i.customer_name,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect Google Ads accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
