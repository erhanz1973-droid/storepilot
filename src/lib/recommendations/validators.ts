import { z } from "zod";
import type { RecommendationDomainStatus } from "./types";

export const recommendationDomainStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "dismissed",
  "expired",
]);

export const recommendationEventTypeSchema = z.enum([
  "RecommendationCreated",
  "RecommendationViewed",
  "RecommendationApproved",
  "RecommendationRejected",
  "RecommendationDismissed",
]);

export const recommendationEvidenceSchema = z.object({
  supportingMetrics: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      trend: z.enum(["up", "down", "flat"]).optional(),
    }),
  ),
  validation: z.unknown().optional(),
  providerSources: z.array(z.string()),
});

export const createRecommendationSchema = z.object({
  storeId: z.string().uuid(),
  dedupeKey: z.string().min(1),
  recommendationType: z.string().min(1),
  priority: z.enum(["critical", "high", "medium", "low"]),
  title: z.string().min(1),
  description: z.string().min(1),
  reason: z.string().min(1),
  expectedImpact: z.string().min(1),
  confidence: z.number().min(0).max(1),
  validationScore: z.number().min(0).max(100).nullable().optional(),
  estimatedRevenueGain: z.number().nullable().optional(),
  estimatedCostSaving: z.number().nullable().optional(),
  evidence: recommendationEvidenceSchema,
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  status: recommendationDomainStatusSchema.optional(),
});

export const statusTransitionPayloadSchema = z.object({
  note: z.string().optional(),
  userId: z.string().uuid().optional(),
});

const VALID_TRANSITIONS: Record<
  RecommendationDomainStatus,
  RecommendationDomainStatus[]
> = {
  pending: ["approved", "rejected", "dismissed", "expired"],
  approved: ["dismissed", "expired"],
  rejected: [],
  dismissed: [],
  expired: [],
};

export function assertValidStatusTransition(
  from: RecommendationDomainStatus,
  to: RecommendationDomainStatus,
): void {
  if (from === to) return;
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid status transition: ${from} → ${to}`);
  }
}

export function isTerminalStatus(status: RecommendationDomainStatus): boolean {
  return status === "rejected" || status === "dismissed" || status === "expired";
}

export function eventTypeForStatus(
  status: RecommendationDomainStatus,
): "RecommendationApproved" | "RecommendationRejected" | "RecommendationDismissed" | null {
  switch (status) {
    case "approved":
      return "RecommendationApproved";
    case "rejected":
      return "RecommendationRejected";
    case "dismissed":
      return "RecommendationDismissed";
    default:
      return null;
  }
}
