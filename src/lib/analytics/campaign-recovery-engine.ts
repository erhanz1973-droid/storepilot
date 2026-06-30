import type { StoreSnapshot, MetaCampaign } from "@/lib/connectors/types";
import type { DecisionItem } from "@/lib/decisions/center";
import type { MarketingCampaignRow } from "@/lib/analytics/types";
import type { CampaignHealth, ProfitDisplay } from "./marketing-manager";
import type { CampaignRecommendationKind } from "./marketing-recommendations";
import { RECOMMENDATION_LABELS } from "./marketing-recommendations";

export type RecoveryStageId =
  | "optimize_campaign"
  | "improve_conversion"
  | "creative_recovery"
  | "audience_recovery"
  | "learning_protection"
  | "monitor"
  | "pause_campaign";

export type RecoveryLadderStepStatus = "completed" | "current" | "pending" | "skipped";

export type RecoveryLadderStep = {
  id: RecoveryStageId;
  label: string;
  status: RecoveryLadderStepStatus;
  emoji: string;
};

export type CampaignRecoveryResult = {
  recommendation: CampaignRecommendationKind;
  recommendationLabel: string;
  recommendationReason: string;
  recoveryProbabilityPct: number;
  confidencePct: number;
  recoveryStage: RecoveryStageId;
  recoveryLadder: RecoveryLadderStep[];
  isLearningPhase: boolean;
  reEvaluateInDays?: number;
};

const PAUSE_RECOVERY_THRESHOLD = 15;
const MIN_CONVERSIONS_FOR_EVAL = 8;

type CampaignSignals = {
  campaignName: string;
  ageDays: number;
  frequency: number;
  ctr: number;
  cpa: number;
  roas: number;
  spend: number;
  purchases: number;
  profit: number | null;
  isLearningLimited: boolean;
  mobileConversionWeak: boolean;
  landingPageIssue: boolean;
  creativeFatigue: boolean;
  audienceSaturation: boolean;
  budgetInefficiency: boolean;
  trafficQualityGood: boolean;
};

function campaignAgeDays(startTime?: string): number {
  if (!startTime) return 21;
  const start = new Date(startTime).getTime();
  if (Number.isNaN(start)) return 21;
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
}

function isLearningLimitedMeta(campaign: MetaCampaign): boolean {
  return (
    /learning/i.test(campaign.metaEffectiveStatus ?? "") ||
    /learning\s*limited/i.test(campaign.name)
  );
}

function inferPurchases(row: MarketingCampaignRow): number {
  return row.purchases > 0 ? row.purchases : row.revenue > 0 ? Math.max(1, Math.round(row.revenue / 80)) : 0;
}

function buildSignals(
  row: MarketingCampaignRow,
  snapshot: StoreSnapshot,
  profit: number | null,
): CampaignSignals {
  const meta = row.channel === "meta" ? snapshot.campaigns.find((c) => c.id === row.id) : undefined;
  const ageDays = meta?.startTime ? campaignAgeDays(meta.startTime) : row.spend > 1500 ? 21 : row.spend > 400 ? 14 : 7;
  const frequency = meta?.frequency7d ?? (row.reach > 0 ? row.impressions / row.reach : 1.5);
  const purchases = inferPurchases(row);
  const ctr = row.ctr;
  const cpa = row.cpa > 0 ? row.cpa : purchases > 0 ? row.spend / purchases : row.spend;

  const creativeFatigue = frequency > 2.5 && ctr < 1.2;
  const audienceSaturation = frequency > 3.2 && cpa > 45;
  const budgetInefficiency = row.roas < 1.15 && row.roas >= 0.65 && row.spend >= 200;
  const trafficQualityGood = ctr >= 1.0 && row.clicks >= 100;

  let mobileConversionWeak = false;
  let landingPageIssue = false;
  const ga4 = snapshot.ga4Snapshot;
  if (ga4?.devices?.length && trafficQualityGood && row.roas < 1.2) {
    const mobile = ga4.devices.find((d) => d.device === "mobile");
    const desktop = ga4.devices.find((d) => d.device === "desktop");
    if (mobile && desktop && mobile.sessions > 80 && desktop.sessions > 80) {
      const mobileRps = mobile.revenue / mobile.sessions;
      const desktopRps = desktop.revenue / desktop.sessions;
      if (desktopRps > 0 && mobileRps < desktopRps * 0.65) {
        mobileConversionWeak = true;
        landingPageIssue = true;
      }
    }
  }
  if (meta?.bounceRate7d != null && meta.bounceRate7d > 55 && trafficQualityGood) {
    landingPageIssue = true;
  }
  if (ga4?.funnelEvents?.verified && trafficQualityGood && row.roas < 1.1) {
    const fe = ga4.funnelEvents;
    if (fe.addToCart30d > 0 && fe.purchases30d / fe.addToCart30d < 0.25) {
      landingPageIssue = true;
    }
  }

  return {
    campaignName: row.campaign,
    ageDays,
    frequency,
    ctr,
    cpa,
    roas: row.roas,
    spend: row.spend,
    purchases,
    profit,
    isLearningLimited: meta ? isLearningLimitedMeta(meta) : false,
    mobileConversionWeak,
    landingPageIssue,
    creativeFatigue,
    audienceSaturation,
    budgetInefficiency,
    trafficQualityGood,
  };
}

