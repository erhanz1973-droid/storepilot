import { buildFeedbackContext } from "@/lib/feedback/context";
import { MAX_SCREENSHOT_BYTES } from "@/lib/feedback/constants";
import {
  buildFeedbackCenterView,
  createFeedbackReport,
} from "@/lib/db/feedback-center";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const submitSchema = z.object({
  type: z.enum(["bug", "ai_recommendation", "feature_request", "general"]),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(8000),
  helpful: z.boolean().nullable().optional(),
  reason: z.string().max(2000).optional(),
  recommendationId: z.string().uuid().optional().nullable(),
  screenshotDataUrl: z.string().max(700_000).optional().nullable(),
  context: z.object({
    page: z.string().min(1),
    browser: z.string().min(1),
    recommendationId: z.string().uuid().optional().nullable(),
  }),
});

export async function GET() {
  const view = await buildFeedbackCenterView();
  return NextResponse.json(view);
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parsed = submitSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  if (data.type === "ai_recommendation" && data.helpful === false && !data.reason?.trim()) {
    return NextResponse.json(
      { error: "Please explain what was wrong when marking Not Helpful." },
      { status: 400 },
    );
  }

  if (data.screenshotDataUrl) {
    const approxBytes = Math.ceil((data.screenshotDataUrl.length * 3) / 4);
    if (approxBytes > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json({ error: "Screenshot must be under 500KB." }, { status: 400 });
    }
  }

  const context = await buildFeedbackContext({
    page: data.context.page,
    browser: data.context.browser,
    recommendationId: data.recommendationId ?? data.context.recommendationId,
  });

  const report = await createFeedbackReport({
    type: data.type,
    title: data.title,
    description: data.description,
    helpful: data.type === "ai_recommendation" ? (data.helpful ?? null) : null,
    reason: data.reason,
    recommendationId: data.recommendationId ?? data.context.recommendationId ?? null,
    screenshotDataUrl: data.screenshotDataUrl ?? null,
    context,
  });

  return NextResponse.json({ ok: true, report });
}
