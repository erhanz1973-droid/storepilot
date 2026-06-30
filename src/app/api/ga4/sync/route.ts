import { syncGa4ForStore, resolveShopifyOrders30d } from "@/lib/ga4/store-sync";
import { hasActiveGa4Installation } from "@/lib/db/ga4";
import { resolveActiveStoreId } from "@/lib/store/context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const storeId = await resolveActiveStoreId();
  const active = await hasActiveGa4Installation(storeId);
  if (!active) {
    return NextResponse.json(
      { error: "No GA4 property connected. Connect via /connections first." },
      { status: 404 },
    );
  }

  try {
    const orders = await resolveShopifyOrders30d(storeId);
    const result = await syncGa4ForStore(storeId, orders);
    const ga4 = result.ga4Snapshot;
    return NextResponse.json({
      ok: true,
      syncedAt: ga4.syncedAt ?? new Date().toISOString(),
      sessions30d: ga4.sessions30d,
      engagementRatePct: ga4.engagementRatePct,
      ecommerceConversionRatePct: ga4.ecommerceConversionRatePct,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
