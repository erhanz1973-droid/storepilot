import type { MetaCampaign } from "@/lib/connectors/types";
import type { BusinessGoal } from "@/lib/business-goals/types";
import { BUSINESS_GOAL_LABELS } from "@/lib/business-goals/types";
import type { CampaignObjective } from "@/lib/meta/campaign-objectives";
import type { RecommendationSeverity } from "@/lib/types";
import {
  type CampaignEvaluation,
  type CampaignMetricIssue,
  evaluateCampaignByObjective,
} from "./campaign-evaluation";
import type { RecommendationAnalyzerContext, InventoryPressure } from "./analyzer-context";

export type GoalAwareVerdict = "continue" | "optimize" | "review" | "pause_consider";

export type CampaignFinancialImpact = {
  estimatedMonthlyProfitIncrease: number | null;
  estimatedMonthlyRevenueIncrease: number | null;
  estimatedMonthlyCostSavings: number | null;
  confidence: number;
  summary: string;
};

export type GoalAwareCampaignEvaluation = CampaignEvaluation & {
  campaignObjective: CampaignObjective;
  businessGoals: BusinessGoal[];
  primaryBusinessGoal: BusinessGoal;
  verdict: GoalAwareVerdict;
  goalRationale: string;
  financialImpact: CampaignFinancialImpact;
  shouldEmitRecommendation: boolean;
};

const AWARENESS_OBJECTIVES: CampaignObjective[] = [
  "brand_awareness",
  "reach",
  "video_views",
  "engagement",
  "messages",
];

const ACQUISITION_OBJECTIVES: CampaignObjective[] = [
  "traffic",
  "leads",
  "app_installs",
  "messages",
  "engagement",
];

function isRoasIssue(issue: CampaignMetricIssue): boolean {
  return issue.metric === "ROAS";
}

function stripRoasIssues(issues: CampaignMetricIssue[]): CampaignMetricIssue[] {
  return issues.filter((i) => !isRoasIssue(i));
}

function objectiveMetricsHealthy(evaluation: CampaignEvaluation): boolean {
  return evaluation.issues.length === 0;
}

function awarenessMetricsHealthy(evaluation: CampaignEvaluation): boolean {
  const m = evaluation.metrics;
  return (
    m.impressions7d >= 5000 &&
    m.cpm7d <= 30 &&
    m.frequency7d <= 5 &&
    !evaluation.issues.some((i) => i.severity === "critical")
  );
}

function estimateFinancialImpact(
  evaluation: CampaignEvaluation,
  verdict: GoalAwareVerdict,
  marginPct?: number,
): CampaignFinancialImpact {
  const weeklySpend = evaluation.metrics.spend7d;
  const monthlySpend = weeklySpend * 4.33;
  const margin = marginPct != null && marginPct > 0 ? marginPct / 100 : 0.35;

  if (verdict === "continue") {
    const revenueLift = Math.round(monthlySpend * 0.08);
    const profitLift = Math.round(revenueLift * margin);
    return {
      estimatedMonthlyProfitIncrease: profitLift > 0 ? profitLift : null,
      estimatedMonthlyRevenueIncrease: revenueLift > 0 ? revenueLift : null,
      estimatedMonthlyCostSavings: null,
      confidence: 0.72,
      summary:
        profitLift > 0
          ? `Continuing supports your business goal — estimated upside ~$${revenueLift.toLocaleString()}/mo revenue (~$${profitLift.toLocaleString()}/mo profit at ${Math.round(margin * 100)}% margin).`
          : "Continuing supports your business goal with no immediate financial downside expected.",
    };
  }

  if (verdict === "pause_consider" || verdict === "optimize") {
    const savingsLow = Math.round(weeklySpend * 0.25 * 4.33);
    const savingsHigh = Math.round(weeklySpend * 0.45 * 4.33);
    const mid = Math.round((savingsLow + savingsHigh) / 2);
    const profitSave = Math.round(mid * margin);
    return {
      estimatedMonthlyProfitIncrease: profitSave > 0 ? profitSave : null,
      estimatedMonthlyRevenueIncrease: null,
      estimatedMonthlyCostSavings: mid > 0 ? mid : null,
      confidence: evaluation.priority === "critical" ? 0.86 : 0.78,
      summary: `If accepted, estimated cost savings ~$${savingsLow.toLocaleString()}–$${savingsHigh.toLocaleString()}/mo (~$${profitSave.toLocaleString()}/mo profit preserved).`,
    };
  }

  const recoveryLow = Math.round(weeklySpend * 0.15 * 4.33);
  const recoveryHigh = Math.round(weeklySpend * 0.3 * 4.33);
  return {
    estimatedMonthlyProfitIncrease: Math.round(((recoveryLow + recoveryHigh) / 2) * margin),
    estimatedMonthlyRevenueIncrease: Math.round((recoveryLow + recoveryHigh) / 2),
    estimatedMonthlyCostSavings: null,
    confidence: 0.74,
    summary: `Optimization could recover ~$${recoveryLow.toLocaleString()}–$${recoveryHigh.toLocaleString()}/mo in ad efficiency.`,
  };
}

