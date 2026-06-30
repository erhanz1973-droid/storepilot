import { buildProfitDashboard } from "@/lib/services/profit";
import { NextResponse } from "next/server";

export async function GET() {
  const dashboard = await buildProfitDashboard();
  if (!dashboard) {
    return NextResponse.json(
      { error: "Profit data unavailable — connect Shopify and sync orders." },
      { status: 422 },
    );
  }
  return NextResponse.json({ dashboard });
}
