import { hasActiveMetaAdsInstallations } from "@/lib/db/meta-ads";
import { syncMetaAdsForStore } from "@/lib/meta/store-sync";
import { resolveActiveStoreId } from "@/lib/store/context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const storeId = await resolveActiveStoreId();
  const active = await hasActiveMetaAdsInstallations(storeId);
  if (!active) {
    return NextResponse.json(
      { error: "No Meta Ads accounts connected. Connect via /connections first." },
      { status: 404 },
    );
  }

  try {
    const result = await syncMetaAdsForStore(storeId);
    if (result.errors.length > 0 && result.campaigns.length === 0) {
      const first = result.errors[0];
      return NextResponse.json(
        {
          error: first.message,
          errors: result.errors,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      campaigns: result.campaigns.length,
      spend30d: result.accountRollups?.last30d.spend ?? 0,
      warnings: result.errors.length > 0 ? result.errors.map((entry) => entry.message) : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
