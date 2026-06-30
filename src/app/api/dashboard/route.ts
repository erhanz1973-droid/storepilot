import { buildDashboard } from "@/lib/services/dashboard";
import { NextResponse } from "next/server";

export async function GET() {
  const dashboard = await buildDashboard();
  return NextResponse.json(dashboard);
}
