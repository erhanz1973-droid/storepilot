import type {
  ActionRiskLevel,
  AttributionBusinessObjective,
  AttributionStrategyActionCore,
  AttributionStrategyId,
} from "./decision-engine-types";

export type ActionPriorityScore = {
  score: number;
  profitComponent: number;
  confidenceComponent: number;
  riskComponent: number;
  revenueComponent: number;
  alignmentComponent: number;
  rankExplanation: string;
};

export type PrioritizedActionCore = AttributionStrategyActionCore & {
  priorityScore: number;
  rankExplanation: string;
};

/** Action before rank / priority metadata is assigned by sortActionsByPriority */
export type UnrankedStrategyAction = Omit<
  AttributionStrategyActionCore,
  "rank" | "priorityScore" | "rankExplanation"
>;

const RISK_POINTS: Record<ActionRiskLevel, number> = {
  Low: 100,
  Medium: 68,
  High: 38,
};

export function computeActionPriorityScore(input: {
  action: UnrankedStrategyAction;
  strategy: AttributionStrategyId;
  businessObjective: AttributionBusinessObjective;
  maxProfit: number;
}): ActionPriorityScore {
  const { action, strategy, businessObjective, maxProfit } = input;

  const profitNorm =
    maxProfit > 0 ? (action.estimatedMonthlyImprovement / maxProfit) * 100 : 50;
  const profitComponent = Math.round(profitNorm * 0.4);

  const confidenceComponent = Math.round(action.confidencePct * 0.25);

  const riskComponent = Math.round(RISK_POINTS[action.riskLevel] * 0.2);

  const revenuePct = action.expectedRevenueImpactPct;
  const revenueFavorability =
    businessObjective === "maximize_revenue" || businessObjective === "maximize_growth"
      ? 50 + revenuePct * 2
      : 50 - Math.min(50, Math.abs(Math.min(0, revenuePct)) * 1.5);
  const revenueComponent = Math.round(Math.max(0, Math.min(100, revenueFavorability)) * 0.0);

  let alignmentRaw = 50;
  const title = action.title.toLowerCase();
  if (businessObjective === "maximize_profit" || businessObjective === "preserve_cash_flow") {
    if (title.includes("reduce") || title.includes("pause")) alignmentRaw += 25;
    if (title.includes("increase")) alignmentRaw -= 20;
  }
  if (businessObjective === "maximize_revenue" || businessObjective === "maximize_growth") {
    if (title.includes("refresh") || title.includes("duplicate")) alignmentRaw += 20;
    if (title.includes("reduce") && !action.isLastResort) alignmentRaw -= 15;
  }
  if (businessObjective === "clear_inventory" && title.includes("scale")) alignmentRaw += 30;
  if (strategy === "optimize" && (title.includes("refresh") || title.includes("overlap"))) {
    alignmentRaw += 15;
  }
  const alignmentComponent = Math.round(Math.max(0, Math.min(100, alignmentRaw)) * 0.15);

  const score = Math.min(
    100,
    profitComponent + confidenceComponent + riskComponent + alignmentComponent,
  );

  const rankExplanation = buildRankExplanation({
    action,
    profitComponent,
    riskComponent,
    alignmentComponent,
    maxProfit,
  });

  return {
    score,
    profitComponent,
    confidenceComponent,
    riskComponent,
    revenueComponent: 0,
    alignmentComponent,
    rankExplanation,
  };
}

function buildRankExplanation(input: {
  action: UnrankedStrategyAction;
  profitComponent: number;
  riskComponent: number;
  alignmentComponent: number;
  maxProfit: number;
}): string {
  const { action, profitComponent, riskComponent, alignmentComponent, maxProfit } = input;
  const isTopProfit = action.estimatedMonthlyImprovement >= maxProfit * 0.95;

  if (action.isLastResort) {
    return "Ranked last — last-resort action reserved until optimization steps are exhausted.";
  }
  if (isTopProfit && action.riskLevel === "Low") {
    return "Ranked first — highest profit potential with low execution risk.";
  }
  if (!isTopProfit && action.riskLevel === "Low" && alignmentComponent >= 12) {
    return "Ranked above higher-profit actions — lower risk and stronger alignment with your business objective.";
  }
  if (action.title.toLowerCase().includes("refresh") || action.title.toLowerCase().includes("overlap")) {
    return "Ranked first — optimization step that unlocks safer budget decisions later.";
  }
  if (profitComponent >= 30 && riskComponent >= 12) {
    return "Ranked by balanced ROI score: profit impact, confidence, and manageable risk.";
  }
  return "Ranked by composite priority score (40% financial impact, 25% confidence, 20% risk, 15% strategic alignment).";
}

export function sortActionsByPriority(
  actions: UnrankedStrategyAction[],
  strategy: AttributionStrategyId,
  businessObjective: AttributionBusinessObjective,
): PrioritizedActionCore[] {
  const maxProfit = Math.max(...actions.map((a) => a.estimatedMonthlyImprovement), 1);

  return [...actions]
    .map((action) => ({
      action,
      priority: computeActionPriorityScore({ action, strategy, businessObjective, maxProfit }),
    }))
    .sort((a, b) => {
      if (a.action.isLastResort && !b.action.isLastResort) return 1;
      if (!a.action.isLastResort && b.action.isLastResort) return -1;
      return b.priority.score - a.priority.score;
    })
    .slice(0, 6)
    .map(({ action, priority }, index) => ({
      ...action,
      rank: index + 1,
      priorityScore: priority.score,
      rankExplanation: priority.rankExplanation,
    }));
}
