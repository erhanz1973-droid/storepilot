import type { StoreSnapshot } from "@/lib/connectors/types";
import type { OutcomeRecord } from "@/lib/learning/outcome-types";
import { listOutcomeRecords } from "@/lib/db/outcome-records";
import { listRecommendationHistory } from "@/lib/db/recommendations";
import type { Recommendation } from "@/lib/types";
import { recommendationRepository } from "@/lib/recommendations/repository";
import type { CreateRecommendationInput } from "@/lib/recommendations/types";
import {
  analyzeInventoryContext,
  inventoryAssumptionText,
  inventoryCrossModuleImpact,
} from "./inventory-context";
import {
  buildExecutiveSummary,
  buildObjectiveReconciliation,
  buildOpportunityCost,
  buildOptimizationWorkflow,
} from "./executive-summary";
import type { AcquisitionMetrics, AttributionConfidence } from "./models";
import type {
  ActionImpactProfile,
  AttributionHistoryEntry,
  AttributionStrategyAction,
  AttributionStrategyPlan,
  AttributionStrategyPlanCore,
  ConfidenceBreakdown,
  CrossModuleImpact,
  ImpactVerificationStatus,
  LearningFeedback,
  RecommendationDependency,
  RecommendationExpiration,
  StrategyAssumption,
} from "./decision-engine-types";

const ATTRIBUTION_VALIDITY_DAYS = 7;

const ATTRIBUTION_CATEGORIES = new Set([
  "campaign_review",
  "marketing_attribution",
  "advertising_efficiency",
  "marketing",
]);

function isAttributionRelated(title: string, dedupeKey?: string, category?: string): boolean {
  if (category && ATTRIBUTION_CATEGORIES.has(category)) return true;
  if (dedupeKey && /^(reduce-|scale-|pause-|reallocate-|shift-|refresh-|dup-)/.test(dedupeKey)) {
    return true;
  }
  const t = title.toLowerCase();
  return (
    t.includes("budget") ||
    t.includes("prospect") ||
    t.includes("retarget") ||
    t.includes("creative") ||
    t.includes("meta") ||
    t.includes("google ads") ||
    t.includes("roas") ||
    t.includes("campaign")
  );
}

function formatIsoDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function estimateProfitFromMetrics(
  metrics: { spend7d?: number; roas7d?: number; revenue7d?: number },
  contributionMarginPct: number,
): number | undefined {
  const spend = metrics.spend7d;
  const revenue =
    metrics.revenue7d ??
    (metrics.roas7d != null && spend != null ? metrics.roas7d * spend : undefined);
  if (revenue == null || spend == null) return undefined;
  const monthlyScale = 30 / 7;
  return Math.round((revenue * (contributionMarginPct / 100) - spend) * monthlyScale);
}

export function buildConfidenceBreakdown(input: {
  confidence: AttributionConfidence;
  stability: AttributionStrategyPlan["stability"];
  paidCampaignCount: number;
  journeyCount: number;
  overallPct: number;
}): ConfidenceBreakdown {
  const sampleSizePct = Math.min(
    100,
    Math.round(
      Math.min(input.paidCampaignCount / 5, 1) * 40 +
        Math.min(input.journeyCount / 30, 1) * 60,
    ),
  );

  const historicalStabilityPct =
    input.stability.status === "Stable"
      ? 88
      : input.stability.status === "Monitoring"
        ? 72
        : 58;

  const attributionQualityPct = Math.round(
    input.confidence.identityResolutionPct * 0.45 + input.confidence.scorePct * 0.55,
  );

  return {
    dataCompletenessPct: input.confidence.trackingCompletenessPct,
    attributionQualityPct,
    historicalStabilityPct,
    sampleSizePct,
    overallPct: input.overallPct,
  };
}

export function buildRecommendationExpiration(syncedAt: string): RecommendationExpiration {
  const generatedAt = syncedAt;
  const validUntil = new Date(
    new Date(syncedAt).getTime() + ATTRIBUTION_VALIDITY_DAYS * 86400000,
  ).toISOString();
  const isExpired = Date.now() > new Date(validUntil).getTime();

  return {
    generatedAt,
    validUntil,
    validityDays: ATTRIBUTION_VALIDITY_DAYS,
    isExpired,
    message: isExpired
      ? "This recommendation has expired — refresh attribution data before acting."
      : "New campaign data may change this recommendation.",
  };
}

