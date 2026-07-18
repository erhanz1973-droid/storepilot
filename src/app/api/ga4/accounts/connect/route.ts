import { NextResponse } from "next/server";
import {
  deleteGa4OAuthPending,
  getGa4OAuthPending,
  upsertGa4Installation,
} from "@/lib/db/ga4";
import { syncGa4ForStore, resolveShopifyOrders30d } from "@/lib/ga4/store-sync";
import { getGa4OAuthConfig } from "@/lib/ga4/oauth";
import { buildEmbeddedAdminReturnUrl } from "@/lib/shopify/embedded-return-url";

type ConnectBody = {
  sessionId: string;
  accountId: string;
  accountName?: string;
  propertyId: string;
  propertyName?: string;
  dataStreamId?: string;
  dataStreamName?: string;
  measurementId?: string;
};

export async function POST(request: Request) {
  const config = getGa4OAuthConfig();
  if (!config) {
    return NextResponse.json({ error: "GA4 OAuth is not configured" }, { status: 503 });
  }

  let body: ConnectBody;
  try {
    body = (await request.json()) as ConnectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    sessionId,
    accountId,
    accountName,
    propertyId,
    propertyName,
    dataStreamId,
    dataStreamName,
    measurementId,
  } = body;

  if (!sessionId || !accountId || !propertyId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const pending = await getGa4OAuthPending(sessionId);
  if (!pending) {
    return NextResponse.json({ error: "Session expired or invalid" }, { status: 404 });
  }

  try {
    const installation = await upsertGa4Installation({
      storeId: pending.store_id,
      googleUserId: pending.google_user_id,
      googleUserEmail: pending.google_user_email ?? undefined,
      accountId,
      accountName,
      propertyId,
      propertyName,
      dataStreamId,
      dataStreamName,
      measurementId,
      accessToken: pending.accessToken,
      refreshToken: pending.refreshToken,
      scopes: pending.scopes,
      tokenExpiresAt: pending.token_expires_at ?? undefined,
    });

    await deleteGa4OAuthPending(sessionId);

    try {
      const orders = await resolveShopifyOrders30d(pending.store_id);
      await syncGa4ForStore(pending.store_id, orders);
    } catch {
      // non-fatal initial sync failure — user can sync manually
    }

    const fallbackUrl = `${config.appUrl}/connections?ga4_connected=1`;
    const redirectUrl =
      (await buildEmbeddedAdminReturnUrl(
        pending.store_id,
        "/connections?ga4_connected=1",
      )) ?? fallbackUrl;

    return NextResponse.json({
      ok: true,
      redirectUrl,
      installation: {
        id: installation.id,
        propertyId: installation.property_id,
        propertyName: installation.property_name,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect GA4 property";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
