import { listStoresWithActiveGoogleAds } from "@/lib/db/google-ads";
import { listStoresWithActiveMetaAds } from "@/lib/db/meta-ads";
import { syncGoogleAdsForStore } from "@/lib/google-ads/store-sync";
import { syncMetaAdsForStore } from "@/lib/meta/store-sync";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Scheduled Meta + Google Ads sync — invoke from Railway Cron / external scheduler
 * with Authorization: Bearer $CRON_SECRET. Reuses existing store-sync services.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [metaStores, googleStores] = await Promise.all([
    listStoresWithActiveMetaAds(),
    listStoresWithActiveGoogleAds(),
  ]);

  const storeIds = new Set([
    ...metaStores.map((s) => s.storeId),
    ...googleStores.map((s) => s.storeId),
  ]);

  const results: {
    storeId: string;
    meta?: { ok: boolean; campaigns?: number; error?: string };
    google?: { ok: boolean; campaigns?: number; error?: string };
  }[] = [];

  for (const storeId of storeIds) {
    const entry: (typeof results)[number] = { storeId };

    if (metaStores.some((s) => s.storeId === storeId)) {
      try {
        const meta = await syncMetaAdsForStore(storeId);
        const firstError = meta.errors[0]?.message;
        entry.meta = {
          ok: !firstError,
          campaigns: meta.campaigns.length,
          error: firstError,
        };
      } catch (err) {
        entry.meta = {
          ok: false,
          error: err instanceof Error ? err.message : "meta sync failed",
        };
      }
    }

    if (googleStores.some((s) => s.storeId === storeId)) {
      try {
        const google = await syncGoogleAdsForStore(storeId);
        entry.google = {
          ok: true,
          campaigns: google.googleAdsSnapshot.campaigns.length,
        };
      } catch (err) {
        entry.google = {
          ok: false,
          error: err instanceof Error ? err.message : "google sync failed",
        };
      }
    }

    results.push(entry);
  }

  const failed = results.filter(
    (r) => r.meta?.ok === false || r.google?.ok === false,
  ).length;

  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    stores: storeIds.size,
    failed,
    results,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
