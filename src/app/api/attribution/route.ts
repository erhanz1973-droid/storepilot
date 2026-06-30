import { buildAttributionIntelligenceDashboard } from "@/lib/services/attribution";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get("model") as import("@/lib/attribution/models").AttributionModel | null;
  const dashboard = await buildAttributionIntelligenceDashboard(
    model ? { model } : undefined,
  );
  if (!dashboard) {
    return NextResponse.json(
      { error: "Connect Shopify to unlock attribution intelligence." },
      { status: 404 },
    );
  }
  return NextResponse.json(dashboard);
}
