import { NextResponse } from "next/server";
import {
  deleteMetaOAuthPending,
  disconnectOtherMetaInstallations,
  getMetaOAuthPending,
  upsertMetaAdsInstallations,
} from "@/lib/db/meta-ads";
import { syncMetaAdsForStore } from "@/lib/meta/store-sync";
import { getMetaConfig } from "@/lib/meta/oauth";
import { buildEmbeddedAdminReturnUrl } from "@/lib/shopify/embedded-return-url";

type ConnectBody = {
  sessionId: string;
  businessId: string;
  businessName?: string;
  adAccountId?: string;
  adAccountName?: string;
  /** @deprecated use adAccountId */
  adAccounts?: { id: string; name: string }[];
};

export async function POST(request: Request) {
  const config = getMetaConfig();
  if (!config) {
    return NextResponse.json({ error: "Meta OAuth is not configured" }, { status: 503 });
  }

  let body: ConnectBody;
  try {
    body = (await request.json()) as ConnectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, businessId, businessName } = body;
  const adAccount =
    body.adAccountId && body.adAccountName
      ? { id: body.adAccountId, name: body.adAccountName }
      : body.adAccounts?.[0];

  if (!sessionId || !businessId || !adAccount?.id) {
    return NextResponse.json({ error: "Missing sessionId, businessId, or adAccount" }, { status: 400 });
  }

  const pending = await getMetaOAuthPending(sessionId);
  if (!pending) {
    return NextResponse.json({ error: "Session expired or invalid" }, { status: 404 });
  }

  const adAccountId = adAccount.id.startsWith("act_") ? adAccount.id : `act_${adAccount.id}`;

  try {
    await disconnectOtherMetaInstallations(pending.store_id, adAccountId);

    const installations = await upsertMetaAdsInstallations({
      storeId: pending.store_id,
      metaUserId: pending.meta_user_id,
      metaUserName: pending.meta_user_name ?? undefined,
      businessId,
      businessName,
      accessToken: pending.accessToken,
      scopes: pending.scopes,
      tokenExpiresAt: pending.token_expires_at ?? undefined,
      adAccounts: [{ id: adAccountId, name: adAccount.name }],
    });

    await deleteMetaOAuthPending(sessionId);

    try {
      await syncMetaAdsForStore(pending.store_id);
    } catch {
      // non-fatal initial sync failure
    }

    const saved = installations[0];
    const fallbackUrl = `${config.appUrl}/connections?tab=advertising&meta_connected=1`;
    const redirectUrl =
      (await buildEmbeddedAdminReturnUrl(
        pending.store_id,
        "/connections?tab=advertising&meta_connected=1",
      )) ?? fallbackUrl;

    return NextResponse.json({
      ok: true,
      redirectUrl,
      installation: saved
        ? {
            id: saved.id,
            businessId: saved.business_id,
            adAccountId: saved.ad_account_id,
            adAccountName: saved.ad_account_name,
          }
        : {
            businessId,
            adAccountId,
            adAccountName: adAccount.name,
          },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect ad account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
