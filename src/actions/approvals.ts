"use server";

import { revalidatePath } from "next/cache";
import { captureBaselineOnImplement } from "@/lib/learning/measurement-engine";
import { updateRecommendationStatus } from "@/lib/db/recommendations";
import { resolveActiveStoreId } from "@/lib/store/context";
import type { RecommendationStatus } from "@/lib/types";

export async function submitApprovalAction(input: {
  recommendationId: string;
  status: RecommendationStatus;
  note?: string;
  snoozeDays?: number;
}) {
  const storeId = await resolveActiveStoreId();

  if (input.status === "implemented") {
    const rec = await captureBaselineOnImplement(input.recommendationId, storeId);
    try {
      const { recordExecutiveMemoryEvent } = await import("@/lib/db/executive-memory");
      const { parseRevenueImpact } = await import("@/lib/approvals/presenter");
      await recordExecutiveMemoryEvent({
        storeId,
        eventType: "executed",
        title: rec?.title ?? "Recommendation executed",
        recommendationId: input.recommendationId,
        estimatedImpactMonthly: rec ? parseRevenueImpact(rec.expectedImpact) : null,
        contextMessage: "Recommendation implemented — measurement window started.",
      });
    } catch {
      // non-fatal
    }
    revalidatePath("/");
    revalidatePath("/decisions");
    revalidatePath("/ask-ai");
    revalidatePath("/approvals");
    revalidatePath("/history");
    revalidatePath(`/recommendations/${input.recommendationId}`);
    return {
      approval: {
        recommendationId: input.recommendationId,
        status: "implemented" as const,
        note: input.note,
        updatedAt: new Date().toISOString(),
      },
      recommendation: rec,
    };
  }

  const approval = await updateRecommendationStatus(
    input.recommendationId,
    input.status,
    { note: input.note, snoozeDays: input.snoozeDays },
  );

  revalidatePath("/");
  revalidatePath("/decisions");
  revalidatePath("/ask-ai");
  revalidatePath("/approvals");
  revalidatePath("/history");
  revalidatePath(`/recommendations/${input.recommendationId}`);

  return { approval };
}
