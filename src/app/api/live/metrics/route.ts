import { buildLiveKpiMetrics, buildLiveMissionControl } from "@/lib/services/analytics";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope") ?? "full";

  if (scope === "kpis") {
    const kpis = await buildLiveKpiMetrics();
    return NextResponse.json(kpis, {
      headers: { "Cache-Control": "private, max-age=10" },
    });
  }

  const view = await buildLiveMissionControl();
  return NextResponse.json(view, {
    headers: { "Cache-Control": "private, max-age=15" },
  });
}