function isLearningPhase(signals: CampaignSignals): boolean {
  return (
    signals.ageDays < 7 ||
    signals.isLearningLimited ||
    (signals.purchases > 0 && signals.purchases < MIN_CONVERSIONS_FOR_EVAL && signals.spend >= 150)
  );
}

function computeRecoveryProbability(
  signals: CampaignSignals,
  health: CampaignHealth,
  stage: RecoveryStageId,
): number {
  if (health === "scaling" || health === "healthy") return 88;
  if (stage === "learning_protection") return 72;

  let score = 52;

  if (signals.ageDays < 10) score += 14;
  else if (signals.ageDays >= 21) score -= 12;

  if (signals.ctr >= 1.5) score += 12;
  else if (signals.ctr < 0.8) score -= 10;

  if (signals.frequency <= 2.2) score += 8;
  else if (signals.frequency > 3.5) score -= 14;

  if (signals.roas >= 0.9 && signals.roas < 1.2) score += 10;
  else if (signals.roas < 0.6) score -= 22;
  else if (signals.roas < 0.8) score -= 12;

  if (signals.purchases >= 15) score += 8;
  else if (signals.purchases < 5) score -= 8;

  if (signals.trafficQualityGood && signals.landingPageIssue) score += 6;
  if (signals.creativeFatigue) score -= 6;
  if (signals.budgetInefficiency) score += 5;

  if (stage === "pause_campaign") score = Math.min(score, PAUSE_RECOVERY_THRESHOLD - 1);

  return Math.max(5, Math.min(95, Math.round(score)));
}

function pauseExhaustionMet(signals: CampaignSignals): boolean {
  const budgetAttempted = signals.ageDays >= 10 || signals.spend >= 800;
  const creativeTested = signals.ageDays >= 14 || signals.creativeFatigue;
  const audienceAttempted =
    signals.ageDays >= 12 ||
    /retarget|prospect|lookalike|lal|broad|warm/i.test(signals.campaignName);
  const landingVerified = !signals.landingPageIssue || signals.ageDays >= 14;
  const sustainedLoss = signals.roas < 1 && signals.ageDays >= 14;
  const cpaRising = signals.cpa > 50 && signals.roas < 0.85;

  return (
    signals.ageDays >= 14 &&
    budgetAttempted &&
    creativeTested &&
    audienceAttempted &&
    landingVerified &&
    sustainedLoss &&
    (cpaRising || signals.roas < 0.75)
  );
}

function buildRecoveryLadder(
  stage: RecoveryStageId,
  signals: CampaignSignals,
): RecoveryLadderStep[] {
  const steps: { id: RecoveryStageId; label: string; emoji: string }[] = [
    { id: "optimize_campaign", label: "Optimize Budget", emoji: "🟢" },
    { id: "creative_recovery", label: "Improve Creative", emoji: "🟢" },
    { id: "audience_recovery", label: "Improve Audience", emoji: "🟡" },
    { id: "improve_conversion", label: "Improve Landing Page", emoji: "🟡" },
    { id: "monitor", label: "Monitor", emoji: "🟠" },
    { id: "pause_campaign", label: "Pause Campaign", emoji: "🔴" },
  ];

  const order = steps.map((s) => s.id);
  const currentIdx = order.indexOf(stage === "learning_protection" ? "monitor" : stage);

  function stepStatus(id: RecoveryStageId, idx: number): RecoveryLadderStepStatus {
    if (stage === "learning_protection" && id === "monitor") return "current";
    if (id === "improve_conversion" && !signals.landingPageIssue && id !== stage) return "skipped";
    if (idx < currentIdx) {
      if (id === "optimize_campaign" && signals.ageDays < 8) return "pending";
      return "completed";
    }
    if (idx === currentIdx) return "current";
    return "pending";
  }

  return steps.map((step, idx) => ({
    ...step,
    status: stepStatus(step.id, idx),
  }));
}

