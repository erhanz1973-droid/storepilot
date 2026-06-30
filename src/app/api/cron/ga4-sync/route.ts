import { listStoresWithActiveGa4 } from "@/lib/db/ga4";
import { syncGa4ForStore } from "@/lib/ga4/store-sync";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Scheduled GA4 sync — call every 4 hours from Vercel Cron or external scheduler. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stores = await listStoresWithActiveGa4();
  const results: { storeId: string; ok: boolean; error?: string; sessions30d?: number }[] = [];

  for (const { storeId } of stores) {
    try {
      const { ga4Snapshot } = await syncGa4ForStore(storeId);
      results.push({ storeId, ok: true, sessions30d: ga4Snapshot.sessions30d });
    } catch (err) {
      results.push({
        storeId,
        ok: false,
        error: err instanceof Error ? err.message : "sync failed",
      });
    }
  }

  const synced = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    stores: stores.length,
    synced,
    failed: results.length - synced,
    results,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
