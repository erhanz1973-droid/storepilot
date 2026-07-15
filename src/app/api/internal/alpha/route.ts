import { NextResponse } from "next/server";
import { buildAlphaDashboardMetrics } from "@/lib/analytics/alpha-metrics";

export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const secret = process.env.STOREPILOT_INTERNAL_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return token === secret;
}

/** Internal alpha funnel metrics — Bearer STOREPILOT_INTERNAL_SECRET */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const metrics = await buildAlphaDashboardMetrics();
  return NextResponse.json(metrics);
}
