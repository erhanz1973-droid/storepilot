import { captureBaselineOnImplement, runPendingMeasurements } from "@/lib/learning/measurement-engine";
import { resolveActiveStoreId } from "@/lib/store/context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Background measurement endpoint — call from cron or dashboard sync */
export async function POST() {
  const storeId = await resolveActiveStoreId();
  const result = await runPendingMeasurements(storeId);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  const storeId = await resolveActiveStoreId();
  const result = await runPendingMeasurements(storeId);
  return NextResponse.json({ ok: true, ...result });
}
