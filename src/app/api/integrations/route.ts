import { buildIntegrationsHub } from "@/lib/services/integrations";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const hub = await buildIntegrationsHub();
  return NextResponse.json(hub);
}
