import type { RecommendationAnalyzerContext } from "./analyzer-context";
import type { RecommendationAnalyzer } from "./analyzer-types";
import { getActiveCampaigns } from "@/lib/meta/campaign-stats";
import { buildCampaignMetaDetails } from "@/lib/meta/campaign-details";
import { BUSINESS_GOAL_LABELS } from "@/lib/business-goals/types";
import {
  evaluateCampaignGoalAware,
  type GoalAwareCampaignEvaluation,
} from "./goal-aware-evaluation";
import type { CampaignMetricSnapshot } from "./campaign-evaluation";

function evidenceForEvaluation(
  metaDetails: ReturnType<typeof buildCampaignMetaDetails>,
  evaluation: GoalAwareCampaignEvaluation,
  metrics: CampaignMetricSnapshot,
) {
  const base = [
    { label: "Durum", value: metaDetails.statusLabel },
    { label: "Hedef", value: metaDetails.objectiveLabel },
    { label: "Campaign objective", value: evaluation.objectiveLabel },
    { label: "Business goal", value: BUSINESS_GOAL_LABELS[evaluation.primaryBusinessGoal] },
    { label: "Evaluated on", value: evaluation.primaryMetrics.join(", ") },
    { label: "Verdict", value: evaluation.verdict.replace(/_/g, " ") },
    { label: "Günlük bütçe", value: metaDetails.dailyBudgetLabel },
    { label: "Süre", value: metaDetails.durationLabel },
    { label: "7-day spend", value: `$${metrics.spend7d.toLocaleString()}` },
  ];

  const objectiveEvidence: { label: string; value: string; trend?: "up" | "down" }[] = [];

  switch (evaluation.objective) {
    case "sales":
    case "catalog_sales":
      objectiveEvidence.push(
        { label: "7-day revenue", value: `$${metrics.revenue7d.toLocaleString()}` },
        {
          label: "ROAS (7d)",
          value: metrics.roas7d.toFixed(2),
          trend: metrics.roas7d < 1.2 ? "down" : undefined,
        },
        { label: "Profit (7d est.)", value: `$${metrics.profit7d.toLocaleString()}` },
        { label: "CPA (7d)", value: metrics.cpa7d > 0 ? `$${metrics.cpa7d}` : "—" },
        {
          label: "Conversion Rate",
          value: metrics.conversionRate7d > 0 ? `${metrics.conversionRate7d}%` : "—",
        },
      );
      break;
    case "brand_awareness":
    case "reach":
      objectiveEvidence.push(
        { label: "Reach (7d)", value: metrics.reach7d.toLocaleString() },
        { label: "Impressions (7d)", value: metrics.impressions7d.toLocaleString() },
        { label: "CPM (7d)", value: `$${metrics.cpm7d}` },
        { label: "Frequency (7d)", value: metrics.frequency7d.toFixed(1) },
      );
      break;
    case "video_views":
      objectiveEvidence.push(
        { label: "Video Views (7d)", value: metrics.videoViews7d.toLocaleString() },
        { label: "ThruPlay (7d)", value: metrics.thruPlay7d.toLocaleString() },
        {
          label: "Completion Rate",
          value: metrics.completionRate7d > 0 ? `${metrics.completionRate7d}%` : "—",
        },
        {
          label: "Cost per View",
          value: metrics.costPerView7d > 0 ? `$${metrics.costPerView7d}` : "—",
        },
      );
      break;
    case "leads":
      objectiveEvidence.push(
        { label: "Leads (7d)", value: metrics.leads7d.toLocaleString() },
        { label: "Qualified Leads (7d)", value: metrics.qualifiedLeads7d.toLocaleString() },
        { label: "CPL (7d)", value: metrics.cpl7d > 0 ? `$${metrics.cpl7d}` : "—" },
        {
          label: "Conversion Rate",
          value: metrics.clicks7d > 0 && metrics.leads7d > 0
            ? `${Math.round((metrics.leads7d / metrics.clicks7d) * 10000) / 100}%`
            : "—",
        },
      );
      break;
    case "traffic":
      objectiveEvidence.push(
        { label: "CTR (7d)", value: `${metrics.ctr7d}%` },
        { label: "CPC (7d)", value: metrics.cpc7d > 0 ? `$${metrics.cpc7d}` : "—" },
        { label: "Landing Page Views", value: metrics.landingPageViews7d.toLocaleString() },
        {
          label: "Bounce Rate",
          value: metrics.bounceRate7d > 0 ? `${metrics.bounceRate7d}%` : "—",
        },
      );
      break;
    case "engagement":
    case "messages":
      objectiveEvidence.push(
        { label: "CTR (7d)", value: `${metrics.ctr7d}%` },
        { label: "Impressions (7d)", value: metrics.impressions7d.toLocaleString() },
        { label: "Frequency (7d)", value: metrics.frequency7d.toFixed(1) },
        {
          label: evaluation.objective === "messages" ? "Cost per Message" : "Cost per Engagement",
          value:
            metrics.clicks7d > 0
              ? `$${Math.round((metrics.spend7d / metrics.clicks7d) * 100) / 100}`
              : "—",
        },
      );
      break;
    case "app_installs":
      objectiveEvidence.push(
        { label: "App Installs (7d)", value: metrics.appInstalls7d.toLocaleString() },
        {
          label: "CPI (7d)",
          value: metrics.costPerInstall7d > 0 ? `$${metrics.costPerInstall7d}` : "—",
        },
        {
          label: "Activation Rate",
          value:
            metrics.activations7d > 0 && metrics.appInstalls7d > 0
              ? `${Math.round((metrics.activations7d / metrics.appInstalls7d) * 10000) / 100}%`
              : "—",
        },
        { label: "Install Rate", value: metrics.clicks7d > 0 && metrics.appInstalls7d > 0
            ? `${Math.round((metrics.appInstalls7d / metrics.clicks7d) * 10000) / 100}%`
            : "—" },
      );
      break;
  }

  const fi = evaluation.financialImpact;
  const financialEvidence = [
    { label: "Financial impact", value: fi.summary },
    {
      label: "Est. monthly profit impact",
      value: fi.estimatedMonthlyProfitIncrease != null
        ? `$${fi.estimatedMonthlyProfitIncrease.toLocaleString()}`
        : "—",
    },
    {
      label: "Est. monthly cost savings",
      value: fi.estimatedMonthlyCostSavings != null
        ? `$${fi.estimatedMonthlyCostSavings.toLocaleString()}`
        : "—",
    },
    {
      label: "Impact confidence",
      value: `${Math.round(fi.confidence * 100)}%`,
    },
  ];

  const issueEvidence = evaluation.issues.slice(0, 2).map((issue) => ({
    label: `Issue: ${issue.metric}`,
    value: `${issue.value} — ${issue.explanation}`,
    trend: issue.severity === "critical" || issue.severity === "high" ? ("down" as const) : undefined,
  }));

  return [...base, ...objectiveEvidence, ...financialEvidence, ...issueEvidence];
}

