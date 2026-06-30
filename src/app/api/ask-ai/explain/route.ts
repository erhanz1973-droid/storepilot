import { buildBusinessContext } from "@/lib/ai/context-engine";
import { explainRecommendation, findRecommendation } from "@/lib/ai/explain";
import { recordExplanation } from "@/lib/ai/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  recommendationId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const context = await buildBusinessContext();
  const rec = findRecommendation(context, parsed.data.recommendationId);
  if (!rec) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  const sessionId = parsed.data.sessionId ?? crypto.randomUUID();
  recordExplanation(sessionId, rec.id);
  const explanation = explainRecommendation(rec, sessionId);

  return NextResponse.json({ explanation, sessionId });
}