function buildOptimizeReason(signals: CampaignSignals): string {
  const lines = [
    "Campaign is underperforming but still has recovery potential.",
    `ROAS ${signals.roas.toFixed(2)} is below target.`,
  ];
  if (signals.budgetInefficiency) {
    lines.push(
      "Efficiency has declined — reducing budget by 20% is expected to stabilize performance without sacrificing all conversions.",
    );
  } else {
    lines.push("Adjust bid strategy, trim poor placements, and reduce audience overlap before stopping spend.");
  }
  if (signals.cpa > 40) {
    lines.push(`CPA increased to $${signals.cpa.toFixed(0)} over the last 7 days.`);
  }
  lines.push("Pausing is premature — optimize first.");
  return lines.join(" ");
}

function buildCreativeReason(signals: CampaignSignals): string {
  return [
    signals.creativeFatigue
      ? "Advertising efficiency is declining — the same audience has seen ads too often, weakening engagement."
      : "Creative engagement is weakening, which typically precedes higher acquisition costs and lower ROAS.",
    `Supporting diagnostics: frequency ${signals.frequency.toFixed(1)}, CTR ${signals.ctr.toFixed(2)}%.`,
    "Replace fatigued creatives, test new hooks, and launch A/B creative tests before reducing spend.",
    "Strong creative recovery often restores ROAS without pausing.",
  ].join(" ");
}

function buildAudienceReason(signals: CampaignSignals): string {
  return [
    "Creative engagement is acceptable but CPA is rising.",
    `CPA is $${signals.cpa.toFixed(0)} — audience efficiency is the likely bottleneck.`,
    "Create Lookalike audiences, exclude poor segments, test broad targeting, or refresh retargeting windows.",
  ].join(" ");
}

function buildLandingReason(signals: CampaignSignals): string {
  const lines = [
    "Traffic quality looks acceptable but purchases are weak.",
    "Users are clicking but not converting — the issue is likely post-click.",
  ];
  if (signals.mobileConversionWeak) {
    lines.push("GA4 shows mobile converts significantly worse than desktop from paid traffic.");
  }
  lines.push("Improve landing page speed, mobile checkout, and offer clarity before pausing ads.");
  return lines.join(" ");
}

function buildLearningReason(signals: CampaignSignals): string {
  const reasons: string[] = [];
  if (signals.ageDays < 7) {
    reasons.push(`Campaign is only ${signals.ageDays} days old.`);
  }
  if (signals.isLearningLimited) {
    reasons.push("Campaign is still in Meta's learning phase (Learning Limited).");
  }
  if (signals.purchases < MIN_CONVERSIONS_FOR_EVAL) {
    reasons.push(`Only ${signals.purchases} conversions in 7 days — insufficient volume for a pause decision.`);
  }
  const waitDays = Math.max(3, 7 - signals.ageDays);
  return `${reasons.join(" ")} Continue learning and re-evaluate in ${waitDays} days. Pausing now would waste optimization data.`;
}

function buildPauseReason(signals: CampaignSignals, recoveryPct: number): string {
  return [
    `Campaign has been active for ${signals.ageDays} days.`,
    "Learning phase completed.",
    "Budget optimization, creative testing, and audience adjustments have been attempted.",
    signals.landingPageIssue ? "Landing page conversion was reviewed." : "Landing page performance verified.",
    `ROAS remained below break-even (${signals.roas.toFixed(2)}) for the evaluation window.`,
    signals.cpa > 50 ? "CPA has been consistently elevated." : "",
    `Recovery probability is only ${recoveryPct}%.`,
    "Every reasonable optimization path has been exhausted — pausing protects profit.",
  ]
    .filter(Boolean)
    .join(" ");
}

function mapStageToRecommendation(stage: RecoveryStageId): CampaignRecommendationKind {
  switch (stage) {
    case "optimize_campaign":
      return "optimize_campaign";
    case "improve_conversion":
      return "landing_page_issue";
    case "creative_recovery":
      return "improve_creative";
    case "audience_recovery":
      return "review_audience";
    case "learning_protection":
      return "continue_learning";
    case "pause_campaign":
      return "pause_campaign";
    default:
      return "reduce_budget";
  }
}

function pickRecoveryStage(health: CampaignHealth, signals: CampaignSignals): RecoveryStageId {
  if (health === "scaling") return "optimize_campaign";
  if (health === "healthy") return "monitor";

  if (isLearningPhase(signals)) return "learning_protection";

  if (signals.budgetInefficiency || (health === "needs_attention" && signals.roas >= 0.85)) {
    return "optimize_campaign";
  }

  if (signals.creativeFatigue || signals.ctr < 0.9) {
    return "creative_recovery";
  }

  if (signals.trafficQualityGood && (signals.landingPageIssue || (signals.roas < 1.1 && signals.ctr >= 1.2))) {
    return "improve_conversion";
  }

  if (signals.audienceSaturation || (signals.trafficQualityGood && signals.cpa > 45)) {
    return "audience_recovery";
  }

  const recoveryPct = computeRecoveryProbability(signals, health, "monitor");
  if (pauseExhaustionMet(signals) && recoveryPct < PAUSE_RECOVERY_THRESHOLD && health === "losing_money") {
    return "pause_campaign";
  }

  if (health === "losing_money" || health === "needs_attention") {
    return "optimize_campaign";
  }

  return "monitor";
}