function applyGoalOverrides(
  base: CampaignEvaluation,
  primaryGoal: BusinessGoal,
  allGoals: BusinessGoal[],
  inventoryPressure: InventoryPressure,
): {
  issues: CampaignMetricIssue[];
  needsReview: boolean;
  priority: RecommendationSeverity;
  verdict: GoalAwareVerdict;
  goalRationale: string;
} {
  let issues = [...base.issues];
  let verdict: GoalAwareVerdict = base.needsReview ? "review" : "continue";
  let goalRationale = "";

  const roasOnly =
    issues.length > 0 && issues.every(isRoasIssue);
  const lowRoas = base.metrics.roas7d > 0 && base.metrics.roas7d < 1;

  if (primaryGoal === "build_brand_awareness" && AWARENESS_OBJECTIVES.includes(base.objective)) {
    issues = stripRoasIssues(issues);
    if (awarenessMetricsHealthy(base) || objectiveMetricsHealthy({ ...base, issues })) {
      verdict = "continue";
      goalRationale =
        "Your primary business goal is Build Brand Awareness. Although ROAS may be low, awareness delivery metrics are on track.";
      return { issues, needsReview: false, priority: "low", verdict, goalRationale };
    }
  }

  if (primaryGoal === "launch_new_product") {
    if (roasOnly || (lowRoas && issues.length <= 1)) {
      issues = stripRoasIssues(issues);
      if (base.metrics.impressions7d >= 3000 || base.metrics.reach7d >= 1500) {
        verdict = "continue";
        goalRationale =
          "Your business goal is Launch New Product. Revenue is currently secondary to awareness and customer acquisition.";
        return { issues, needsReview: false, priority: "low", verdict, goalRationale };
      }
    }
  }

  if (primaryGoal === "clear_inventory" && (base.objective === "sales" || base.objective === "catalog_sales")) {
    if (lowRoas && inventoryPressure === "high") {
      issues = stripRoasIssues(issues);
      verdict = "continue";
      goalRationale =
        "Your business goal is Clear Inventory. Moving stock justifies advertising cost even when ROAS is below target.";
      return { issues, needsReview: false, priority: "low", verdict, goalRationale };
    }
  }

  if (primaryGoal === "increase_profit" && (base.objective === "sales" || base.objective === "catalog_sales")) {
    if (lowRoas || base.metrics.roas7d < 1.1) {
      verdict = "pause_consider";
      goalRationale =
        "Your business goal is Increase Profit. ROAS below break-even is consuming margin — pause or optimize.";
      const needsReview = true;
      const priority: RecommendationSeverity =
        base.metrics.roas7d < 0.85 ? "critical" : "high";
      if (!issues.some(isRoasIssue)) {
        issues.unshift({
          metric: "ROAS",
          value: base.metrics.roas7d.toFixed(2),
          benchmark: "≥ 1.0 for profit goal",
          severity: priority,
          explanation: "Profit-focused stores cannot sustain sub-break-even ROAS on sales campaigns.",
        });
      }
      return { issues, needsReview, priority, verdict, goalRationale };
    }
  }

  if (primaryGoal === "grow_email_list" && base.objective === "leads") {
    issues = stripRoasIssues(issues);
    goalRationale = "Your business goal is Grow Email List — CPL and lead volume matter more than purchase ROAS.";
    if (issues.length === 0) {
      return { issues, needsReview: false, priority: "low", verdict: "continue", goalRationale };
    }
  }

  if (primaryGoal === "acquire_new_customers" && ACQUISITION_OBJECTIVES.includes(base.objective)) {
    issues = stripRoasIssues(issues);
    if (issues.length === 0) {
      verdict = "continue";
      goalRationale =
        "Your business goal is Acquire New Customers. Acquisition efficiency metrics are acceptable despite low attributed revenue.";
      return { issues, needsReview: false, priority: "low", verdict, goalRationale };
    }
    goalRationale =
      "Your business goal is Acquire New Customers. Review acquisition efficiency, not purchase ROAS alone.";
  }

  if (allGoals.includes("build_brand_awareness") && AWARENESS_OBJECTIVES.includes(base.objective)) {
    issues = stripRoasIssues(issues);
  }

  const needsReview = issues.some((i) => i.severity === "critical" || i.severity === "high");
  if (!needsReview) verdict = "continue";
  else if (verdict === "continue") verdict = "review";

  return {
    issues,
    needsReview,
    priority: needsReview ? base.priority : "low",
    verdict,
    goalRationale,
  };
}

