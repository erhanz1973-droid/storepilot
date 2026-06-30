import type { MetaCampaign } from "@/lib/connectors/types";
import type { RecommendationSeverity } from "@/lib/types";
import {
  type CampaignObjective,
  classifyCampaignObjective,
  getObjectiveProfile,
  OBJECTIVE_ROAS_WEIGHT,
} from "@/lib/meta/campaign-objectives";

/** Minimum 7-day spend before flagging a campaign for review. */
export const MIN_CAMPAIGN_REVIEW_SPEND = 25;

/** Minimum spend + impressions to evaluate a campaign (revenue not required — engagement ads). */
export function campaignHasMeasurableSpend(campaign: {
  spend7d: number;
  impressions7d: number;
}): boolean {
  return campaign.spend7d >= MIN_CAMPAIGN_REVIEW_SPEND && campaign.impressions7d > 0;
}

export type CampaignMetricSnapshot = {
  spend7d: number;
  revenue7d: number;
  roas7d: number;
  impressions7d: number;
  reach7d: number;
  frequency7d: number;
  ctr7d: number;
  clicks7d: number;
  conversions7d: number;
  leads7d: number;
  qualifiedLeads7d: number;
  videoViews7d: number;
  thruPlay7d: number;
  appInstalls7d: number;
  cpm7d: number;
  cpc7d: number;
  cpa7d: number;
  cpl7d: number;
  costPerView7d: number;
  costPerInstall7d: number;
  completionRate7d: number;
  conversionRate7d: number;
  landingPageViews7d: number;
  bounceRate7d: number;
  activations7d: number;
  profit7d: number;
};

export type CampaignMetricIssue = {
  metric: string;
  value: string;
  benchmark: string;
  severity: RecommendationSeverity;
  explanation: string;
};