function buildReasonForStage(
  stage: RecoveryStageId,
  signals: CampaignSignals,
  recoveryPct: number,
): string {
  switch (stage) {
    case "learning_protection":
      return buildLearningReason(signals);
    case "optimize_campaign":
      return buildOptimizeReason(signals);
    case "creative_recovery":
      return buildCreativeReason(signals);
    case "audience_recovery":
      return buildAudienceReason(signals);
    case "improve_conversion":
      return buildLandingReason(signals);
    case "pause_campaign":
      return buildPauseReason(signals, recoveryPct);
    case "monitor":
      return "Performance is borderline — monitor closely and apply the next recovery step if metrics deteriorate.";
    default:
      return "Review campaign performance and apply the recommended optimization.";
  }
}

function recommendationForHealthy(
  row: MarketingCampaignRow,
  health: CampaignHealth,
  snapshot: StoreSnapshot,
  profitMeta: ProfitDisplay,
): CampaignRecoveryResult {
  const kind: CampaignRecommendationKind =
    health === "scaling" ? "scale" : health === "healthy" ? "healthy" : "review_audience";
  const stage: RecoveryStageId = health === "scaling" ? "optimize_campaign" : "monitor";
  const signals = buildSignals(row, snapshot, profitMeta.value);

  return {
    recommendation: kind,
    recommendationLabel: RECOMMENDATION_LABELS[kind],
    recommendationReason:
      health === "scaling"
        ? `Strong ROAS (${row.roas.toFixed(2)}) — consider increasing budget on this winner.`
        : health === "healthy"
          ? "Campaign is performing within your profitability target."
          : "Performance is borderline — review audience and creative before increasing spend.",
    recoveryProbabilityPct: health === "scaling" ? 90 : 75,
    confidencePct: 85,
    recoveryStage: stage,
    recoveryLadder: buildRecoveryLadder(stage, signals),
    isLearningPhase: false,
  };
}

export function evaluateCampaignRecovery(input: {
  row: MarketingCampaignRow;
  health: CampaignHealth;
  profitMeta: ProfitDisplay;
  snapshot: StoreSnapshot;
  decision?: DecisionItem;
}): CampaignRecoveryResult {
  const { row, health, profitMeta, snapshot, decision } = input;

  if (health === "scaling" || health === "healthy" || (health === "monitor" && row.roas >= 1.2)) {
    return recommendationForHealthy(row, health, snapshot, profitMeta);
  }

  const signals = buildSignals(row, snapshot, profitMeta.value);
  let stage = pickRecoveryStage(health, signals);
  let recoveryPct = computeRecoveryProbability(signals, health, stage);

  if (stage === "pause_campaign" && recoveryPct >= PAUSE_RECOVERY_THRESHOLD) {
    stage = "optimize_campaign";
    recoveryPct = computeRecoveryProbability(signals, health, stage);
  }

  if (
    stage !== "pause_campaign" &&
    stage !== "learning_protection" &&
    pauseExhaustionMet(signals) &&
    recoveryPct < PAUSE_RECOVERY_THRESHOLD &&
    health === "losing_money"
  ) {
    stage = "pause_campaign";
    recoveryPct = computeRecoveryProbability(signals, health, stage);
  }

  const recommendation = mapStageToRecommendation(stage);
  let recommendationReason = buildReasonForStage(stage, signals, recoveryPct);

  if (decision?.why && !decision.recommendedAction.toLowerCase().includes("pause")) {
    const firstLine = decision.why.split("\n")[0] ?? decision.why;
    if (firstLine.length > 20) {
      recommendationReason = `${firstLine} ${recommendationReason}`;
    }
  }

  const confidencePct =
    stage === "pause_campaign"
      ? Math.min(92, 70 + (PAUSE_RECOVERY_THRESHOLD - recoveryPct))
      : stage === "learning_protection"
        ? 88
        : Math.min(90, 65 + Math.round(recoveryPct * 0.2));

  return {
    recommendation,
    recommendationLabel: RECOMMENDATION_LABELS[recommendation],
    recommendationReason,
    recoveryProbabilityPct: recoveryPct,
    confidencePct,
    recoveryStage: stage,
    recoveryLadder: buildRecoveryLadder(stage, signals),
    isLearningPhase: stage === "learning_protection",
    reEvaluateInDays: stage === "learning_protection" ? Math.max(3, 7 - signals.ageDays) : undefined,
  };
}
