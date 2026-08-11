import { NextResponse } from "next/server";
import { runFirstRunAnalysis } from "@/lib/first-run/analyze";
import {
  trackAlphaEvent,
  trackTtvRecommendation,
} from "@/lib/analytics/alpha-funnel";
import { generatedEventsForAnalyzeResult } from "@/lib/analytics/activation-events";
import { resolveActiveStoreId } from "@/lib/store/context";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const storeId = await resolveActiveStoreId();
  try {
    const result = await runFirstRunAnalysis();

    for (const row of generatedEventsForAnalyzeResult(result)) {
      await trackAlphaEvent(storeId, row.event, row.props);
    }
    if (result.decision) {
      await trackTtvRecommendation(storeId);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "[first-run] analyze failed",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        ok: false,
        storeId,
        shopifyConnected: false,
        stages: [],
        stats: {
          productsAnalyzed: 0,
          ordersAnalyzed: 0,
          campaignsAnalyzed: 0,
          inventorySkus: 0,
        },
        decision: null,
        firstValue: null,
        emptyReason:
          "Analysis could not finish. Retry, or open Connections if Shopify looks disconnected.",
        durationMs: 0,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return POST();
}
