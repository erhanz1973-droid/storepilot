import { captureBaselineOnImplement } from "@/lib/learning/measurement-engine";
import { getAllApprovals, updateRecommendationStatus } from "@/lib/db/recommendations";
import { resolveActiveStoreId } from "@/lib/store/context";
import type { RecommendationStatus } from "@/lib/types";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  recommendationId: z.string().uuid(),
  status: z.enum(["approved", "ignored", "snoozed", "pending", "completed", "implemented"]),
  note: z.string().optional(),
  snoozeDays: z.number().int().min(1).max(90).optional(),
});

export async function GET() {
  const approvals = await getAllApprovals();
  return NextResponse.json({ approvals });
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { recommendationId, status, note, snoozeDays } = parsed.data;
  const storeId = await resolveActiveStoreId();

  if (status === "implemented") {
    const rec = await captureBaselineOnImplement(recommendationId, storeId);
    try {
      const { recordExecutiveMemoryEvent } = await import("@/lib/db/executive-memory");
      const { parseRevenueImpact } = await import("@/lib/approvals/presenter");
      await recordExecutiveMemoryEvent({
        storeId,
        eventType: "executed",
        title: rec?.title ?? "Recommendation executed",
        recommendationId,
        estimatedImpactMonthly: rec ? parseRevenueImpact(rec.expectedImpact) : null,
        contextMessage: "Recommendation implemented — measurement window started.",
      });
    } catch {
      // non-fatal
    }
    const approvals = await getAllApprovals();
    const record = approvals.find((a) => a.recommendationId === recommendationId);
    return NextResponse.json({
      approval: record ?? {
        recommendationId,
        status: "implemented",
        updatedAt: new Date().toISOString(),
      },
    });
  }

  const record = await updateRecommendationStatus(
    recommendationId,
    status as RecommendationStatus,
    { note, snoozeDays },
  );

  return NextResponse.json({ approval: record });
}