export function buildActionDependencies(
  action: Pick<AttributionStrategyAction, "title" | "isLastResort">,
  confidence: AttributionConfidence,
): RecommendationDependency[] {
  const isBudgetChange =
    action.title.toLowerCase().includes("reduce") ||
    action.title.toLowerCase().includes("increase") ||
    action.title.toLowerCase().includes("shift") ||
    action.title.toLowerCase().includes("move budget");

  if (!isBudgetChange) {
    return [
      {
        id: "review-context",
        label: "Review campaign context before executing",
        met: true,
        required: false,
      },
    ];
  }

  return [
    {
      id: "verify-tracking",
      label: "Verify tracking",
      met: confidence.trackingCompletenessPct >= 80,
      required: true,
    },
    {
      id: "review-creative",
      label: "Review creative performance",
      met: confidence.scorePct >= 60,
      required: true,
    },
    {
      id: "confirm-attribution",
      label: "Confirm attribution quality",
      met: confidence.identityResolutionPct >= 70 && confidence.level !== "Low",
      required: true,
    },
  ];
}

export function buildStrategyAssumptions(input: {
  confidence: AttributionConfidence;
  conversionStable: boolean;
  snapshot: StoreSnapshot;
  contributionMarginPct: number;
}): StrategyAssumption[] {
  const inventory = analyzeInventoryContext(input.snapshot);
  const inventoryAssumption = inventoryAssumptionText(inventory);

  return [
    {
      id: "conversion-stable",
      text: "Current conversion rate remains stable.",
      valid: input.conversionStable,
    },
    {
      id: "pricing-stable",
      text: "Product pricing does not change.",
      valid: true,
    },
    {
      id: "inventory-available",
      text: inventoryAssumption.text,
      valid: inventoryAssumption.valid,
    },
    {
      id: "tracking-quality",
      text: "Tracking quality remains above 80%.",
      valid: input.confidence.trackingCompletenessPct >= 80,
    },
    {
      id: "margin-stable",
      text: `Contribution margin (~${input.contributionMarginPct.toFixed(1)}%) remains stable.`,
      valid: input.contributionMarginPct > 0,
    },
  ];
}

function buildActionWorkflowSteps(
  action: Pick<AttributionStrategyAction, "title">,
  strategy: AttributionStrategyPlan["strategy"],
  breakEvenRoas: number,
): import("./decision-engine-types").OptimizationWorkflowStep[] {
  const title = action.title.toLowerCase();
  if (title.includes("refresh") || title.includes("landing") || title.includes("duplicate")) {
    return [
      { step: 1, label: action.title },
      { step: 2, label: "Wait 7 days for performance to stabilize", waitDays: 7 },
      { step: 3, label: `Recalculate ROAS against break-even (${breakEvenRoas.toFixed(2)})` },
      { step: 4, label: "Adjust budget only if ROAS remains below break-even" },
    ];
  }
  if (title.includes("reduce") || title.includes("pause") || title.includes("shift")) {
    return buildOptimizationWorkflow(strategy, breakEvenRoas);
  }
  return [{ step: 1, label: action.title }];
}

export function buildCrossModuleImpacts(input: {
  action: Pick<AttributionStrategyAction, "title" | "estimatedMonthlyImprovement">;
  snapshot: StoreSnapshot;
  acquisition: AcquisitionMetrics;
}): CrossModuleImpact[] {
  const inventory = analyzeInventoryContext(input.snapshot);
  const inventoryImpact = inventoryCrossModuleImpact(inventory, input.action.title);

  const repeatRate =
    input.acquisition.newCustomers + input.acquisition.returningCustomers > 0
      ? Math.round(
          (input.acquisition.returningCustomers /
            (input.acquisition.newCustomers + input.acquisition.returningCustomers)) *
            100,
        )
      : null;

  return [
    {
      module: "Marketing",
      headline: input.action.title,
      detail: "Primary advertising action",
      verificationStatus: "Estimated",
    },
    {
      module: "Inventory",
      headline: inventoryImpact.headline,
      detail: inventoryImpact.detail,
      verificationStatus: inventoryImpact.verificationStatus,
      severity: inventory.severity,
    },
    {
      module: "Profit",
      headline: `Expected recovery +$${input.action.estimatedMonthlyImprovement.toLocaleString()}/mo`,
      detail: "Based on simulated contribution margin impact",
      verificationStatus: "Simulated",
    },
    {
      module: "Customer",
      headline:
        repeatRate != null ? `${repeatRate}% returning customers` : "Customer mix unknown",
      detail:
        repeatRate != null && repeatRate >= 30
          ? "Repeat purchase opportunity after acquisition efficiency improves."
          : "Monitor new vs returning mix after budget changes.",
      verificationStatus: repeatRate != null ? "Estimated" : "Simulated",
    },
  ];
}

function defaultActionImpact(
  action: Pick<AttributionStrategyAction, "id" | "estimatedMonthlyImprovement">,
): ActionImpactProfile {
  return {
    simulationStatus: "Simulated",
    estimatedMonthlyImprovement: action.estimatedMonthlyImprovement,
    observedMonthlyImprovement: null,
    observedStatus: null,
  };
}

