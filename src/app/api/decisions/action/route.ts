import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  mirrorDecisionToRecommendations,
  updateRecommendationStatus,
} from "@/lib/db/recommendations";
import { recordDecisionRejectionFeedback } from "@/lib/db/decision-feedback";
import { getRecommendationById } from "@/lib/db/recommendations";
import { recordDecisionAction } from "@/lib/db/opportunity-history";
import { recordMerchantAction } from "@/lib/db/recommendation-intelligence";
import { recordLifecycleEvent } from "@/lib/recommendations/intelligence/lifecycle";
import { getLatestAuditByRecommendationId, updateAuditOutcome } from "@/lib/recommendations/validation/audit";
import { executeApprovedAction } from "@/lib/execution/engine";
import { scheduleOutcomeFromExecution, scheduleOutcomeFromRecommendation } from "@/lib/learning/outcome-scheduler";
import { getVerifiedStoreData } from "@/lib/recommendations/validation";
import { captureKpisForEntity } from "@/lib/learning/metrics";
import { parseImpactFromLabel } from "@/lib/learning/outcome-measurer";
import type { ExecutionParams } from "@/lib/execution/params";
import { isExecutableAction, type FutureActionType } from "@/lib/insights/actions";
import { resolveActiveStoreId } from "@/lib/store/context";
import type { RecommendationStatus } from "@/lib/types";
import type { ExecutionEntityType, ExecutionPlatform } from "@/lib/execution/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const executionParamsSchema = z
  .object({
    discountPercent: z.number().optional(),
    discountCode: z.string().optional(),
    durationDays: z.number().optional(),
    collectionId: z.string().optional(),
    collectionName: z.string().optional(),
    partnerProductId: z.string().optional(),
    partnerProductName: z.string().optional(),
    productIds: z.array(z.string()).optional(),
  })
  .optional();

const bodySchema = z.object({
  recommendationId: z.string().uuid().optional(),
  opportunityKey: z.string().min(1).optional(),
  title: z.string().min(1),
  action: z.enum(["approve", "later", "reject"]),
  confidencePct: z.number().optional(),
  decisionId: z.string().optional(),
  futureAction: z.string().optional(),
  platform: z.enum(["meta_ads", "google_ads", "shopify"]).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  executionParams: executionParamsSchema,
  expectedImpactLabel: z.string().optional(),
  approvedBy: z.string().optional(),
  rejectionReason: z
    .enum([
      "too_aggressive",
      "need_more_evidence",
      "will_execute_later",
      "already_doing",
      "business_preference",
      "other",
    ])
    .optional(),
  recommendationCategory: z.string().optional(),
});

function toExecutionEntityType(entityType?: string): ExecutionEntityType | null {
  if (entityType === "campaign" || entityType === "product" || entityType === "collection") {
    return entityType;
  }
  return null;
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  const storeId = await resolveActiveStoreId();

  if (body.action === "reject" && body.rejectionReason) {
    await recordDecisionRejectionFeedback({
      storeId,
      reason: body.rejectionReason,
      recommendationId: body.recommendationId,
      decisionId: body.decisionId,
      opportunityKey: body.opportunityKey,
    });
  }

  if (body.recommendationId) {
    const status: RecommendationStatus =
      body.action === "approve" ? "approved" : body.action === "reject" ? "ignored" : "snoozed";
    await updateRecommendationStatus(body.recommendationId, status, {
      snoozeDays: body.action === "later" ? 7 : undefined,
    });

    await recordMerchantAction({
      storeId,
      recommendationId: body.recommendationId,
      action: body.action,
      userLabel: body.approvedBy ?? "Merchant",
    });

    const lifecycleEvent =
      body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "snoozed";
    const lifecycleStage =
      body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "snoozed";

    await recordLifecycleEvent({
      storeId,
      recommendationId: body.recommendationId,
      eventType: lifecycleEvent,
      stage: lifecycleStage,
      detail: body.title,
    });

    const audit = await getLatestAuditByRecommendationId(storeId, body.recommendationId);
    if (audit) {
      await updateAuditOutcome(audit.id, {
        outcomeStatus: body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "pending",
      });
    }
  } else if (body.opportunityKey) {
    const historyStatus =
      body.action === "approve" ? "resolved" : body.action === "reject" ? "ignored" : "viewed";
    await recordDecisionAction(storeId, body.opportunityKey, historyStatus, {
      title: body.title,
      category: "decision",
      confidencePct: body.confidencePct ?? 0,
    });
  } else {
    return NextResponse.json({ error: "No decision target" }, { status: 400 });
  }

  if (!body.recommendationId) {
    await mirrorDecisionToRecommendations(storeId, body.action, {
      entityId: body.entityId,
      entityType: body.entityType,
      opportunityKey: body.opportunityKey,
    });
  }

  let execution = null;
  let observation: { measureDueAt: string; measurementWindowDays: number } | null = null;
  const futureAction = body.futureAction as FutureActionType | undefined;
  const entityType = toExecutionEntityType(body.entityType);

  if (
    body.action === "approve" &&
    futureAction &&
    isExecutableAction(futureAction) &&
    body.platform &&
    body.entityId &&
    entityType
  ) {
    execution = await executeApprovedAction({
      storeId,
      actionType: futureAction,
      platform: body.platform as ExecutionPlatform,
      entityType,
      entityId: body.entityId,
      entityName: body.entityName ?? body.title,
      decisionId: body.decisionId,
      recommendationId: body.recommendationId,
      opportunityKey: body.opportunityKey,
      approvedBy: body.approvedBy ?? "Merchant",
      params: body.executionParams as ExecutionParams | undefined,
    });
  }

  if (body.action === "approve" && execution?.success && futureAction) {
    const record = await scheduleOutcomeFromExecution({
      storeId,
      title: body.title,
      futureAction,
      platform: body.platform,
      entityType: body.entityType,
      entityId: body.entityId,
      entityName: body.entityName,
      decisionId: body.decisionId,
      recommendationId: body.recommendationId,
      opportunityKey: body.opportunityKey,
      actionExecutionId: execution.logId,
      execution,
      expectedImpactLabel: body.expectedImpactLabel,
    });
    if (record) {
      observation = {
        measureDueAt: record.measureDueAt,
        measurementWindowDays: record.measurementWindowDays,
      };
    }
  } else if (body.action === "approve" && body.recommendationId) {
    const rec = await getRecommendationById(body.recommendationId);
    const { snapshot } = await getVerifiedStoreData(storeId);
    const baselineMetrics = captureKpisForEntity(
      snapshot,
      body.entityType ?? rec?.entityType,
      body.entityId ?? rec?.entityId,
    );
    const record = await scheduleOutcomeFromRecommendation({
      storeId,
      recommendationId: body.recommendationId,
      title: body.title,
      category: rec?.category ?? body.recommendationCategory ?? "decision",
      entityType: body.entityType ?? rec?.entityType,
      entityId: body.entityId ?? rec?.entityId,
      expectedMonthlyImpact: parseImpactFromLabel(body.expectedImpactLabel ?? rec?.expectedImpact ?? "0"),
      baselineMetrics,
    });
    observation = {
      measureDueAt: record.measureDueAt,
      measurementWindowDays: record.measurementWindowDays,
    };
  }

  revalidatePath("/");
  revalidatePath("/decisions");
  revalidatePath("/ask-ai");
  revalidatePath("/approvals");
  revalidatePath("/history");

  return NextResponse.json({
    ok: true,
    execution,
    observation,
  });
}
