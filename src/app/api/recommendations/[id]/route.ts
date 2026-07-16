import { recommendationService } from "@/lib/recommendations/service";
import { resolveActiveStoreId } from "@/lib/store/context";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const storeId = await resolveActiveStoreId();
  const recommendation = await recommendationService.getById(id);
  // Tenant isolation: never reveal a recommendation from another merchant's store.
  if (!recommendation || recommendation.storeId !== storeId) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  const events = await recommendationService.listEvents(id);
  return NextResponse.json({ recommendation, events });
}