export type CampaignEvaluation = {
  objective: CampaignObjective;
  objectiveLabel: string;
  primaryMetrics: string[];
  roasWeight: number;
  needsReview: boolean;
  priority: RecommendationSeverity;
  why: string;
  recommendedAction: string;
  issues: CampaignMetricIssue[];
  metrics: CampaignMetricSnapshot;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(n: number): string {
  return `${round2(n)}%`;
}

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Build a normalized metric snapshot, deriving missing fields when possible. */
export function buildCampaignMetricSnapshot(campaign: MetaCampaign): CampaignMetricSnapshot {
  const spend = campaign.spend7d;
  const impressions = campaign.impressions7d;
  const frequency = campaign.frequency7d > 0 ? campaign.frequency7d : 1;
  const reach =
    campaign.reach7d ??
    (impressions > 0 ? Math.round(impressions / frequency) : 0);
  const clicks =
    campaign.clicks7d ??
    (impressions > 0 && campaign.ctr7d > 0
      ? Math.round((impressions * campaign.ctr7d) / 100)
      : 0);
  const conversions = campaign.conversions7d ?? (campaign.revenue7d > 0 ? 1 : 0);
  const leads = campaign.leads7d ?? 0;
  const qualifiedLeads = campaign.qualifiedLeads7d ?? leads;
  const videoViews = campaign.videoViews7d ?? 0;
  const thruPlay = campaign.thruPlay7d ?? 0;
  const appInstalls = campaign.appInstalls7d ?? 0;
  const landingPageViews = campaign.landingPageViews7d ?? clicks;
  const bounceRate = campaign.bounceRate7d ?? 0;
  const activations = campaign.activations7d ?? 0;
  const profit =
    campaign.profit7d ??
    (campaign.revenue7d > 0 && campaign.spend7d > 0
      ? Math.max(0, campaign.revenue7d - campaign.spend7d)
      : 0);

  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  const cpl = leads > 0 ? spend / leads : 0;
  const costPerView = videoViews > 0 ? spend / videoViews : 0;
  const costPerInstall = appInstalls > 0 ? spend / appInstalls : 0;
  const completionRate = videoViews > 0 ? (thruPlay / videoViews) * 100 : 0;
  const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

  return {
    spend7d: spend,
    revenue7d: campaign.revenue7d,
    roas7d: campaign.roas7d,
    impressions7d: impressions,
    reach7d: reach,
    frequency7d: campaign.frequency7d,
    ctr7d: campaign.ctr7d,
    clicks7d: clicks,
    conversions7d: conversions,
    leads7d: leads,
    qualifiedLeads7d: qualifiedLeads,
    videoViews7d: videoViews,
    thruPlay7d: thruPlay,
    appInstalls7d: appInstalls,
    cpm7d: round2(cpm),
    cpc7d: round2(cpc),
    cpa7d: round2(cpa),
    cpl7d: round2(cpl),
    costPerView7d: round2(costPerView),
    costPerInstall7d: round2(costPerInstall),
    completionRate7d: round2(completionRate),
    conversionRate7d: round2(conversionRate),
    landingPageViews7d: landingPageViews,
    bounceRate7d: round2(bounceRate),
    activations7d: activations,
    profit7d: round2(profit),
  };
}

function pushIssue(
  issues: CampaignMetricIssue[],
  issue: CampaignMetricIssue,
): void {
  issues.push(issue);
}

function maybeRoasIssue(
  objective: CampaignObjective,
  metrics: CampaignMetricSnapshot,
  issues: CampaignMetricIssue[],
): void {
  const weight = OBJECTIVE_ROAS_WEIGHT[objective];
  if (weight < 0.2) return;
  if (metrics.revenue7d <= 0) return;

  if (metrics.roas7d < 1) {
    pushIssue(issues, {
      metric: "ROAS",
      value: metrics.roas7d.toFixed(2),
      benchmark: "≥ 1.0",
      severity: weight >= 0.8 ? "critical" : "high",
      explanation:
        weight >= 0.8
          ? "Return on ad spend is below break-even for this sales-focused campaign."
          : "Attributed revenue is weak relative to spend, but this is secondary for the campaign objective.",
    });
  } else if (metrics.roas7d < 1.2 && weight >= 0.8) {
    pushIssue(issues, {
      metric: "ROAS",
      value: metrics.roas7d.toFixed(2),
      benchmark: "≥ 1.2",
      severity: "high",
      explanation: "Sales efficiency is under the profitability threshold.",
    });
  }
}

function evaluateSales(metrics: CampaignMetricSnapshot, issues: CampaignMetricIssue[]): void {
  maybeRoasIssue("sales", metrics, issues);

  if (metrics.profit7d < 0 && metrics.spend7d > 100) {
    pushIssue(issues, {
      metric: "Profit",
      value: money(metrics.profit7d),
      benchmark: "≥ $0",
      severity: metrics.profit7d < -metrics.spend7d * 0.5 ? "critical" : "high",
      explanation: "Attributed revenue is not covering ad spend after costs.",
    });
  }

  if (metrics.conversions7d > 0 && metrics.cpa7d > 80 && metrics.spend7d > 100) {
    pushIssue(issues, {
      metric: "CPA",
      value: money(metrics.cpa7d),
      benchmark: "≤ $80",
      severity: metrics.cpa7d > 120 ? "critical" : "high",
      explanation: "Cost per acquisition is high relative to typical e-commerce targets.",
    });
  }

  if (metrics.clicks7d > 50 && metrics.conversionRate7d < 1 && metrics.spend7d > 100) {
    pushIssue(issues, {
      metric: "Conversion Rate",
      value: pct(metrics.conversionRate7d),
      benchmark: "≥ 1%",
      severity: "high",
      explanation: "Clicks are not converting efficiently into purchases.",
    });
  }

  if (metrics.frequency7d > 4 && metrics.spend7d > 100) {
    pushIssue(issues, {
      metric: "Frequency",
      value: metrics.frequency7d.toFixed(1),
      benchmark: "≤ 4.0",
      severity: "high",
      explanation: "Audience fatigue may be suppressing conversion rate and ROAS.",
    });
  }
}

function evaluateAwarenessLike(
  metrics: CampaignMetricSnapshot,
  issues: CampaignMetricIssue[],
): void {
  if (metrics.impressions7d < 5000 && metrics.spend7d >= 50) {
    pushIssue(issues, {
      metric: "Impressions",
      value: metrics.impressions7d.toLocaleString(),
      benchmark: "≥ 5,000 (7d)",
      severity: "high",
      explanation: "Delivery volume is too low to meaningfully build awareness.",
    });
  }

  if (metrics.cpm7d > 25 && metrics.impressions7d > 1000) {
    pushIssue(issues, {
      metric: "CPM",
      value: money(metrics.cpm7d),
      benchmark: "≤ $25",
      severity: metrics.cpm7d > 40 ? "critical" : "high",
      explanation: "Cost per thousand impressions is elevated for an awareness objective.",
    });
  }

  if (metrics.frequency7d > 5 && metrics.impressions7d > 2000) {
    pushIssue(issues, {
      metric: "Frequency",
      value: metrics.frequency7d.toFixed(1),
      benchmark: "≤ 5.0",
      severity: "high",
      explanation: "The same users are seeing ads too often, reducing marginal awareness impact.",
    });
  }

  const reachPerDollar = metrics.spend7d > 0 ? metrics.reach7d / metrics.spend7d : 0;
  if (metrics.spend7d > 100 && reachPerDollar < 8) {
    pushIssue(issues, {
      metric: "Reach",
      value: metrics.reach7d.toLocaleString(),
      benchmark: "≥ 8 people per $1 spent",
      severity: "medium",
      explanation: "Unique reach is narrow relative to spend for a reach/awareness goal.",
    });
  }
}

function evaluateVideo(metrics: CampaignMetricSnapshot, issues: CampaignMetricIssue[]): void {
  if (metrics.videoViews7d === 0 && metrics.spend7d >= 50) {
    pushIssue(issues, {
      metric: "Video Views",
      value: "0",
      benchmark: "> 0",
      severity: "critical",
      explanation: "Spend is accumulating without measurable video views.",
    });
    return;
  }

  if (metrics.costPerView7d > 0.12 && metrics.videoViews7d > 100) {
    pushIssue(issues, {
      metric: "Cost per View",
      value: money(metrics.costPerView7d),
      benchmark: "≤ $0.12",
      severity: metrics.costPerView7d > 0.2 ? "critical" : "high",
      explanation: "Each video view is costing more than expected for video-view optimization.",
    });
  }

  if (metrics.thruPlay7d > 0 && metrics.completionRate7d < 15) {
    pushIssue(issues, {
      metric: "Completion Rate",
      value: pct(metrics.completionRate7d),
      benchmark: "≥ 15%",
      severity: "high",
      explanation: "Viewers are dropping off before ThruPlay, suggesting weak hook or creative fit.",
    });
  }

  if (metrics.thruPlay7d === 0 && metrics.videoViews7d > 200 && metrics.spend7d > 75) {
    pushIssue(issues, {
      metric: "ThruPlay",
      value: "0",
      benchmark: "> 0",
      severity: "high",
      explanation: "Views are not converting into ThruPlay completions.",
    });
  }
}

function evaluateLeads(metrics: CampaignMetricSnapshot, issues: CampaignMetricIssue[]): void {
  if (metrics.leads7d === 0 && metrics.spend7d >= 75) {
    pushIssue(issues, {
      metric: "Leads",
      value: "0",
      benchmark: "> 0",
      severity: "critical",
      explanation: "Lead spend is not producing form submissions or lead events.",
    });
    return;
  }

  if (metrics.cpl7d > 45 && metrics.leads7d > 0) {
    pushIssue(issues, {
      metric: "CPL",
      value: money(metrics.cpl7d),
      benchmark: "≤ $45",
      severity: metrics.cpl7d > 70 ? "critical" : "high",
      explanation: "Cost per lead exceeds a typical prospecting benchmark.",
    });
  }

  if (
    metrics.qualifiedLeads7d > 0 &&
    metrics.leads7d > 0 &&
    metrics.qualifiedLeads7d / metrics.leads7d < 0.35
  ) {
    pushIssue(issues, {
      metric: "Qualified Leads",
      value: `${metrics.qualifiedLeads7d} of ${metrics.leads7d}`,
      benchmark: "≥ 35% qualified",
      severity: "high",
      explanation: "Lead volume exists but qualification rate is low — targeting or form friction may be off.",
    });
  }

  if (metrics.clicks7d > 30 && metrics.leads7d > 0) {
    const leadRate = (metrics.leads7d / metrics.clicks7d) * 100;
    if (leadRate < 2) {
      pushIssue(issues, {
        metric: "Conversion Rate",
        value: pct(leadRate),
        benchmark: "≥ 2%",
        severity: "medium",
        explanation: "Landing page or form conversion from clicks is below expectations.",
      });
    }
  }

  maybeRoasIssue("leads", metrics, issues);
}

function evaluateTraffic(metrics: CampaignMetricSnapshot, issues: CampaignMetricIssue[]): void {
  if (metrics.ctr7d < 0.8 && metrics.impressions7d > 3000) {
    pushIssue(issues, {
      metric: "CTR",
      value: pct(metrics.ctr7d),
      benchmark: "≥ 0.8%",
      severity: "high",
      explanation: "Click-through rate is weak for a traffic-driving campaign.",
    });
  }

  if (metrics.cpc7d > 2.5 && metrics.clicks7d > 20) {
    pushIssue(issues, {
      metric: "CPC",
      value: money(metrics.cpc7d),
      benchmark: "≤ $2.50",
      severity: "high",
      explanation: "Clicks are expensive relative to typical prospecting traffic campaigns.",
    });
  }

  if (metrics.clicks7d < 30 && metrics.spend7d > 100) {
    pushIssue(issues, {
      metric: "Clicks",
      value: String(metrics.clicks7d),
      benchmark: "≥ 30 (7d)",
      severity: "medium",
      explanation: "Spend is not translating into meaningful site traffic.",
    });
  }

  if (metrics.landingPageViews7d < 20 && metrics.spend7d > 75) {
    pushIssue(issues, {
      metric: "Landing Page Views",
      value: String(metrics.landingPageViews7d),
      benchmark: "≥ 20 (7d)",
      severity: "high",
      explanation: "Traffic is not reaching the landing page at sufficient volume.",
    });
  }

  if (metrics.bounceRate7d > 75 && metrics.landingPageViews7d > 30) {
    pushIssue(issues, {
      metric: "Bounce Rate",
      value: pct(metrics.bounceRate7d),
      benchmark: "≤ 75%",
      severity: "medium",
      explanation: "Visitors are leaving immediately — landing page relevance may be weak.",
    });
  }

  maybeRoasIssue("traffic", metrics, issues);
}

function evaluateEngagement(metrics: CampaignMetricSnapshot, issues: CampaignMetricIssue[]): void {
  if (metrics.ctr7d < 0.6 && metrics.impressions7d > 2000) {
    pushIssue(issues, {
      metric: "Engagement Rate",
      value: pct(metrics.ctr7d),
      benchmark: "≥ 0.6%",
      severity: "high",
      explanation: "Engagement signals (CTR proxy) are weak for an interaction-focused campaign.",
    });
  }

  if (metrics.frequency7d > 4.5 && metrics.impressions7d > 1500) {
    pushIssue(issues, {
      metric: "Frequency",
      value: metrics.frequency7d.toFixed(1),
      benchmark: "≤ 4.5",
      severity: "medium",
      explanation: "Repeated exposure may be reducing engagement rates.",
    });
  }

  const costPerEngagement =
    metrics.clicks7d > 0 ? metrics.spend7d / metrics.clicks7d : 0;
  if (costPerEngagement > 3 && metrics.clicks7d > 10) {
    pushIssue(issues, {
      metric: "Cost per Engagement",
      value: money(costPerEngagement),
      benchmark: "≤ $3.00",
      severity: "medium",
      explanation: "Each engagement action is costing more than expected.",
    });
  }
}

function evaluateAppInstalls(metrics: CampaignMetricSnapshot, issues: CampaignMetricIssue[]): void {
  if (metrics.appInstalls7d === 0 && metrics.spend7d >= 75) {
    pushIssue(issues, {
      metric: "App Installs",
      value: "0",
      benchmark: "> 0",
      severity: "critical",
      explanation: "Install optimization spend is not producing app install events.",
    });
    return;
  }

  if (metrics.costPerInstall7d > 6 && metrics.appInstalls7d > 0) {
    pushIssue(issues, {
      metric: "CPI",
      value: money(metrics.costPerInstall7d),
      benchmark: "≤ $6.00",
      severity: metrics.costPerInstall7d > 10 ? "critical" : "high",
      explanation: "Cost per install is above a typical prospecting benchmark.",
    });
  }

  if (metrics.clicks7d > 40 && metrics.appInstalls7d > 0) {
    const installRate = (metrics.appInstalls7d / metrics.clicks7d) * 100;
    if (installRate < 3) {
      pushIssue(issues, {
        metric: "Install Rate",
        value: pct(installRate),
        benchmark: "≥ 3%",
        severity: "medium",
        explanation: "Store listing or audience fit may be limiting install conversion.",
      });
    }
  }

  if (metrics.activations7d > 0 && metrics.appInstalls7d > 0) {
    const activationRate = (metrics.activations7d / metrics.appInstalls7d) * 100;
    if (activationRate < 25) {
      pushIssue(issues, {
        metric: "Activation Rate",
        value: pct(activationRate),
        benchmark: "≥ 25%",
        severity: "medium",
        explanation: "Installed users are not activating — onboarding or audience fit may be off.",
      });
    }
  }
}

function severityRank(severity: RecommendationSeverity): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[severity];
}

