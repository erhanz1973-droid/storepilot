import { buildProductIntelligenceDashboard } from "@/lib/services/products";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await buildProductIntelligenceDashboard();
  if (!dashboard) {
    return NextResponse.json(
      { error: "Connect Shopify to unlock product intelligence." },
      { status: 404 },
    );
  }
  return NextResponse.json(dashboard);
}
