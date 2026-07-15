import { NextResponse } from "next/server";
import { runFirstRunAnalysis } from "@/lib/first-run/analyze";
import {
  trackAlphaEvent,
  trackTtvRecommendation,
} from "@/lib/analytics/alpha-funnel";
import { resolveActiveStoreId } from "@/lib/store/context";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const storeId = await resolveActiveStoreId();
  const result = await runFirstRunAnalysis();

  if (result.decision) {
    await trackAlphaEvent(storeId, "first_recommendation_shown", {
      recommendationId: result.decision.recommendationId,
      impactMonthly: result.decision.impactMonthly,
      confidencePct: result.decision.confidencePct,
    });
    await trackTtvRecommendation(storeId);
  }

  return NextResponse.json(result);
}

export async function GET() {
  return POST();
}
