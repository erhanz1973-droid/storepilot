import { saveRecommendationFeedback } from "@/lib/db/feedback";
import { createFeedbackReport } from "@/lib/db/feedback-center";
import { buildFeedbackContext } from "@/lib/feedback/context";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  recommendationId: z.string().uuid(),
  helpful: z.boolean(),
  reason: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.helpful && !parsed.data.reason?.trim()) {
    return NextResponse.json(
      { error: "Please tell us what was wrong when marking Not Helpful." },
      { status: 400 },
    );
  }

  try {
    const feedback = await saveRecommendationFeedback(parsed.data);

    const browser = request.headers.get("user-agent") ?? "unknown";
    const referer = request.headers.get("referer");
    const page = referer ? new URL(referer).pathname : "/";

    await createFeedbackReport({
      type: "ai_recommendation",
      title: parsed.data.helpful ? "Recommendation marked helpful" : "Recommendation marked not helpful",
      description: parsed.data.reason?.trim() || (parsed.data.helpful ? "Merchant found this recommendation helpful." : "Merchant flagged this recommendation."),
      helpful: parsed.data.helpful,
      reason: parsed.data.reason,
      recommendationId: parsed.data.recommendationId,
      context: await buildFeedbackContext({
        page,
        browser,
        recommendationId: parsed.data.recommendationId,
      }),
    }).catch(() => undefined);

    // Persist learning signal into Executive Memory (feedback is consumed by applyLearningToOutputs).
    try {
      const { recordExecutiveMemoryEvent } = await import("@/lib/db/executive-memory");
      const { getRecommendationById } = await import("@/lib/db/recommendations");
      const rec = await getRecommendationById(parsed.data.recommendationId);
      await recordExecutiveMemoryEvent({
        storeId: feedback.storeId,
        eventType: "learned",
        title: rec?.title ?? "Recommendation feedback",
        recommendationId: parsed.data.recommendationId,
        contextMessage: parsed.data.helpful
          ? "Merchant marked this recommendation helpful — similar patterns will rank higher."
          : "Merchant marked this recommendation not helpful — similar patterns will get lower confidence.",
        metadata: {
          helpful: parsed.data.helpful,
          category: rec?.category ?? null,
          entityId: rec?.entityId ?? null,
        },
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({ ok: true, feedback });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save feedback" },
      { status: 500 },
    );
  }
}