function titleForEvaluation(campaignName: string, evaluation: GoalAwareCampaignEvaluation): string {
  if (evaluation.verdict === "pause_consider") {
    return `Pause or optimize — ${campaignName}`;
  }
  return `Campaign Needs Review — ${campaignName}`;
}

function actionLabelFor(evaluation: GoalAwareCampaignEvaluation): string {
  if (evaluation.verdict === "pause_consider") return "Review pause";
  if (evaluation.issues[0]?.metric === "ROAS") return "Review efficiency";
  return "Review";
}

export const campaignsAnalyzer: RecommendationAnalyzer = {
  id: "campaigns",
  category: "campaign_review",
  requiredConnectors: ["meta_ads", "google_ads", "tiktok"],
  analyze(snapshot, context) {
    const activeCampaigns = getActiveCampaigns(snapshot.campaigns);
    if (activeCampaigns.length === 0) {
      return [];
    }

    const results = [];

    for (const campaign of activeCampaigns) {
      const evaluation = evaluateCampaignGoalAware(campaign, context);
      if (!evaluation.shouldEmitRecommendation) continue;

      const metaDetails = buildCampaignMetaDetails(campaign, "tr");

      results.push({
        id: `camp-${campaign.id}`,
        category: "campaign_review" as const,
        title: titleForEvaluation(campaign.name, evaluation),
        description: evaluation.why,
        priority: evaluation.priority,
        expectedImpact: evaluation.financialImpact.summary,
        confidence: Math.min(
          0.95,
          evaluation.financialImpact.confidence *
            (evaluation.priority === "critical" ? 1 : 0.92),
        ),
        evidence: evidenceForEvaluation(metaDetails, evaluation, evaluation.metrics),
        actions: [{ label: actionLabelFor(evaluation), type: "review" as const }],
        entityType: "campaign",
        entityId: campaign.id,
        financialImpact: {
          estimatedMonthlyProfitIncrease: evaluation.financialImpact.estimatedMonthlyProfitIncrease,
          estimatedMonthlyRevenueIncrease: evaluation.financialImpact.estimatedMonthlyRevenueIncrease,
          estimatedMonthlyCostSavings: evaluation.financialImpact.estimatedMonthlyCostSavings,
        },
      });
    }

    return results;
  },
};