function highestSeverity(issues: CampaignMetricIssue[]): RecommendationSeverity {
  if (issues.length === 0) return "low";
  return issues.reduce(
    (best, issue) => (severityRank(issue.severity) < severityRank(best) ? issue.severity : best),
    issues[0]!.severity,
  );
}

function isRoasOnlyIssue(issues: CampaignMetricIssue[]): boolean {
  return issues.length === 1 && issues[0]!.metric === "ROAS";
}

function buildWhy(
  campaignName: string,
  objectiveLabel: string,
  primaryMetrics: string[],
  issues: CampaignMetricIssue[],
): string {
  const focus = `This is a ${objectiveLabel} campaign — evaluated on ${primaryMetrics.join(", ")}.`;
  if (issues.length === 0) {
    return `${focus} ${campaignName} is performing within objective benchmarks.`;
  }

  const leadIssue = issues[0]!;
  const detail = issues
    .slice(0, 3)
    .map((i) => `${i.metric} ${i.value} (${i.explanation})`)
    .join(" ");

  return `${focus} ${campaignName} needs review because ${leadIssue.explanation} ${detail}`.trim();
}

function recommendedActionFor(
  objective: CampaignObjective,
  issues: CampaignMetricIssue[],
): string {
  if (issues.length === 0) return "Continue monitoring — no changes recommended.";

  const top = issues[0]!;
  switch (objective) {
    case "sales":
    case "catalog_sales":
      return top.metric === "Frequency"
        ? "Refresh creative or expand audiences before changing budget."
        : "Review product-offer fit, landing page, and conversion tracking before pausing.";
    case "brand_awareness":
    case "reach":
      return "Adjust targeting breadth or creative rotation to improve reach efficiency — do not pause solely for low ROAS.";
    case "video_views":
      return "Test shorter hooks and new creative variants to improve ThruPlay and completion rate.";
    case "leads":
      return "Tighten audience qualification or simplify the lead form — optimize CPL before pausing.";
    case "traffic":
      return "Improve ad relevance and landing page speed to lift CTR and lower CPC.";
    case "engagement":
      return "Rotate creative and review placement mix to restore engagement rates.";
    case "app_installs":
      return "Review store listing assets and lookalike quality before reducing install budget.";
    default:
      return "Review targeting, creative, and budget allocation for this objective.";
  }
}

