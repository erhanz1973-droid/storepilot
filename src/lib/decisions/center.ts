import { getActionCapability, type FutureActionType } from "@/lib/insights/actions";
import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";
import type { PriorityQueueItem } from "@/lib/insights/types";
import type { OpportunityHistoryRecord } from "@/lib/opportunities/history";
import type { Recommendation } from "@/lib/types";
import type { AIEvent } from "@/lib/monitoring/types";
import type { MetaCampaign } from "@/lib/connectors/types";
import {
  resolveExecutionAvailability,
} from "@/lib/execution/availability";
import type { ExecutionAvailability, ExecutionPlatform } from "@/lib/execution/types";
import type { ExecutionParams } from "@/lib/execution/params";
import type { OutcomeRecord } from "@/lib/learning/outcome-types";
import { buildOutcomeDisplayMetrics } from "@/lib/learning/metrics";
import type { ShopifyCollection, ShopifyProduct } from "@/lib/connectors/types";
import {
  collectGroupedProductIds,
  type AffectedEntity,
} from "@/lib/insights/business-action-groups";
import type { StrategyComparisonResult } from "@/lib/decisions/strategy-comparison";
import type { ProfitWaterfall } from "@/lib/decisions/product-economics";
import type { MerchantMode } from "@/lib/decisions/merchant-mode";
import type {
  DecisionConfidenceBreakdown,
  DecisionExplainability,
  ModeWeightDisplay,
  StrategyWinnerExplanation,
} from "@/lib/decisions/engine/types";
import {
  buildShopifyReconnectUrl,
  buildShopifyScopeBlockerMessage,
  missingScopesForShopifyAction,
} from "@/lib/shopify/scopes";

export type DecisionStatus =
  | "open"
  | "viewed"
  | "accepted"
  | "ignored"
  | "resolved"
  | "expired"
  | "snoozed";

export type DecisionItem = {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  summary: string;
  why: string;
  supportingMetrics: { label: string; value: string }[];
  confidencePct: number;
  estimatedImpactLabel: string;
  recommendedAction: string;
  status: DecisionStatus;
  futureAction?: FutureActionType;
  actionAvailable: boolean;
  executionAvailability: ExecutionAvailability;
  platform?: ExecutionPlatform;
  entityType?: "campaign" | "product" | "channel" | "collection" | "audience";
  entityId?: string;
  entityName?: string;
  executionParams?: ExecutionParams;
  source: "insight" | "opportunity" | "alert" | "event" | "recommendation";
  sourceId: string;
  recommendationId?: string;
  opportunityKey?: string;
  priorityScore: number;
  outcome?: DecisionOutcomeView;
  /** Validation framework metadata (when recommendation passed gate) */
  validation?: import("@/lib/recommendations/validation/types").RecommendationValidationMeta;
  validationGate?: import("@/lib/recommendations/validation/types").ValidationGateReport;
  providerFreshness?: import("@/lib/recommendations/validation/types").ProviderValidationState[];
  groupKey?: string;
  isGroupedAction?: boolean;
  affectedEntities?: AffectedEntity[];
  memberOpportunityIds?: string[];
  missingShopifyScopes?: string[];
  executionBlocker?: string;
  shopifyReconnectUrl?: string;
  /** Phase 2.2 — strategy comparison & explainability */
  strategyComparison?: StrategyComparisonResult;
  confidenceBreakdown?: DecisionConfidenceBreakdown;
  explainability?: DecisionExplainability;
  profitWaterfall?: ProfitWaterfall;
  modeWeights?: ModeWeightDisplay[];
  merchantMode?: MerchantMode;
  strategyExplanation?: StrategyWinnerExplanation;
  mergedFrom?: string[];
  problemKey?: string;
};

export type DecisionOutcomeView = {
  measureStatus: OutcomeRecord["measureStatus"];
  measureDueAt: string;
  measuredAt?: string | null;
  measurementWindowDays: number;
  outcomeRating?: OutcomeRecord["outcomeRating"];
  outcomeSummary?: string | null;
  aiVerdict?: string | null;
  confidenceLabel?: string | null;
  predictionAccuracy?: number | null;
  displayMetrics: { label: string; value: string; trend?: "up" | "down" | "neutral" }[];
};

const SEVERITY_RANK: Record<DecisionItem["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function mapRecStatus(status?: string): DecisionStatus {
  switch (status) {
    case "approved":
    case "implemented":
      return "accepted";
    case "ignored":
      return "ignored";
    case "completed":
    case "measured":
      return "resolved";
    case "snoozed":
      return "snoozed";
    default:
      return "open";
  }
}

