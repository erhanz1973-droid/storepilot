import { recommendationService } from "@/lib/recommendations/service";
import { statusTransitionPayloadSchema } from "@/lib/recommendations/validators";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = statusTransitionPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const recommendation = await recommendationService.reject(id, parsed.data);
    const events = await recommendationService.listEvents(id);
    return NextResponse.json({ recommendation, events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
