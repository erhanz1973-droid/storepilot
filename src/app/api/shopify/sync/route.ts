import { NextResponse } from "next/server";
import { getInstallationByStoreId, updateShopifySyncResult } from "@/lib/db/shopify";
import { syncShopifyStore } from "@/lib/shopify/sync";
import { resolveActiveStoreId } from "@/lib/store/context";

export const dynamic = "force-dynamic";

export async function POST() {
  const storeId = await resolveActiveStoreId();
  const installation = await getInstallationByStoreId(storeId);
  if (!installation) {
    return NextResponse.json({ error: "Shopify store not connected." }, { status: 404 });
  }

  try {
    const result = await syncShopifyStore(installation.shop_domain, installation.accessToken);
    await updateShopifySyncResult(installation.store_id, result.stats, result.snapshot, {
      shopName: result.shopName,
      shopifyPlan: result.shopifyPlan,
    });
    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      products: result.snapshot.products?.length ?? 0,
      orders30d: result.snapshot.storeMetrics?.orders30d ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
