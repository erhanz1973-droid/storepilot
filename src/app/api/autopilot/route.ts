import { buildAutopilotIntelligenceDashboard } from "@/lib/services/autopilot";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await buildAutopilotIntelligenceDashboard();
  if (!dashboard) {
    return NextResponse.json({ error: "Connect Shopify to unlock autopilot." }, { status: 404 });
  }
  return NextResponse.json(dashboard);
}
