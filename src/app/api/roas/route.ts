import { buildProfitDashboard } from "@/lib/services/profit";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await buildProfitDashboard();
  if (!dashboard?.blendedRoas) {
    return Response.json({ error: "ROAS data unavailable" }, { status: 404 });
  }
  return Response.json({ dashboard: dashboard.blendedRoas });
}