function mapRecommendationStatus(rec: Recommendation): AttributionHistoryEntry["status"] {
  switch (rec.status) {
    case "implemented":
    case "approved":
      return "Applied";
    case "measured":
    case "completed":
      return "Measured";
    case "ignored":
      return "Ignored";
    case "snoozed":
      return "Dismissed";
    default:
      return "Pending";
  }
}

function outcomeToLearningFeedback(
  outcome: OutcomeRecord,
  contributionMarginPct: number,
): LearningFeedback {
  const verified = outcome.measureStatus === "completed" && outcome.outcomeMetrics != null;
  const before = outcome.baselineMetrics;
  const after = outcome.outcomeMetrics ?? undefined;

  let status: LearningFeedback["status"] = "Pending measurement";
  if (outcome.measureStatus === "completed") {
    if (outcome.outcomeRating === "successful") status = "Successful";
    else if (outcome.outcomeRating === "needs_improvement") status = "Underperforming";
    else status = "Inconclusive";
  }

  return {
    recommendationTitle: outcome.title,
    recommendationId: outcome.recommendationId ?? undefined,
    outcomeId: outcome.id,
    appliedAt: formatIsoDate(outcome.baselineCapturedAt),
    verificationStatus: verified ? "Verified" : "Estimated",
    before: {
      spend: before.spend7d,
      roas: before.roas7d,
      profit: estimateProfitFromMetrics(before, contributionMarginPct),
    },
    after: after
      ? {
          spend: after.spend7d,
          roas: after.roas7d,
          profit: estimateProfitFromMetrics(after, contributionMarginPct),
        }
      : undefined,
    estimatedImprovement: outcome.expectedMonthlyImpact,
    observedImprovement: outcome.actualMonthlyImpact,
    resultSummary: outcome.outcomeSummary ?? undefined,
    status,
  };
}

function recommendationToHistoryEntry(rec: Recommendation): AttributionHistoryEntry {
  const eventDate = rec.implementedAt ?? rec.approvedAt ?? rec.createdAt;
  let verificationStatus: ImpactVerificationStatus | undefined;
  if (rec.measuredAt && rec.outcomeMetrics) verificationStatus = "Verified";
  else if (rec.implementedAt) verificationStatus = "Estimated";

  return {
    date: formatShortDate(eventDate),
    isoDate: formatIsoDate(eventDate),
    title: rec.title,
    status: mapRecommendationStatus(rec),
    verificationStatus,
  };
}

function matchOutcomeToAction(
  action: AttributionStrategyAction,
  outcomes: OutcomeRecord[],
): OutcomeRecord | undefined {
  return outcomes.find(
    (o) =>
      o.opportunityKey === action.id ||
      o.title.toLowerCase() === action.title.toLowerCase() ||
      (o.opportunityKey != null && action.id.includes(o.opportunityKey)),
  );
}

type PlanActionBase = import("./decision-engine-types").AttributionStrategyActionCore;

export function enrichStrategyPlanSync(input: {
  plan: AttributionStrategyPlanCore;
  confidence: AttributionConfidence;
  syncedAt: string;
  snapshot: StoreSnapshot;
  acquisition: AcquisitionMetrics;
  journeyCount: number;
  paidCampaignCount: number;
  conversionStable: boolean;
}): AttributionStrategyPlan {
  const contributionMarginPct = input.plan.breakEvenModel.contributionMarginPct;

  const assumptions = buildStrategyAssumptions({
    confidence: input.confidence,
    conversionStable: input.conversionStable,
    snapshot: input.snapshot,
    contributionMarginPct,
  });

  const invalidAssumptionCount = assumptions.filter((a) => !a.valid).length;
  const adjustedConfidence = Math.max(55, input.plan.confidencePct - invalidAssumptionCount * 4);

  const confidenceBreakdown = buildConfidenceBreakdown({
    confidence: input.confidence,
    stability: input.plan.stability,
    paidCampaignCount: input.paidCampaignCount,
    journeyCount: input.journeyCount,
    overallPct: adjustedConfidence,
  });

  const actions: AttributionStrategyAction[] = input.plan.actions.map((action) => ({
    ...action,
    impact: defaultActionImpact(action),
    dependencies: buildActionDependencies(action, input.confidence),
    crossModuleImpacts: buildCrossModuleImpacts({
      action,
      snapshot: input.snapshot,
      acquisition: input.acquisition,
    }),
    opportunityCost: buildOpportunityCost({
      action,
      acquisition: input.acquisition,
      totalAdSpend: input.plan.metricsSummary.totalSpend,
    }),
    workflowSteps: buildActionWorkflowSteps(
      action,
      input.plan.strategy,
      input.plan.breakEvenModel.breakEvenRoas,
    ),
  }));

  const optimizationWorkflow = buildOptimizationWorkflow(
    input.plan.strategy,
    input.plan.breakEvenModel.breakEvenRoas,
  );

  const objectiveReconciliation = buildObjectiveReconciliation(input.plan);

  const executiveSummary = buildExecutiveSummary({
    plan: input.plan,
    netProfit: input.plan.metricsSummary.netProfit,
    cacGapPct: input.plan.metricsSummary.cacGapPct,
    roasGapPct: input.plan.metricsSummary.roasGapPct,
  });

  return {
    ...input.plan,
    confidencePct: adjustedConfidence,
    confidenceBreakdown,
    expiration: buildRecommendationExpiration(input.syncedAt),
    assumptions,
    learningFeedback: [],
    recommendationHistory: [],
    executiveSummary,
    objectiveReconciliation,
    optimizationWorkflow,
    simulation: {
      ...input.plan.simulation,
      verificationStatus: "Simulated",
    },
    actions,
  };
}

