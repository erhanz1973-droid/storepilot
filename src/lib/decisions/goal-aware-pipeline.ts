/**
 * StorePilot Decision Engine — goal-aware pipeline.
 *
 * Business Goal → Campaign Objective → Performance Metrics → Context Evaluation
 * → AI Recommendation → Financial Impact → Confidence Score
 */
export {
  evaluateCampaignGoalAware,
  type GoalAwareCampaignEvaluation,
  type GoalAwareVerdict,
  type CampaignFinancialImpact,
} from "@/lib/recommendations/goal-aware-evaluation";

export {
  classifyCampaignObjective,
  type CampaignObjective,
  CAMPAIGN_OBJECTIVE_LABELS,
} from "@/lib/meta/campaign-objectives";

export {
  type BusinessGoal,
  BUSINESS_GOAL_LABELS,
  ALL_BUSINESS_GOALS,
} from "@/lib/business-goals/types";

export {
  buildAnalyzerContext,
  type RecommendationAnalyzerContext,
} from "@/lib/recommendations/analyzer-context";
