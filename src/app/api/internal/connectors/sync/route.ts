import { hasActiveGoogleAdsInstallations } from "@/lib/db/google-ads";
import { hasActiveMetaAdsInstallations } from "@/lib/db/meta-ads";
import {
  auditShopifyConnection,
  logShopifyConnectionAudit,
} from "@/lib/db/shopify-connection-audit";
import { syncGoogleAdsForStore } from "@/lib/google-ads/store-sync";
import { syncMetaAdsForStore } from "@/lib/meta/store-sync";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const secret = process.env.STOREPILOT_INTERNAL_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return token === secret;
}

/** Internal sync bridge — called by Shopify embedded app; reuses existing connector sync services. */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { storeId?: string };
  try {
    body = (await request.json()) as { storeId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const storeId = body.storeId?.trim();
  if (!storeId) {
    return NextResponse.json({ error: "storeId required" }, { status: 400 });
  }

  console.log("[sync-trace] POST /api/internal/connectors/sync ENTER", { storeId });
  const connectionAudit = await auditShopifyConnection(storeId);
  logShopifyConnectionAudit("POST /api/internal/connectors/sync", connectionAudit);

  const result: {
    ok: boolean;
    meta?: { campaigns: number; spend30d: number; errors?: string[] };
    google?: { campaigns: number; spend30d: number };
    warnings?: string[];
  } = { ok: true };

  const warnings: string[] = [];

  try {
    if (await hasActiveMetaAdsInstallations(storeId)) {
      const meta = await syncMetaAdsForStore(storeId);
      result.meta = {
        campaigns: meta.campaigns.length,
        spend30d: meta.accountRollups.last30d.spend,
        errors: meta.errors.map((e) => e.message),
      };
      if (meta.errors.length > 0) {
        warnings.push(...meta.errors.map((e) => e.message));
      }
    }

    if (await hasActiveGoogleAdsInstallations(storeId)) {
      const google = await syncGoogleAdsForStore(storeId);
      result.google = {
        campaigns: google.googleAdsSnapshot.campaigns.length,
        spend30d: google.accountRollups.last30d.spend,
      };
    }

    if (warnings.length > 0) result.warnings = warnings;

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
