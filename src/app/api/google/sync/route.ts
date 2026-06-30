import { syncGoogleAdsForStore } from "@/lib/google-ads/store-sync";
import { hasActiveGoogleAdsInstallations } from "@/lib/db/google-ads";
import { resolveActiveStoreId } from "@/lib/store/context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const storeId = await resolveActiveStoreId();
  const active = await hasActiveGoogleAdsInstallations(storeId);
  if (!active) {
    return NextResponse.json(
      { error: "No Google Ads accounts connected. Connect via /connections first." },
      { status: 404 },
    );
  }

  try {
    const result = await syncGoogleAdsForStore(storeId);
    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      campaigns: result.googleAdsSnapshot.campaigns.length,
      spend30d: result.googleAdsSnapshot.rollups.last30d.spend,
      adSpendSnapshot: result.adSpendSnapshot,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