export async function enrichStrategyPlanAsync(
  storeId: string,
  plan: AttributionStrategyPlan,
): Promise<AttributionStrategyPlan> {
  const [outcomes, history] = await Promise.all([
    listOutcomeRecords(storeId, 40),
    listRecommendationHistory(storeId),
  ]);

  const attributionOutcomes = outcomes.filter(
    (o) =>
      isAttributionRelated(o.title, o.opportunityKey ?? undefined, o.category) ||
      plan.actions.some((a) => a.id === o.opportunityKey),
  );

  const attributionHistory = history
    .filter((h) =>
      isAttributionRelated(h.recommendation.title, undefined, h.recommendation.category),
    )
    .slice(0, 12)
    .map((h) => recommendationToHistoryEntry(h.recommendation));

  const learningFeedback = attributionOutcomes
    .filter((o) => o.baselineCapturedAt)
    .slice(0, 5)
    .map((o) => outcomeToLearningFeedback(o, plan.breakEvenModel.contributionMarginPct));

  const actions = plan.actions.map((action) => {
    const outcome = matchOutcomeToAction(action, attributionOutcomes);
    if (!outcome) return action;

    const verified =
      outcome.measureStatus === "completed" && outcome.actualMonthlyImpact != null;

    return {
      ...action,
      impact: {
        simulationStatus: "Simulated" as const,
        estimatedMonthlyImprovement: action.estimatedMonthlyImprovement,
        observedMonthlyImprovement: outcome.actualMonthlyImpact,
        observedStatus: verified ? ("Verified" as const) : ("Estimated" as const),
        matchedRecommendationId: outcome.recommendationId ?? undefined,
        matchedOutcomeId: outcome.id,
      },
    };
  });

  await syncAttributionRecommendations(storeId, plan);

  return {
    ...plan,
    actions,
    learningFeedback,
    recommendationHistory: attributionHistory,
  };
}

export function planActionsToRecommendationInputs(
  storeId: string,
  plan: AttributionStrategyPlan,
): CreateRecommendationInput[] {
  return plan.actions.map((action) => ({
    storeId,
    dedupeKey: action.id,
    recommendationType: "marketing_attribution",
    priority: action.isLastResort ? "high" : "medium",
    title: action.title,
    description: action.description,
    reason: action.reason,
    expectedImpact: `+$${action.estimatedMonthlyImprovement.toLocaleString()}/mo (simulated)`,
    confidence: action.confidencePct / 100,
    estimatedCostSaving: action.estimatedMonthlyImprovement,
    evidence: {
      supportingMetrics: [
        { label: "Strategy", value: plan.strategyLabel },
        { label: "Risk", value: action.riskLevel },
        { label: "Impact type", value: action.impact.simulationStatus },
        { label: "Break-even ROAS", value: plan.breakEvenModel.breakEvenRoas.toFixed(2) },
      ],
      providerSources: ["attribution_decision_engine"],
    },
    entityType: "attribution_action",
    entityId: action.id,
    status: "pending",
  }));
}

async function syncAttributionRecommendations(
  storeId: string,
  plan: AttributionStrategyPlan,
): Promise<void> {
  const inputs = planActionsToRecommendationInputs(storeId, plan);
  if (inputs.length === 0) return;
  try {
    await recommendationRepository.upsertBatch(inputs);
  } catch (err) {
    console.warn("[StorePilot] attribution recommendation sync skipped:", err);
  }
}

export function expirationLabel(expiration: RecommendationExpiration): string {
  const ageDays = daysAgo(expiration.generatedAt);
  if (ageDays === 0) return "Today";
  if (ageDays === 1) return "1 day ago";
  return `${ageDays} days ago`;
}

export function validUntilLabel(expiration: RecommendationExpiration): string {
  const remaining = Math.ceil(
    (new Date(expiration.validUntil).getTime() - Date.now()) / 86400000,
  );
  if (remaining <= 0) return "Expired";
  if (remaining === 1) return "1 day";
  return `${remaining} days`;
}