function buildGoalAwareWhy(
  campaignName: string,
  evaluation: CampaignEvaluation,
  primaryGoal: BusinessGoal,
  verdict: GoalAwareVerdict,
  goalRationale: string,
  issues: CampaignMetricIssue[],
): string {
  const goalLabel = BUSINESS_GOAL_LABELS[primaryGoal];
  const objectiveIntro = `This campaign's objective is ${evaluation.objectiveLabel}. Your business goal is ${goalLabel}.`;

  const metricHighlights: string[] = [];
  const m = evaluation.metrics;

  if (AWARENESS_OBJECTIVES.includes(evaluation.objective)) {
    if (m.reach7d > 0) metricHighlights.push(`Reach: ${m.reach7d.toLocaleString()}`);
    if (m.impressions7d > 0) metricHighlights.push(`Impressions: ${m.impressions7d.toLocaleString()}`);
    if (m.cpm7d > 0) metricHighlights.push(`CPM: $${m.cpm7d}`);
  } else if (evaluation.objective === "sales" || evaluation.objective === "catalog_sales") {
    metricHighlights.push(`ROAS: ${m.roas7d.toFixed(2)}`);
    metricHighlights.push(`Revenue: $${m.revenue7d.toLocaleString()}`);
  } else if (evaluation.objective === "video_views") {
    metricHighlights.push(`Video Views: ${m.videoViews7d.toLocaleString()}`);
    if (m.completionRate7d > 0) metricHighlights.push(`Completion: ${m.completionRate7d}%`);
  } else if (evaluation.objective === "leads") {
    metricHighlights.push(`Leads: ${m.leads7d}`);
    if (m.cpl7d > 0) metricHighlights.push(`CPL: $${m.cpl7d}`);
  }

  const metricsLine =
    metricHighlights.length > 0 ? ` Key metrics: ${metricHighlights.join(", ")}.` : "";

  if (verdict === "continue") {
    const roasNote =
      m.roas7d < 1.2 && evaluation.roasWeight < 0.2
        ? " Although ROAS is low, this campaign is achieving its objective-aligned goal."
        : "";
    return `${objectiveIntro}${metricsLine}${roasNote} ${goalRationale} Recommendation: Continue running.`;
  }

  const issueDetail =
    issues.length > 0
      ? ` ${issues[0]!.metric} ${issues[0]!.value} — ${issues[0]!.explanation}`
      : "";

  const action =
    verdict === "pause_consider"
      ? "Recommendation: Pause or optimize."
      : "Recommendation: Review and optimize.";

  return `${objectiveIntro}${metricsLine} Evaluated on ${evaluation.primaryMetrics.join(", ")}.${issueDetail} ${goalRationale} ${action}`;
}

/**
 * Goal-aware decision pipeline:
 * Business Goal → Campaign Objective → Performance Metrics → Context → Recommendation → Financial Impact
 */
export function evaluateCampaignGoalAware(
  campaign: MetaCampaign,
  context?: RecommendationAnalyzerContext,
): GoalAwareCampaignEvaluation {
  const base = evaluateCampaignByObjective(campaign);
  const businessGoals = context?.businessGoals?.goals ?? ["increase_revenue"];
  const primaryBusinessGoal = context?.businessGoals?.primaryGoal ?? "increase_revenue";
  const inventoryPressure = context?.inventoryPressure ?? "normal";

  const overridden = applyGoalOverrides(
    base,
    primaryBusinessGoal,
    businessGoals,
    inventoryPressure,
  );

  const merged: CampaignEvaluation = {
    ...base,
    issues: overridden.issues,
    needsReview: overridden.needsReview,
    priority: overridden.priority,
    why: base.why,
    recommendedAction: base.recommendedAction,
  };

  const why = buildGoalAwareWhy(
    campaign.name,
    merged,
    primaryBusinessGoal,
    overridden.verdict,
    overridden.goalRationale,
    overridden.issues,
  );

  const financialImpact = estimateFinancialImpact(
    merged,
    overridden.verdict,
    context?.profitMarginPct,
  );

  return {
    ...merged,
    campaignObjective: base.objective,
    businessGoals,
    primaryBusinessGoal,
    verdict: overridden.verdict,
    goalRationale: overridden.goalRationale,
    why,
    financialImpact,
    shouldEmitRecommendation: overridden.needsReview && overridden.verdict !== "continue",
  };
}
