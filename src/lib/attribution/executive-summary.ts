import { formatRoas } from "./format-roas";
import type {
  ActionRiskLevel,
  AttributionExecutiveSummary,
  AttributionStrategyActionCore,
  AttributionStrategyId,
  AttributionStrategyPlanCore,
  ObjectiveReconciliation,
  OptimizationWorkflowStep,
  OpportunityCost,
} from "./decision-engine-types";
import type { AcquisitionMetrics } from "./models";

export function buildObjectiveReconciliation(
  plan: Pick<
    AttributionStrategyPlanCore,
    "businessObjective" | "businessObjectiveLabel" | "strategy" | "strategyLabel"
  >,
): ObjectiveReconciliation {
  const profitFocused = plan.strategy === "optimize" || plan.strategy === "reduce_budget";
  const revenueFocused = plan.strategy === "scale";
  const revenueObjective =
    plan.businessObjective === "maximize_revenue" || plan.businessObjective === "maximize_growth";

  if (revenueObjective && profitFocused) {
    return {
      statedObjective: plan.businessObjectiveLabel,
      selectedStrategyFocus: "Improve profitability and efficiency",
      aligned: false,
      explanation:
        "Current acquisition economics are unsustainable. Profitability improvements protect long-term revenue by preserving cash to reinvest once ROAS reaches break-even.",
      suggestedObjective: "Increase Profit",
    };
  }

  if (plan.businessObjective === "maximize_profit" && revenueFocused) {
    return {
      statedObjective: plan.businessObjectiveLabel,
      selectedStrategyFocus: "Scale profitable acquisition",
      aligned: true,
      explanation:
        "Scaling is aligned with profit goals because campaigns already exceed break-even ROAS.",
    };
  }

  if (revenueObjective && revenueFocused) {
    return {
      statedObjective: plan.businessObjectiveLabel,
      selectedStrategyFocus: "Scale acquisition volume",
      aligned: true,
      explanation: "Strategy directly supports revenue and growth objectives.",
    };
  }

  return {
    statedObjective: plan.businessObjectiveLabel,
    selectedStrategyFocus: plan.strategyLabel,
    aligned: true,
    explanation:
      profitFocused && plan.businessObjective === "maximize_profit"
        ? "Strategy prioritizes efficiency and profit recovery before scaling spend."
        : "Strategy aligns with the stated business objective given current performance.",
  };
}

export function buildOptimizationWorkflow(
  strategy: AttributionStrategyId,
  breakEvenRoas: number,
): OptimizationWorkflowStep[] {
  if (strategy === "scale") {
    return [
      { step: 1, label: "Confirm inventory and margin assumptions" },
      { step: 2, label: "Increase budget on campaigns above break-even ROAS" },
      { step: 3, label: "Monitor ROAS daily for 14 days", waitDays: 14 },
      { step: 4, label: "Scale further only if ROAS remains above break-even" },
    ];
  }

  if (strategy === "pause") {
    return [
      { step: 1, label: "Reduce budget 40% on worst-performing campaigns" },
      { step: 2, label: "Wait 7 days and recalculate ROAS", waitDays: 7 },
      { step: 3, label: "Pause only if losses persist after optimization" },
    ];
  }

  return [
    { step: 1, label: "Refresh creatives and tighten audience targeting" },
    { step: 2, label: "Wait 7 days for learning phase to stabilize", waitDays: 7 },
    { step: 3, label: `Recalculate ROAS against break-even (${formatRoas(breakEvenRoas)})` },
    {
      step: 4,
      label: "Reduce budget only if ROAS remains below break-even",
    },
  ];
}

export function buildOpportunityCost(input: {
  action: Pick<AttributionStrategyActionCore, "title" | "expectedRevenueImpactPct" | "estimatedMonthlyImprovement">;
  acquisition: AcquisitionMetrics;
  totalAdSpend: number;
}): OpportunityCost {
  const title = input.action.title.toLowerCase();
  const isReduction =
    title.includes("reduce") || title.includes("pause") || title.includes("shift");

  if (!isReduction) {
    return {
      summary: "Limited near-term tradeoff — efficiency gains expected without major volume loss.",
      items: ["May require creative or landing page testing time."],
    };
  }

  const pctMatch = input.action.title.match(/(\d+)%/);
  const reductionPct = pctMatch ? Number(pctMatch[1]) / 100 : 0.2;
  const spendCut = Math.round(input.totalAdSpend * reductionPct);
  const cac = input.acquisition.cac ?? 0;

  const items: string[] = [];
  if (cac > 0 && spendCut > 0) {
    const customersLost = Math.max(1, Math.round(spendCut / cac));
    items.push(`~${customersLost} fewer new customers per month (estimated).`);
  }
  if (input.action.expectedRevenueImpactPct < 0) {
    items.push(`~${Math.abs(input.action.expectedRevenueImpactPct)}% slower revenue growth (estimated).`);
  }
  items.push("Slower customer list and retargeting pool growth.");

  return {
    summary: "Estimated tradeoffs from reducing acquisition volume:",
    items,
  };
}

export function buildExecutiveSummary(input: {
  plan: AttributionStrategyPlanCore & {
    actions: Array<AttributionStrategyActionCore & { priorityScore?: number; rankExplanation?: string }>;
  };
  netProfit: number;
  cacGapPct: number | null;
  roasGapPct: number | null;
}): AttributionExecutiveSummary {
  const topAction = input.plan.actions[0];
  const unprofitable = input.netProfit < 0;

  let primaryIssue = input.plan.reason;
  if (input.cacGapPct != null && input.cacGapPct > 0) {
    primaryIssue = `Customer acquisition cost is ${input.cacGapPct}% above break-even.`;
  } else if (input.roasGapPct != null && input.roasGapPct > 0) {
    primaryIssue = `ROAS is ${input.roasGapPct}% below estimated break-even.`;
  }

  let overallRecommendation = input.plan.reason;
  if (input.plan.strategy === "optimize") {
    overallRecommendation = "Optimize advertising before reducing scale.";
  } else if (input.plan.strategy === "reduce_budget") {
    overallRecommendation = "Improve efficiency first, then trim spend if ROAS stays below break-even.";
  } else if (input.plan.strategy === "scale") {
    overallRecommendation = "Scale campaigns that exceed break-even while monitoring blended ROAS.";
  }

  return {
    businessStatus: unprofitable ? "Unprofitable" : input.netProfit > 500 ? "Profitable" : "Break-even",
    businessStatusIndicator: unprofitable ? "red" : input.netProfit > 500 ? "green" : "amber",
    primaryIssue,
    bestOpportunity: topAction?.title ?? input.plan.strategyLabel,
    estimatedMonthlyImpact: topAction?.estimatedMonthlyImprovement ?? 0,
    riskLevel: (topAction?.riskLevel ?? "Medium") as ActionRiskLevel,
    overallRecommendation,
  };
}
