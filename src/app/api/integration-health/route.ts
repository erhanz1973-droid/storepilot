import { NextRequest, NextResponse } from "next/server";
import { buildIntegrationHealthDashboard } from "@/lib/integration-health/build-dashboard";

export async function GET() {
  const dashboard = await buildIntegrationHealthDashboard();
  return NextResponse.json(dashboard);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { runTests?: boolean };
  const dashboard = await buildIntegrationHealthDashboard({ runTests: body.runTests !== false });
  return NextResponse.json(dashboard);
}