function mapHistoryStatus(status: OpportunityHistoryRecord["status"]): DecisionStatus {
  switch (status) {
    case "ignored":
      return "ignored";
    case "resolved":
      return "resolved";
    case "expired":
      return "expired";
    case "viewed":
      return "viewed";
    default:
      return "open";
  }
}

export function buildDecisionCenter(input: {
  priorityQueue: PriorityQueueItem[];
  opportunities: CommerceOpportunity[];
  recommendations: Recommendation[];
  aiEvents: AIEvent[];
  opportunityHistory?: OpportunityHistoryRecord[];
  allRecommendations?: Recommendation[];
  metaConnected?: boolean;
  shopifyConnected?: boolean;
  shopifyScopes?: string[];
  shopifyShopDomain?: string | null;
  campaigns?: MetaCampaign[];
  products?: ShopifyProduct[];
  collections?: ShopifyCollection[];
  outcomeRecords?: OutcomeRecord[];
  validationGate?: import("@/lib/recommendations/validation/types").ValidationGateReport;
  recommendationAudits?: import("@/lib/recommendations/validation/types").RecommendationAuditRecord[];
}): DecisionItem[] {
  const items: DecisionItem[] = [];
  const seen = new Set<string>();
  const historyByKey = new Map(
    (input.opportunityHistory ?? []).map((h) => [h.opportunityKey, h]),
  );
  const outcomeByOpportunity = new Map(
    (input.outcomeRecords ?? [])
      .filter((o) => o.opportunityKey)
      .map((o) => [o.opportunityKey!, o]),
  );
  const outcomeByDecision = new Map(
    (input.outcomeRecords ?? [])
      .filter((o) => o.decisionId)
      .map((o) => [o.decisionId!, o]),
  );
  const recById = new Map(
    (input.allRecommendations ?? input.recommendations).map((r) => [r.id, r]),
  );
  const auditByRecId = new Map(
    (input.recommendationAudits ?? [])
      .filter((a) => a.recommendationId)
      .map((a) => [a.recommendationId!, a]),
  );
  const auditByTitle = new Map(
    (input.recommendationAudits ?? []).map((a) => [a.title, a]),
  );
  const groupedProductIds = collectGroupedProductIds(input.opportunities);

  function resolveStatus(keys: {
    opportunityKey?: string;
    recommendationId?: string;
  }): DecisionStatus {
    if (keys.recommendationId) {
      const rec = recById.get(keys.recommendationId);
      if (rec) return mapRecStatus(rec.status);
    }
    if (keys.opportunityKey) {
      const history = historyByKey.get(keys.opportunityKey);
      if (history) return mapHistoryStatus(history.status);
    }
    return "open";
  }

  function parseEventCampaignId(eventId: string): string | undefined {
    const match = eventId.match(/^mon-campaign-zero-(.+)$/);
    return match?.[1];
  }

  function toPlatform(source?: string): ExecutionPlatform | undefined {
    if (source === "meta_ads") return "meta_ads";
    if (source === "google_ads") return "google_ads";
    if (source === "shopify") return "shopify";
    return undefined;
  }

  function resolveOutcome(keys: {
    opportunityKey?: string;
    decisionId?: string;
  }): DecisionOutcomeView | undefined {
    const record =
      (keys.decisionId ? outcomeByDecision.get(keys.decisionId) : undefined) ??
      (keys.opportunityKey ? outcomeByOpportunity.get(keys.opportunityKey) : undefined);
    if (!record) return undefined;

    const displayMetrics =
      record.measureStatus === "completed" && record.kpiDeltas
        ? buildOutcomeDisplayMetrics(
            record.actionType,
            record.kpiDeltas,
            record.actualMonthlyImpact ?? 0,
          )
        : [];

    return {
      measureStatus: record.measureStatus,
      measureDueAt: record.measureDueAt,
      measuredAt: record.measuredAt,
      measurementWindowDays: record.measurementWindowDays,
      outcomeRating: record.outcomeRating ?? undefined,
      outcomeSummary: record.outcomeSummary,
      aiVerdict: record.aiVerdict,
      confidenceLabel: record.confidenceLabel,
      predictionAccuracy: record.predictionAccuracy,
      displayMetrics,
    };
  }

  function campaignName(entityId?: string): string | undefined {
    if (!entityId) return undefined;
    return (input.campaigns ?? []).find((c) => c.id === entityId)?.name;
  }

  function productName(entityId?: string): string | undefined {
    if (!entityId) return undefined;
    return (input.products ?? []).find((p) => p.id === entityId)?.title;
  }

  function collectionName(entityId?: string): string | undefined {
    if (!entityId) return undefined;
    return (input.collections ?? []).find((c) => c.id === entityId)?.title;
  }

  function resolveEntityName(
    entityType?: DecisionItem["entityType"],
    entityId?: string,
    fallback?: string,
  ): string | undefined {
    if (fallback) return fallback;
    if (entityType === "campaign") return campaignName(entityId);
    if (entityType === "product") return productName(entityId);
    if (entityType === "collection") return collectionName(entityId);
    return undefined;
  }

  function buildExecutionFields(fields: {
    futureAction?: FutureActionType;
    platform?: ExecutionPlatform;
    entityType?: DecisionItem["entityType"];
    entityId?: string;
    entityName?: string;
    executionParams?: ExecutionParams;
    actionAvailable: boolean;
  }): Pick<
    DecisionItem,
    | "futureAction"
    | "actionAvailable"
    | "executionAvailability"
    | "platform"
    | "entityType"
    | "entityId"
    | "entityName"
    | "executionParams"
    | "missingShopifyScopes"
    | "executionBlocker"
    | "shopifyReconnectUrl"
  > {
    const entityName = resolveEntityName(fields.entityType, fields.entityId, fields.entityName);
    const missingShopifyScopes =
      fields.platform === "shopify"
        ? missingScopesForShopifyAction(input.shopifyScopes, fields.futureAction)
        : [];
    const executionBlocker =
      missingShopifyScopes.length > 0
        ? buildShopifyScopeBlockerMessage(missingShopifyScopes)
        : undefined;
    const shopifyReconnectUrl =
      missingShopifyScopes.length > 0 && input.shopifyShopDomain
        ? buildShopifyReconnectUrl(input.shopifyShopDomain)
        : undefined;

    return {
      futureAction: fields.futureAction,
      actionAvailable: fields.actionAvailable,
      executionAvailability: resolveExecutionAvailability({
        futureAction: fields.futureAction,
        platform: fields.platform,
        entityId: fields.entityId,
        metaConnected: input.metaConnected ?? false,
        shopifyConnected: input.shopifyConnected ?? false,
        shopifyScopes: input.shopifyScopes,
      }),
      platform: fields.platform,
      entityType: fields.entityType,
      entityId: fields.entityId,
      entityName,
      executionParams: fields.executionParams,
      missingShopifyScopes: missingShopifyScopes.length > 0 ? missingShopifyScopes : undefined,
      executionBlocker,
      shopifyReconnectUrl,
    };
  }

  for (const e of input.aiEvents) {
    if (seen.has(e.title)) continue;
    seen.add(e.title);
    const opportunityKey = `event-${e.id}`;
    const campaignId = parseEventCampaignId(e.id);
    items.push({
      id: `dec-event-${e.id}`,
      priority: e.severity === "critical" ? "critical" : e.severity === "warning" ? "high" : "medium",
      summary: e.title,
      why: e.description,
      supportingMetrics: e.evidence,
      confidencePct: e.confidencePct,
      estimatedImpactLabel: e.estimatedImpact?.label ?? "See impact estimate",
      recommendedAction: e.recommendation,
      status: resolveStatus({ opportunityKey }),
      ...buildExecutionFields({
        futureAction: e.futureAction,
        platform: campaignId ? "meta_ads" : undefined,
        entityType: campaignId ? "campaign" : undefined,
        entityId: campaignId,
        actionAvailable: e.actionAvailable,
      }),
      source: "event",
      sourceId: e.id,
      opportunityKey,
      recommendationId: undefined,
      priorityScore: e.severity === "critical" ? 1000 : e.severity === "warning" ? 500 : 200,
      outcome: resolveOutcome({ opportunityKey, decisionId: `dec-event-${e.id}` }),
    });
  }

  for (const opp of input.opportunities) {
    if (seen.has(opp.id)) continue;
    seen.add(opp.id);
    const action = opp.futureAction ? getActionCapability(opp.futureAction) : undefined;
    items.push({
      id: `dec-opp-${opp.id}`,
      priority: opp.severity,
      summary: opp.title,
      why: opp.why.map((w) => `${w.label}: ${w.value}`).join(" · "),
      supportingMetrics: opp.supportingMetrics,
      confidencePct: opp.confidence,
      estimatedImpactLabel: opp.expectedImpact.label,
      recommendedAction: opp.recommendation,
      status: resolveStatus({ opportunityKey: opp.id }),
      ...buildExecutionFields({
        futureAction: opp.futureAction,
        platform: toPlatform(opp.source),
        entityType: opp.relatedEntityType,
        entityId: opp.relatedEntityId,
        executionParams: opp.executionParams,
        actionAvailable: action?.available ?? false,
      }),
      source: "insight",
      sourceId: opp.id,
      opportunityKey: opp.id,
      recommendationId: undefined,
      priorityScore: opp.priorityScore,
      outcome: resolveOutcome({ opportunityKey: opp.id, decisionId: `dec-opp-${opp.id}` }),
      groupKey: opp.groupKey,
      isGroupedAction: opp.isGroupedAction,
      affectedEntities: opp.affectedEntities,
      memberOpportunityIds: opp.memberOpportunityIds,
    });
  }

  for (const pq of input.priorityQueue) {
    if (seen.has(pq.title)) continue;
    seen.add(pq.title);
    const action = pq.futureAction ? getActionCapability(pq.futureAction) : undefined;
    const opportunityKey = pq.opportunityId ?? pq.insightId;
    const linkedOpp = opportunityKey
      ? input.opportunities.find((o) => o.id === opportunityKey)
      : undefined;
    items.push({
      id: pq.id,
      priority: pq.priority,
      summary: pq.title,
      why: pq.summary,
      supportingMetrics: [],
      confidencePct: pq.confidence,
      estimatedImpactLabel: pq.expectedImpactLabel || "See impact estimate",
      recommendedAction: pq.summary,
      status: resolveStatus({ opportunityKey, recommendationId: pq.recommendationId }),
      ...buildExecutionFields({
        futureAction: pq.futureAction ?? linkedOpp?.futureAction,
        platform: linkedOpp ? toPlatform(linkedOpp.source) : undefined,
        entityType: linkedOpp?.relatedEntityType,
        entityId: linkedOpp?.relatedEntityId,
        executionParams: linkedOpp?.executionParams,
        actionAvailable: action?.available ?? false,
      }),
      source: pq.source === "alert" ? "alert" : pq.source === "opportunity" ? "opportunity" : "insight",
      sourceId: pq.insightId ?? pq.opportunityId ?? pq.recommendationId ?? pq.id,
      recommendationId: pq.recommendationId,
      opportunityKey,
      priorityScore:
        pq.priority === "critical" ? 900 : pq.priority === "high" ? 600 : pq.priority === "medium" ? 300 : 100,
      outcome: resolveOutcome({ opportunityKey, decisionId: pq.id }),
    });
  }

  for (const rec of input.recommendations.filter((r) => r.severity === "critical" || r.severity === "high")) {
    if (rec.entityId && groupedProductIds.has(rec.entityId)) continue;
    const key = `rec-${rec.id}`;
    if (seen.has(rec.title)) continue;
    seen.add(rec.title);
    const audit =
      auditByRecId.get(rec.id) ??
      auditByTitle.get(rec.title);
    const validationFromAudit = audit
      ? {
          aiConfidence: audit.aiConfidence,
          validationConfidence: audit.validationConfidence,
          finalConfidence: audit.finalConfidence,
          validationScore: audit.validationScore,
          providersUsed: audit.providersUsed,
          providersBlocked: audit.providersBlocked,
          providersWarned: [],
          evidence: audit.evidence,
          calculationBasis: audit.calculationBasis,
          dateRangeVerified: true,
          blocked: false,
        }
      : undefined;

    items.push({
      id: key,
      priority: rec.severity,
      summary: rec.title,
      why: rec.reason,
      supportingMetrics: rec.supportingMetrics ?? [],
      confidencePct: Math.round(
        (validationFromAudit?.finalConfidence ?? rec.confidenceScore) * 100,
      ),
      estimatedImpactLabel: rec.expectedImpact,
      recommendedAction: rec.actionLabel,
      status: mapRecStatus(rec.status),
      ...buildExecutionFields({
        actionAvailable: false,
      }),
      source: "recommendation",
      sourceId: rec.id,
      recommendationId: rec.id,
      opportunityKey: undefined,
      priorityScore: rec.severity === "critical" ? 950 : 550,
      validation: validationFromAudit,
      validationGate: input.validationGate,
      providerFreshness: input.validationGate?.providers,
      outcome: resolveOutcome({ decisionId: key }),
    });
  }

  return items.sort(
    (a, b) =>
      SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority] ||
      b.priorityScore - a.priorityScore ||
      b.confidencePct - a.confidencePct,
  );
}