function evaluateMessages(metrics: CampaignMetricSnapshot, issues: CampaignMetricIssue[]): void {
  if (metrics.ctr7d < 0.5 && metrics.impressions7d > 2000) {
    pushIssue(issues, {
      metric: "CTR",
      value: pct(metrics.ctr7d),
      benchmark: "≥ 0.5%",
      severity: "high",
      explanation: "Message ads need stronger creative to start conversations.",
    });
  }

  const costPerMessage = metrics.clicks7d > 0 ? metrics.spend7d / metrics.clicks7d : 0;
  if (costPerMessage > 4 && metrics.clicks7d > 8) {
    pushIssue(issues, {
      metric: "Cost per Message",
      value: money(costPerMessage),
      benchmark: "≤ $4.00",
      severity: "medium",
      explanation: "Each conversation start is costing more than expected.",
    });
  }
}

function runObjectiveEvaluation(
  objective: CampaignObjective,
  metrics: CampaignMetricSnapshot,
  issues: CampaignMetricIssue[],
): void {
  switch (objective) {
    case "sales":
    case "catalog_sales":
      evaluateSales(metrics, issues);
      break;
    case "leads":
      evaluateLeads(metrics, issues);
      break;
    case "traffic":
      evaluateTraffic(metrics, issues);
      break;
    case "brand_awareness":
    case "reach":
      evaluateAwarenessLike(metrics, issues);
      break;
    case "engagement":
      evaluateEngagement(metrics, issues);
      break;
    case "messages":
      evaluateMessages(metrics, issues);
      break;
    case "video_views":
      evaluateVideo(metrics, issues);
      break;
    case "app_installs":
      evaluateAppInstalls(metrics, issues);
      break;
  }
}

/** Evaluate campaign performance based on its classified objective — not ROAS alone. */
export function evaluateCampaignByObjective(campaign: MetaCampaign): CampaignEvaluation {
  const objective = classifyCampaignObjective(campaign);
  const profile = getObjectiveProfile(objective);
  const metrics = buildCampaignMetricSnapshot(campaign);
  const issues: CampaignMetricIssue[] = [];

  if (campaignHasMeasurableSpend(campaign)) {
    runObjectiveEvaluation(objective, metrics, issues);
  }

  const filteredIssues = isRoasOnlyIssue(issues) && profile.roasWeight < 0.2 ? [] : issues;
  const priority = highestSeverity(filteredIssues);
  const needsReview = filteredIssues.some((i) => i.severity === "critical" || i.severity === "high");

  const why = buildWhy(campaign.name, profile.label, profile.primaryMetrics, filteredIssues);
  const recommendedAction = recommendedActionFor(objective, filteredIssues);

  return {
    objective,
    objectiveLabel: profile.label,
    primaryMetrics: profile.primaryMetrics,
    roasWeight: profile.roasWeight,
    needsReview,
    priority: needsReview ? priority : "low",
    why,
    recommendedAction,
    issues: filteredIssues,
    metrics,
  };
}
