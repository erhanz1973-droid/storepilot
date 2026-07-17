import { NextResponse } from "next/server";
import {
  auditShopifyConnection,
  logShopifyConnectionAudit,
} from "@/lib/db/shopify-connection-audit";
import { getInstallationByStoreId, updateShopifySyncResult } from "@/lib/db/shopify";
import {
  classifyOAuthFailure,
  formatClassifiedErrorMessage,
} from "@/lib/integrations/oauth-failure";
import { isShopifyReinstallRequiredError } from "@/lib/shopify/auth-errors";
import { syncShopifyStore } from "@/lib/shopify/sync";
import { resolveActiveStoreId } from "@/lib/store/context";

export const dynamic = "force-dynamic";

export async function POST() {
  console.log("[sync-trace] POST /api/shopify/sync ENTER");
  const storeId = await resolveActiveStoreId();
  console.log("[sync-trace] POST /api/shopify/sync storeId", { storeId });

  const connectionAudit = await auditShopifyConnection(storeId);
  logShopifyConnectionAudit("POST /api/shopify/sync", connectionAudit);

  const installation = await getInstallationByStoreId(storeId);
  if (!installation) {
    console.log("[sync-trace] POST /api/shopify/sync blocked — no shopify_installations row", {
      storeId,
      connectedVia: connectionAudit.connectedVia,
      shopsDomain: connectionAudit.shopsRow.shopDomain,
      likelyCause: connectionAudit.likelyCause,
    });
    return NextResponse.json({ error: "Shopify store not connected." }, { status: 404 });
  }

  try {
    console.log("[sync-trace] POST /api/shopify/sync calling syncShopifyStore", {
      shop: installation.shop_domain,
    });
    const result = await syncShopifyStore(installation.shop_domain, installation.accessToken, {
      storedClientId: installation.clientId,
      installationId: installation.id,
      refreshToken: installation.refreshToken,
    });
    await updateShopifySyncResult(installation.store_id, result.stats, result.snapshot, {
      shopName: result.shopName,
      shopifyPlan: result.shopifyPlan,
    });
    console.log("[sync-trace] POST /api/shopify/sync success", {
      products: result.snapshot.products?.length ?? 0,
      orders30d: result.snapshot.storeMetrics?.orders30d ?? 0,
    });
    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      products: result.snapshot.products?.length ?? 0,
      orders30d: result.snapshot.storeMetrics?.orders30d ?? 0,
    });
  } catch (err) {
    const failure = classifyOAuthFailure("shopify", err);
    const message = formatClassifiedErrorMessage(failure);
    console.error("[sync-trace] POST /api/shopify/sync FAILED", message);
    const reinstallRequired =
      isShopifyReinstallRequiredError(err) || failure.requiresReauthorization;
    const status = reinstallRequired ? 401 : 500;
    return NextResponse.json(
      {
        error: message,
        reinstallRequired,
        failureKind: failure.kind,
        action: failure.action,
      },
      { status },
    );
  }
}
