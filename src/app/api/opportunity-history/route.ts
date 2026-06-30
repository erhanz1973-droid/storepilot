import { NextResponse } from "next/server";
import { listOpportunityHistory } from "@/lib/db/opportunity-history";
import { summarizeOpportunityHistory } from "@/lib/opportunities/history";
import { resolveActiveStoreId } from "@/lib/store/context";

export const dynamic = "force-dynamic";

export async function GET() {
  const storeId = await resolveActiveStoreId();
  const records = await listOpportunityHistory(storeId);
  return NextResponse.json({
    records,
    summary: summarizeOpportunityHistory(records),
  });
}
