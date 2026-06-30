"use server";

import { revalidatePath } from "next/cache";
import { captureBaselineOnImplement } from "@/lib/learning/measurement-engine";
import { updateRecommendationStatus } from "@/lib/db/recommendations";
import type { RecommendationStatus } from "@/lib/types";

export async function submitApprovalAction(input: {
  recommendationId: string;
  status: RecommendationStatus;
  note?: string;
  snoozeDays?: number;
}) {
  if (input.status === "implemented") {
    const rec = await captureBaselineOnImplement(input.recommendationId);
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
