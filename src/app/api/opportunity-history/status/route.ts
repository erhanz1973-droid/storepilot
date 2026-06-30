import { NextResponse } from "next/server";
import { updateOpportunityStatus } from "@/lib/db/opportunity-history";
import { resolveActiveStoreId } from "@/lib/store/context";
import type { OpportunityHistoryStatus } from "@/lib/opportunities/history";

export const dynamic = "force-dynamic";

const VALID_STATUSES: OpportunityHistoryStatus[] = [
  "detected",
  "viewed",
  "ignored",
  "resolved",
  "expired",
];

export async function POST(req: Request) {
  const body = (await req.json()) as {
    opportunityKey: string;
    status: OpportunityHistoryStatus;
  };

  if (!body.opportunityKey || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const storeId = await resolveActiveStoreId();
  await updateOpportunityStatus(storeId, body.opportunityKey, body.status);
  return NextResponse.json({ ok: true });
}
