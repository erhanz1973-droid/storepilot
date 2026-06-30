import { recommendationService } from "@/lib/recommendations/service";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const recommendation = await recommendationService.getById(id);
  if (!recommendation) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  const events = await recommendationService.listEvents(id);
  return NextResponse.json({ recommendation, events });
}
