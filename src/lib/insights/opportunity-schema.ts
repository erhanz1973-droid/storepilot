import type { SupportingMetric } from "@/lib/types";
import { sortSupportingMetricsByTier } from "@/lib/metrics/hierarchy";
import type { FutureActionType } from "./actions";
import type { ExecutionParams } from "@/lib/execution/params";
import type { InsightCategory } from "./types";
import type { AffectedEntity } from "./business-action-groups";

export type OpportunitySource =
  | "shopify"
  | "google_ads"
  | "meta_ads"
  | "ga4"
  | "klaviyo"
  | "merchant_center";

export type OpportunitySeverity = "critical" | "high" | "medium" | "low";

export type CommerceOpportunity = {
  id: string;
  source: OpportunitySource;
  severity: OpportunitySeverity;
  /** 0–100 */
  confidence: number;
  title: string;
  description: string;
  recommendation: string;
  expectedImpact: {
    revenueMonthly: number;
    profitMonthly: number;
    label: string;
  };
  supportingMetrics: SupportingMetric[];
  why: SupportingMetric[];
  createdAt: string;
  priorityScore: number;
  category: InsightCategory;
  futureAction?: FutureActionType;
  relatedEntityType?: "campaign" | "product" | "channel" | "collection" | "audience";
  relatedEntityId?: string;
  executionParams?: ExecutionParams;
  /** Stable key for grouped business actions (e.g. dead_inventory:clearance) */
  groupKey?: string;
  isGroupedAction?: boolean;
  affectedEntities?: AffectedEntity[];
  memberOpportunityIds?: string[];
};

const SEVERITY_WEIGHT: Record<OpportunitySeverity, number> = {
  critical: 1000,
  high: 500,
  medium: 200,
  low: 50,
};

export function computePriorityScore(input: {
  severity: OpportunitySeverity;
  confidence: number;
  revenueMonthly?: number;
  profitMonthly?: number;
  recencyBoost?: number;
}): number {
  const revenue = input.revenueMonthly ?? 0;
  const profit = input.profitMonthly ?? 0;
  const recency = input.recencyBoost ?? 10;
  return Math.round(
    SEVERITY_WEIGHT[input.severity] +
      profit * 2 +
      revenue * 0.5 +
      input.confidence * 5 +
      recency,
  );
}

export function createCommerceOpportunity(
  partial: Omit<
    CommerceOpportunity,
    "priorityScore" | "createdAt" | "why" | "expectedImpact"
  > & {
    expectedImpact?: Partial<CommerceOpportunity["expectedImpact"]>;
    why?: SupportingMetric[];
  },
): CommerceOpportunity {
  const rankedMetrics =
    partial.supportingMetrics.length > 0
      ? sortSupportingMetricsByTier(partial.supportingMetrics)
      : [];

  const why =
    partial.why && partial.why.length > 0
      ? sortSupportingMetricsByTier(partial.why)
      : rankedMetrics.length > 0
        ? rankedMetrics.slice(0, 5)
        : [{ label: "Data", value: "Insufficient synced metrics for full evidence" }];

  const revenueMonthly = partial.expectedImpact?.revenueMonthly ?? 0;
  const profitMonthly = partial.expectedImpact?.profitMonthly ?? 0;
  const label =
    partial.expectedImpact?.label ??
    (profitMonthly > 0
      ? `Est. +$${profitMonthly.toLocaleString()}/mo net profit`
      : revenueMonthly > 0
        ? `Est. +$${revenueMonthly.toLocaleString()}/mo revenue`
        : "Operational efficiency gain");

  return {
    ...partial,
    why,
    supportingMetrics: rankedMetrics.length > 0 ? rankedMetrics : why,
    expectedImpact: { revenueMonthly, profitMonthly, label },
    createdAt: new Date().toISOString(),
    priorityScore: computePriorityScore({
      severity: partial.severity,
      confidence: partial.confidence,
      revenueMonthly,
      profitMonthly,
    }),
  };
}

export function sortCommerceOpportunities(
  items: CommerceOpportunity[],
): CommerceOpportunity[] {
  return [...items].sort(
    (a, b) => b.priorityScore - a.priorityScore || b.confidence - a.confidence,
  );
}
