import type { DecisionItem } from "@/lib/decisions/center";
import type { DailyAiPlaybook, ExecutiveFocusSummary } from "@/lib/analytics/ai-daily-playbook";
import { countLiveCampaignsScanned } from "@/lib/analytics/ai-daily-playbook";
import {
  adsCampaignDataAvailable,
  ADVERTISING_OPPORTUNITIES_WITHOUT_DATA,
  applyCoverageConfidencePenalty,
  buildAdvertisingIntelligencePanel,
  buildBusinessCoverage,
  canEmitAsRecommendation,
  filterBusinessEvidencePoints,
  filterPlaybookTitlesForDataAvailability,
  groundRecommendationEvidence,
} from "@/lib/analytics/data-availability";
import type { ExecutiveAiBehavior } from "@/lib/analytics/executive-ai-behavior";
import type { AiEvidence, PriorityAction } from "@/lib/analytics/executive-advisor";
import type { ExecutiveVisitSnapshot } from "@/lib/analytics/executive-visit";
import type { DecisionImpactPresentation } from "@/lib/impact/decision-impact";
import { buildDecisionImpactPresentation, DECISION_IMPACT_COPY } from "@/lib/impact/decision-impact";
import {
  candidatesFromOpenDecisions,
  computeDecisionImpactForCandidate,
  EXECUTIVE_ACTION_THRESHOLD_PCT,
  EXECUTIVE_MIN_CONFIDENCE_PCT,
  isEligibleExecutiveDecision,
  peekExecutiveActionThreshold,
  resolveExecutiveNetProfitThreshold,
  selectTodaysExecutiveDecision,
} from "@/lib/analytics/executive-decision-ranking";
import {
  buildDecisionAccuracyRollup,
  validationReportsFromDecisionItems,
} from "@/lib/decision-validation";
import { buildDeepAiExecutiveBrief } from "@/lib/analytics/deep-ai-brief";
import type { DeepAiExecutiveBrief } from "@/lib/analytics/deep-ai-brief";
import {
  isAlpineShowcaseActive,
  getAlpineRecoverableProfitPresentation,
} from "@/lib/demo/showcase-overrides";
import { getAlpineHeroRecommendation } from "@/lib/demo/alpine-outfitters/ui-metrics";

function isAdvertisingThreatLabel(label: string): boolean {
  return /\bads?\b|campaigns?|roas|\bmeta\b|google\s*ads?|cpc|cpa|advertis/i.test(label);
}

function looksLikeCampaignObservation(title: string | null | undefined): boolean {
  if (!title) return false;
  return /\bcampaigns?\b|\bads?\b\s+budget|meta\s+budget|google\s*ads?|roas|cpc|cpa/i.test(title);
}

/**
 * Executive Mode — every CEO OS section must agree with this state.
 * Screens never invent independent narratives.
 */
export type ExecutiveMode = "NO_ACTION" | "OBSERVE" | "ACTION_REQUIRED" | "CRITICAL";

export type ExecutiveSinceLastVisitItem = {
  label: string;
  direction: "up" | "down" | "neutral" | "alert";
  detail?: string;
};

export type ExecutiveSinceLastVisit = {
  isFirstVisit: boolean;
  lastVisitedAt?: string;
  items: ExecutiveSinceLastVisitItem[];
};

export type ExecutiveCeoDailyDecision = {
  /** false when nothing qualifies as today's #1 */
  hasDecision: boolean;
  emptyMessage?: string;
  emptyDetail?: string;
  title: string;
  action: string;
  narrative: string;
  ceoOpinion: string;
  /** Canonical presentation — all financial UI reads from this */
  impactPresentation: DecisionImpactPresentation;
  estimatedMinutes: number;
  risk: string;
  evidence: AiEvidence | null;
  evidencePoints: string[];
  approvalHref: string;
  moduleHref?: string;
  decisionId?: string;
  recommendationId?: string;
  /** Rule 8 — evidence standing for today's decision */
  evidenceStanding?: import("@/lib/analytics/data-availability").EvidenceStanding;
  evidenceExplanation?: string;
  evidenceSupportedBy?: string[];
};

export type ExecutiveAccountabilityItem = {
  id: string;
  type: "rejected" | "approved" | "pending" | "measuring";
  title: string;
  narrative: string;
  metrics: { label: string; value: string }[];
};

export type ExecutiveRiskStorySection = {
  label: string;
  body: string;
  amountFormatted?: string;
};

export type ExecutiveRiskStory = {
  mode: ExecutiveMode;
  headline: string;
  /** Prefer rendering these — do not invent a second narrative in the UI */
  sections: ExecutiveRiskStorySection[];
  /** Flat text for a11y / legacy */
  story: string;
  showFinancialLeakage: boolean;
};

export type ExecutivePlannedDecision = {
  rank: number;
  title: string;
  plannedLabel: string;
  impactLabel: string;
  kind: "follow_up" | "optimization";
};

export type ExecutivePlannedSection = {
  title: string;
  chip: string;
  emptyMessage: string;
  kind: "follow_up" | "optimization";
  intro?: string;
};

export type ExecutiveNotes = {
  headline: string;
  body: string;
};

export type ExecutiveEvidencePipelineStep = {
  label: string;
  value: number;
  active: boolean;
};

export type ExecutiveEvidencePipeline = {
  steps: ExecutiveEvidencePipelineStep[];
  currentStageLabel: string;
};

export type ExecutiveObserveContext = {
  /** Why no executive action is recommended yet */
  reasons: string[];
  /** Conditions that would trigger an executive recommendation */
  triggers: string[];
  /** When the system will re-evaluate */
  nextReviewLabel: string;
  nextReviewDetail: string;
};

export type ExecutiveBriefSource = {
  label: string;
  connected: boolean;
};

export type ExecutiveBrief = {
  greeting: string;
  introLine: string;
  /** Platforms/sources that were analyzed */
  analyzedSources: ExecutiveBriefSource[];
  /** Explicit "based on" connected labels (Rule 3) */
  basedOnSources: string[];
  /** Explicit "not available" labels (Rule 3) */
  notAvailableSources: string[];
  dataBasisFooter: string;
  /** Business Coverage Score 0–100 (Rule 4) */
  businessCoverage: {
    scorePct: number;
    confidenceLimitation: string | null;
  };
  /** Advertising Intelligence panel when ads disconnected (Rule 2) */
  advertisingIntelligence: import("@/lib/analytics/data-availability").AdvertisingIntelligencePanel | null;
  /** Evidence-based recommendations (Rule 5 + Rule 8) */
  recommendations: Array<{
    title: string;
    kind: "recommendation" | "hypothesis";
    standing: import("@/lib/analytics/data-availability").EvidenceStanding;
    standingLabel: string;
    supportedBy: string[];
    /** Standing context only (hypothesis / more data) — never restates supportedBy */
    standingNote: string | null;
    /** Business evidence / reasoning — never a duplicate of supportedBy */
    evidence: string[];
  }>;
  /** Soft opportunities without campaign evidence (Rule 5) */
  opportunities: Array<{ title: string; detail: string; kind: "opportunity" }>;
  /** Rule 8 — how today's #1 decision is grounded */
  decisionEvidence: (import("@/lib/analytics/data-availability").EvidenceGrounding & {
    evidence: string[];
  }) | null;
  /** Bullet findings for "What did StorePilot find?" */
  findings: string[];
  /** Primary concern heading + body */
  primaryConcern: {
    headline: string;
    body: string;
    actionRequired: boolean;
  };
  /** "If I were running this business today..." */
  aiRecommendation: string;
  /** Financial outcome headline + amount */
  expectedOutcome: {
    label: string;
    amountFormatted: string | null;
    detail: string;
  };
};

/** Internal (not merchant-facing) Decision Model Accuracy KPI */
export type ExecutiveDecisionModelAccuracy = {
  accuracyPct: number;
  sampleSize: number;
  windowLabel: string;
  correctPct: number;
  neutralPct: number;
  negativePct: number;
  avgPredictionAccuracy: number | null;
};

export type ExecutiveCeoOsLayer = {
  /** Single mode driving the entire Executive briefing */
  mode: ExecutiveMode;
  /** Morning executive brief — the first thing the CEO sees */
  executiveBrief: ExecutiveBrief;
  dailyDecision: ExecutiveCeoDailyDecision;
  sinceLastVisit: ExecutiveSinceLastVisit;
  accountabilityItems: ExecutiveAccountabilityItem[];
  riskStory: ExecutiveRiskStory;
  plannedDecisions: ExecutivePlannedDecision[];
  plannedSection: ExecutivePlannedSection;
  notes: ExecutiveNotes;
  watchMessage: string;
  /** Internal trust metric — Decision Validation layer */
  decisionModelAccuracy: ExecutiveDecisionModelAccuracy | null;
  /** Deep AI discovery briefing — must reinforce Executive Mode, not contradict it */
  deepAiBrief: DeepAiExecutiveBrief;
  /** Visual pipeline + reasoning for OBSERVE state */
  evidencePipeline: ExecutiveEvidencePipeline | null;
  observeContext: ExecutiveObserveContext | null;
};

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function parseMinutes(timeRequired?: string): number {
  if (!timeRequired) return 15;
  if (/immediate|5 min/i.test(timeRequired)) return 5;
  if (/10|15 min/i.test(timeRequired)) return 10;
  if (/hour/i.test(timeRequired)) return 45;
  return 20;
}

function buildCeoOpinion(
  action: PriorityAction | null,
  focus: ExecutiveFocusSummary,
  threatLabel: string,
): string {
  const title = action?.title ?? focus.todayDecision?.title ?? "today's priority";
  const threat = threatLabel || focus.topRisks[0]?.label;
  if (action?.title.toLowerCase().includes("pause") || action?.title.toLowerCase().includes("reduce")) {
    return `If I were running this business today, I would act on ${title} before opening any other dashboard. ${threat ? `The compounding cost of ${threat.toLowerCase()} is what keeps me up at night.` : "Protect margin first, then scale what is already working."}`;
  }
  if (action?.title.toLowerCase().includes("inventory") || action?.title.toLowerCase().includes("clearance")) {
    return `If I were running this business today, I would free trapped cash before increasing ad spend. ${title} is the fastest way to improve liquidity without adding risk.`;
  }
  return `If I were running this business today, I would approve ${title} and defer everything else on today's list. The business does not need more metrics — it needs this decision executed.`;
}

export function buildExecutiveSinceLastVisit(
  current: {
    estimatedProfit: number;
    businessHealthScore: number;
    recoveryPotential: number;
    openDecisionCount: number;
    threatLabel: string;
  },
  previous: ExecutiveVisitSnapshot | null,
): ExecutiveSinceLastVisit {
  if (!previous) return { isFirstVisit: true, items: [] };

  const items: ExecutiveSinceLastVisitItem[] = [];

  if (Math.abs(current.estimatedProfit - previous.estimatedProfit) >= 500) {
    const delta = current.estimatedProfit - previous.estimatedProfit;
    items.push({
      label: `Estimated profit ${delta >= 0 ? "improved" : "declined"} by ${fmt(Math.abs(delta))}/mo`,
      direction: delta >= 0 ? "up" : "down",
    });
  }

  const healthDelta = current.businessHealthScore - previous.businessHealthScore;
  if (Math.abs(healthDelta) >= 5) {
    items.push({
      label: `Business health ${healthDelta >= 0 ? "improved" : "declined"} ${Math.abs(healthDelta)} points`,
      direction: healthDelta >= 0 ? "up" : "down",
      detail: `${previous.businessHealthScore} → ${current.businessHealthScore}`,
    });
  }

  if (current.recoveryPotential - previous.recoveryPotential >= 1000) {
    items.push({
      label: "New recovery opportunity detected",
      direction: "alert",
      detail: `+${fmt(current.recoveryPotential - previous.recoveryPotential)}/mo potential`,
    });
  }

  if (current.openDecisionCount > previous.openDecisionCount) {
    items.push({
      label: `${current.openDecisionCount - previous.openDecisionCount} new decision${current.openDecisionCount - previous.openDecisionCount === 1 ? "" : "s"} awaiting approval`,
      direction: "alert",
    });
  }

  if (current.threatLabel !== previous.threatLabel && current.threatLabel) {
    items.push({
      label: `Primary business risk shifted to: ${current.threatLabel}`,
      direction: "alert",
    });
  }

  if (items.length === 0) {
    items.push({
      label: "Business conditions are stable since your last visit",
      direction: "neutral",
    });
  }

  return {
    isFirstVisit: false,
    lastVisitedAt: previous.visitedAt,
    items,
  };
}

export function buildExecutiveAccountabilityItems(
  aiBehavior: ExecutiveAiBehavior,
  decisions: DecisionItem[],
): ExecutiveAccountabilityItem[] {
  const items: ExecutiveAccountabilityItem[] = [];

  for (const mem of aiBehavior.memory.slice(0, 3)) {
    items.push({
      id: mem.id,
      type: mem.status === "completed" ? "approved" : mem.status === "ignored" ? "rejected" : "pending",
      title: mem.title,
      narrative: mem.contextMessage,
      metrics: [
        { label: "Status", value: mem.statusLabel },
        { label: "Impact", value: `${mem.impactPrefix}${mem.impactLabel}` },
        { label: "Recommended", value: mem.recommendedLabel },
      ],
    });
  }

  for (const d of decisions.filter((x) => x.outcome?.predictionAccuracy).slice(0, 2)) {
    items.push({
      id: `outcome-${d.id}`,
      type: "approved",
      title: d.summary,
      narrative: d.outcome?.outcomeSummary ?? d.why,
      metrics: (d.outcome?.displayMetrics ?? []).slice(0, 3).map((m) => ({
        label: m.label,
        value: m.value,
      })),
    });
  }

  if (items.length === 0 && aiBehavior.beforeAfter.hasMeasuredOutcomes) {
    items.push({
      id: "demo-outcome",
      type: "approved",
      title: "Previous recommendation validated",
      narrative: `Approved actions improved profit by an estimated ${fmt(aiBehavior.beforeAfter.improvement)}/month across ${aiBehavior.beforeAfter.completedActions} completed action${aiBehavior.beforeAfter.completedActions === 1 ? "" : "s"}.`,
      metrics: [
        { label: "Improvement", value: `${fmt(aiBehavior.beforeAfter.improvement)}/mo` },
        { label: "Adoption", value: `${aiBehavior.adoptionScore.scorePct}%` },
      ],
    });
  }

  return items.slice(0, 4);
}

export function resolveExecutiveMode(input: {
  hasDecision: boolean;
  priority?: string | null;
  riskLabel?: string | null;
  businessRecovery?: number;
  materialThreatMonthly?: number;
  /** Playbook / open opportunities (may be below executive bar) */
  opportunityCount?: number;
}): ExecutiveMode {
  if (input.hasDecision) {
    const criticalPriority = /critical/i.test(input.priority ?? "");
    const highRisk = /high/i.test(input.riskLabel ?? "");
    const largeOpportunity = (input.businessRecovery ?? 0) >= 10_000;
    if (criticalPriority || (highRisk && largeOpportunity)) return "CRITICAL";
    return "ACTION_REQUIRED";
  }
  // Opportunities or leakage exist but nothing clears Executive Action Threshold
  if ((input.opportunityCount ?? 0) > 0 || (input.materialThreatMonthly ?? 0) > 0) {
    return "OBSERVE";
  }
  return "NO_ACTION";
}

/**
 * Story = Executive Decision + DecisionImpact (+ explanation).
 * Never invent an independent leakage narrative when mode is NO_ACTION / OBSERVE.
 */
export function buildExecutiveRiskStory(input: {
  mode: ExecutiveMode;
  decision: ExecutiveCeoDailyDecision;
  threatLabel?: string;
  threatAmountMonthly?: number;
  /** Scan context so Story and Deep AI never contradict */
  scan?: {
    campaignsScanned: number;
    potentialOpportunities: number;
    thresholdCurrent?: number;
    thresholdRequired?: number;
  };
}): ExecutiveRiskStory {
  const { mode, decision } = input;
  const scanned = input.scan?.campaignsScanned ?? 0;
  const opps = input.scan?.potentialOpportunities ?? 0;
  const thr = input.scan?.thresholdRequired ?? 75;
  const cur = input.scan?.thresholdCurrent ?? 0;

  if (mode === "NO_ACTION" || mode === "OBSERVE") {
    const sections: ExecutiveRiskStorySection[] =
      mode === "OBSERVE"
        ? [
            {
              label: "Analysis",
              body:
                scanned > 0
                  ? `${scanned} campaigns scanned. ${opps} optimization ${
                      opps === 1 ? "opportunity" : "opportunities"
                    } identified.`
                  : `${opps} optimization ${
                      opps === 1 ? "opportunity" : "opportunities"
                    } identified and under observation.`,
            },
            {
              label: "Why no action",
              body: `None currently exceed the Executive Action Threshold (${cur}/${thr}). StorePilot is collecting additional evidence before recommending executive action.`,
            },
            {
              label: "Next",
              body: "We'll notify you when an opportunity clears the bar for CEO attention.",
            },
          ]
        : [
            {
              label: "Analysis",
              body:
                scanned > 0
                  ? `${scanned} campaigns scanned. No material issues detected.`
                  : "No significant opportunities detected.",
            },
            {
              label: "Executive",
              body: "No executive action required.",
            },
            {
              label: "Next",
              body: "We'll continue monitoring automatically.",
            },
          ];

    return {
      mode,
      headline:
        mode === "OBSERVE"
          ? "Building Evidence — opportunities identified, not yet executive-ready"
          : "No opportunity — no executive action required",
      sections,
      story: sections.map((s) => s.body).join(" "),
      showFinancialLeakage: false,
    };
  }

  const impact = decision.impactPresentation;
  const threatAmount = input.threatAmountMonthly ?? 0;
  const leakageAmount =
    threatAmount > 0 ? threatAmount : impact.heroAmount > 0 ? impact.heroAmount : 0;
  const threatPart = input.threatLabel?.trim()
    ? ` through ${input.threatLabel.trim().toLowerCase()}`
    : "";

  const sections: ExecutiveRiskStorySection[] = [
    {
      label: "Problem",
      body:
        leakageAmount > 0
          ? `Business leaking approximately ${fmt(leakageAmount)}/month${threatPart}.`
          : `A recoverable opportunity requires a decision today.`,
      amountFormatted: leakageAmount > 0 ? fmt(leakageAmount) : undefined,
    },
    {
      label: "Recommended Action",
      body: decision.action,
    },
    {
      label: "Recoverable Opportunity",
      body: `${fmt(impact.heroAmount)}/month`,
      amountFormatted: fmt(impact.heroAmount),
    },
    {
      label: "Expected Net Profit",
      body: impact.netProfitFormatted || `${fmt(impact.netProfitAmount)}/month`,
      amountFormatted: impact.netProfitFormatted || fmt(impact.netProfitAmount),
    },
  ];

  if (mode === "CRITICAL") {
    sections.unshift({
      label: "Urgency",
      body: "Critical — act before compounding loss widens.",
    });
  }

  return {
    mode,
    headline:
      mode === "CRITICAL"
        ? "Critical: act on today's decision"
        : "The business story behind today's decision",
    sections,
    story: sections.map((s) => `${s.label}: ${s.body}`).join(" ↓ "),
    showFinancialLeakage: true,
  };
}

export function buildExecutiveNotes(mode: ExecutiveMode, decision: ExecutiveCeoDailyDecision): ExecutiveNotes {
  if (mode === "NO_ACTION") {
    return {
      headline: "Today does not require executive intervention.",
      body: "No significant opportunities detected. Continue monitoring — we'll notify you if conditions materially change.",
    };
  }
  if (mode === "OBSERVE") {
    return {
      headline: "Building Evidence — potential opportunities detected.",
      body: "StorePilot is validating financial impact and collecting additional evidence before recommending executive action. Finding opportunities does not automatically require a CEO decision.",
    };
  }
  if (mode === "CRITICAL") {
    return {
      headline: `Critical decision: ${decision.action}`,
      body: "Defer everything else until this is approved or deliberately rejected.",
    };
  }
  return {
    headline: `Today's highest-impact decision is ${decision.action}.`,
    body: "Everything else can wait.",
  };
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

export function buildExecutiveBrief(input: {
  mode: ExecutiveMode;
  domains: { label: string; status: string }[];
  connectedSources?: {
    shopify?: boolean;
    metaAds?: boolean;
    googleAds?: boolean;
    ga4?: boolean;
    inventory?: boolean;
    customers?: boolean;
  };
  campaignsScanned: number;
  potentialOpportunities: number;
  biggestThreat: { label: string; amountMonthly: number };
  bestOpportunity: { label: string; amountMonthly: number };
  estimatedProfit: number;
  priorityAction: PriorityAction | null;
  dailyDecision: ExecutiveCeoDailyDecision;
  businessHealthLabel: string;
  observingCampaignName?: string | null;
  /** Evidence-based playbook / decision titles already filtered for data availability */
  recommendationTitles?: Array<string | { title: string; evidence?: string[] }>;
}): ExecutiveBrief {
  const src = input.connectedSources ?? {};
  const analyzedSources: ExecutiveBriefSource[] = [
    { label: "Shopify", connected: src.shopify !== false },
    { label: "Meta Ads", connected: src.metaAds ?? false },
    { label: "Google Ads", connected: src.googleAds ?? false },
    { label: "GA4", connected: src.ga4 ?? false },
    { label: "Inventory", connected: src.inventory !== false },
    { label: "Customers", connected: src.customers !== false },
  ];

  const basedOnSources = analyzedSources.filter((s) => s.connected).map((s) => s.label);
  const notAvailableSources = analyzedSources.filter((s) => !s.connected).map((s) => s.label);
  const coverage = buildBusinessCoverage(src);
  const adsAvailable = adsCampaignDataAvailable(src);

  const introLine =
    basedOnSources.length > 0
      ? `Today's Executive Briefing is based on ${basedOnSources.join(", ")}. This analysis reflects only the connected business systems.`
      : "I don't have enough connected systems yet to brief you with confidence.";

  // Findings — never invent campaign analysis without ads data
  const findings: string[] = [];
  if (input.campaignsScanned > 0 && adsAvailable) {
    findings.push(`${input.campaignsScanned} campaigns analyzed`);
  } else if (!adsAvailable) {
    findings.push("No advertising platforms connected — campaign analysis skipped");
  }
  if (input.potentialOpportunities > 0) {
    findings.push(
      `${input.potentialOpportunities} evidence-based ${
        input.potentialOpportunities === 1 ? "recommendation" : "recommendations"
      } from connected data`,
    );
  }
  const threatUsable =
    input.biggestThreat.amountMonthly > 0 &&
    canEmitAsRecommendation(input.biggestThreat.label || "x", src);
  if (threatUsable) {
    if (isAdvertisingThreatLabel(input.biggestThreat.label) && adsAvailable) {
      findings.push(`Advertising leakage identified: ${input.biggestThreat.label}`);
    } else if (!isAdvertisingThreatLabel(input.biggestThreat.label)) {
      findings.push(`Profit leakage identified: ${input.biggestThreat.label}`);
    }
  } else if (adsAvailable) {
    findings.push("Advertising remains profitable overall");
  }
  if (
    adsAvailable &&
    input.observingCampaignName &&
    looksLikeCampaignObservation(input.observingCampaignName)
  ) {
    findings.push(`One campaign is under close observation: ${input.observingCampaignName}`);
  }
  const healthPositive = !/(poor|critical)/i.test(input.businessHealthLabel);
  if (src.customers === true) {
    findings.push(
      healthPositive
        ? "Customer retention remains healthy"
        : "Customer retention requires attention",
    );
  } else {
    findings.push("Customer records are not available yet — retention insights are limited");
  }

  // Primary concern — never elevate ad threats without ads data
  let primaryConcern: ExecutiveBrief["primaryConcern"];
  const threatIsAd =
    isAdvertisingThreatLabel(input.biggestThreat.label) ||
    !canEmitAsRecommendation(input.biggestThreat.label || "x", src);

  if (
    (input.mode === "ACTION_REQUIRED" || input.mode === "CRITICAL") &&
    !(threatIsAd && !adsAvailable && isAdvertisingThreatLabel(input.biggestThreat.label))
  ) {
    const threat = input.biggestThreat;
    const decisionTitle = input.dailyDecision.action;
    const useThreat =
      threat.amountMonthly > 0 && canEmitAsRecommendation(threat.label || decisionTitle, src);
    primaryConcern = {
      headline: useThreat ? threat.label || decisionTitle : decisionTitle,
      body: useThreat
        ? `${threat.label} is now destroying approximately ${fmt(threat.amountMonthly)}/month in recoverable profit. Executive action is recommended today.`
        : `Executive action is recommended today: ${decisionTitle}.`,
      actionRequired: true,
    };
  } else if (input.mode === "OBSERVE" && input.observingCampaignName && adsAvailable) {
    primaryConcern = {
      headline: input.observingCampaignName,
      body: `${input.observingCampaignName} has been underperforming. Although the impact is increasing, current evidence is not yet sufficient to recommend executive intervention. StorePilot continues monitoring.`,
      actionRequired: false,
    };
  } else if (!adsAvailable && (input.mode === "ACTION_REQUIRED" || input.mode === "CRITICAL")) {
    const decisionTitle = input.dailyDecision.action;
    if (canEmitAsRecommendation(decisionTitle, src)) {
      primaryConcern = {
        headline: decisionTitle || input.biggestThreat.label,
        body:
          input.biggestThreat.amountMonthly > 0 &&
          canEmitAsRecommendation(input.biggestThreat.label, src)
            ? `${input.biggestThreat.label} is now destroying approximately ${fmt(input.biggestThreat.amountMonthly)}/month in recoverable profit. Executive action is recommended today.`
            : `Executive action is recommended today: ${decisionTitle}.`,
        actionRequired: true,
      };
    } else {
      primaryConcern = {
        headline: "Connect advertising to unlock campaign analysis",
        body: "I don't have enough advertising data to evaluate campaign performance. Shopify, inventory, and customer recommendations remain available from connected systems.",
        actionRequired: false,
      };
    }
  } else {
    primaryConcern = {
      headline: "No material concerns",
      body: "No immediate threats detected across connected platforms. All key metrics remain within acceptable thresholds.",
      actionRequired: false,
    };
  }

  // AI recommendation
  let aiRecommendation: string;
  const pa = input.priorityAction;
  if (pa && (input.mode === "ACTION_REQUIRED" || input.mode === "CRITICAL")) {
    if (!canEmitAsRecommendation(pa.title, src)) {
      aiRecommendation =
        "I don't have enough advertising data to recommend campaign changes. I would focus on inventory and merchandising opportunities visible in Shopify until Meta or Google Ads is connected.";
    } else {
      const parts: string[] = [];
      if (pa.suggestedAction) parts.push(pa.suggestedAction);
      else parts.push(pa.title);
      if (pa.whyThisMatters?.businessImpact) {
        parts.push(pa.whyThisMatters.businessImpact);
      }
      aiRecommendation = `I would ${parts[0]?.charAt(0).toLowerCase()}${parts[0]?.slice(1) ?? ""}${parts[1] ? `. ${parts[1]}` : ""}`;
    }
  } else if (input.mode === "OBSERVE") {
    aiRecommendation =
      "I would continue monitoring and let the evidence build. No premature action needed — intervening too early risks optimizing on incomplete data.";
  } else {
    aiRecommendation =
      "I would maintain current operations. The business is performing within healthy parameters across all connected platforms.";
  }

  // Expected outcome
  let expectedOutcome: ExecutiveBrief["expectedOutcome"];
  if (input.dailyDecision.hasDecision && input.dailyDecision.impactPresentation.heroAmount > 0) {
    expectedOutcome = {
      label: "Estimated Monthly Profit Opportunity",
      amountFormatted: input.dailyDecision.impactPresentation.heroValueFormatted,
      detail: `If approved, this opportunity is projected to recover ${input.dailyDecision.impactPresentation.heroValueFormatted}/month.`,
    };
  } else if (input.bestOpportunity.amountMonthly > 0 && input.mode === "OBSERVE") {
    expectedOutcome = {
      label: "Estimated Monthly Profit Opportunity",
      amountFormatted: null,
      detail: `The largest observed opportunity remains below the Executive Decision Threshold. StorePilot will escalate when evidence is sufficient.`,
    };
  } else {
    expectedOutcome = {
      label: "No material executive opportunity today",
      amountFormatted: null,
      detail: "No significant profit opportunity requires executive attention at this time.",
    };
  }

  const recommendationTitles = (input.recommendationTitles ?? [])
    .map((entry) => (typeof entry === "string" ? { title: entry, evidence: [] as string[] } : entry))
    .filter((entry) => canEmitAsRecommendation(entry.title, src))
    .slice(0, 5);

  const recommendations = recommendationTitles.map(({ title, evidence: evidenceIn }) => {
    const isTodayDecision =
      input.dailyDecision.hasDecision && input.dailyDecision.action === title;
    const grounded = groundRecommendationEvidence({
      title,
      sources: src,
      evidencePointCount: isTodayDecision
        ? input.dailyDecision.evidencePoints.length
        : Math.max(evidenceIn?.length ?? 0, /connect customer data/i.test(title) ? 0 : 1),
      confidencePct: isTodayDecision
        ? input.dailyDecision.impactPresentation.confidencePct
        : /connect customer data/i.test(title)
          ? 55
          : 70,
    });
    const evidence = isTodayDecision
      ? filterBusinessEvidencePoints(input.dailyDecision.evidencePoints).slice(0, 4)
      : filterBusinessEvidencePoints(evidenceIn ?? []).slice(0, 4);
    return {
      title,
      kind: (grounded.standing === "recommendation" ? "recommendation" : "hypothesis") as
        | "recommendation"
        | "hypothesis",
      standing: grounded.standing,
      standingLabel: grounded.label,
      supportedBy: grounded.supportedBy,
      standingNote: grounded.explanation.trim() ? grounded.explanation : null,
      evidence,
    };
  });

  const decisionBusinessEvidence = filterBusinessEvidencePoints(
    input.dailyDecision.evidencePoints,
  ).slice(0, 4);

  const decisionEvidence =
    input.dailyDecision.evidenceStanding &&
    (input.dailyDecision.evidenceExplanation != null ||
      (input.dailyDecision.evidenceSupportedBy?.length ?? 0) > 0 ||
      decisionBusinessEvidence.length > 0)
      ? {
          standing: input.dailyDecision.evidenceStanding,
          supportedBy: input.dailyDecision.evidenceSupportedBy ?? [],
          missingRequired: [] as string[],
          label:
            input.dailyDecision.evidenceStanding === "recommendation"
              ? "Recommendation"
              : input.dailyDecision.evidenceStanding === "hypothesis"
                ? "Hypothesis"
                : "More data needed",
          explanation: input.dailyDecision.evidenceExplanation ?? "",
          evidence: decisionBusinessEvidence,
        }
      : input.dailyDecision.hasDecision
        ? {
            ...groundRecommendationEvidence({
              title: input.dailyDecision.action,
              sources: src,
              evidencePointCount: input.dailyDecision.evidencePoints.length,
              confidencePct: input.dailyDecision.impactPresentation.confidencePct,
            }),
            evidence: decisionBusinessEvidence,
          }
        : null;

  // Soften AI copy when today's decision is only a hypothesis / insufficient
  if (decisionEvidence?.standing === "insufficient_data") {
    aiRecommendation = `I don't have enough data to make a strong recommendation yet. ${decisionEvidence.explanation}`;
  } else if (decisionEvidence?.standing === "hypothesis") {
    aiRecommendation = `I would treat this as a hypothesis to evaluate — not a settled fact. ${decisionEvidence.explanation}`;
  }

  const opportunities = !adsAvailable
    ? ADVERTISING_OPPORTUNITIES_WITHOUT_DATA.map((o) => ({
        title: o.title,
        detail: o.detail,
        kind: "opportunity" as const,
      }))
    : [];

  return {
    greeting: timeGreeting(),
    introLine,
    analyzedSources,
    basedOnSources,
    notAvailableSources,
    dataBasisFooter: "This analysis reflects only the connected business systems. Assumptions are never presented as facts.",
    businessCoverage: {
      scorePct: coverage.scorePct,
      confidenceLimitation: coverage.confidenceLimitation,
    },
    advertisingIntelligence: adsAvailable ? null : buildAdvertisingIntelligencePanel(),
    recommendations,
    opportunities,
    decisionEvidence,
    findings,
    primaryConcern,
    aiRecommendation,
    expectedOutcome,
  };
}

export function buildExecutiveEvidencePipeline(input: {
  campaignsScanned: number;
  potentialOpportunities: number;
  passedFinancialTrust: number;
  passedDecisionValidation: number;
  exceededThreshold: number;
}): ExecutiveEvidencePipeline {
  const { campaignsScanned, potentialOpportunities, passedFinancialTrust, passedDecisionValidation, exceededThreshold } = input;

  const steps: ExecutiveEvidencePipelineStep[] = [
    { label: "Campaigns Scanned", value: campaignsScanned, active: campaignsScanned > 0 },
    { label: "Opportunities Identified", value: potentialOpportunities, active: potentialOpportunities > 0 },
    { label: "Passed Financial Trust", value: passedFinancialTrust, active: passedFinancialTrust > 0 },
    { label: "Passed Decision Validation", value: passedDecisionValidation, active: passedDecisionValidation > 0 },
    { label: "Exceeded Executive Threshold", value: exceededThreshold, active: exceededThreshold > 0 },
  ];

  let currentStageLabel = "Building Evidence";
  if (exceededThreshold > 0) currentStageLabel = "Ready for Executive Action";
  else if (passedDecisionValidation > 0) currentStageLabel = "Building Evidence";
  else if (passedFinancialTrust > 0) currentStageLabel = "Decision Validation";
  else if (potentialOpportunities > 0) currentStageLabel = "Financial Trust Check";
  else currentStageLabel = "Scanning";

  return { steps, currentStageLabel };
}

export function buildExecutiveObserveContext(input: {
  thresholdCurrent: number;
  thresholdRequired: number;
  confidencePct: number;
  minConfidencePct: number;
  netProfit: number;
  minNetProfit: number;
  highestTitle: string | null;
}): ExecutiveObserveContext {
  const reasons: string[] = [];
  const triggers: string[] = [];

  if (input.netProfit < input.minNetProfit) {
    reasons.push("Expected monthly profit is below today's executive threshold.");
    triggers.push(`Expected monthly profit exceeds ${fmt(input.minNetProfit)}`);
  }
  if (input.confidencePct < input.minConfidencePct) {
    reasons.push("Additional performance data is needed.");
    triggers.push(`AI confidence exceeds ${input.minConfidencePct}%`);
  }
  if (input.thresholdCurrent < input.thresholdRequired) {
    reasons.push("Confidence is increasing but not yet sufficient for a CEO recommendation.");
    triggers.push(`Executive readiness score exceeds ${input.thresholdRequired}`);
  }

  if (reasons.length === 0) {
    reasons.push("Evidence is being collected to validate this opportunity.");
  }
  if (triggers.length === 0) {
    triggers.push("Opportunity clears all trust and validation gates");
  }

  return {
    reasons,
    triggers,
    nextReviewLabel: "24 hours",
    nextReviewDetail: "StorePilot will automatically re-evaluate this opportunity as new data arrives.",
  };
}

export function buildExecutivePlannedSection(mode: ExecutiveMode): ExecutivePlannedSection {
  if (mode === "NO_ACTION" || mode === "OBSERVE") {
    return {
      title: "Future Optimization Opportunities",
      chip: "Optional",
      kind: "optimization",
      emptyMessage: "No scheduled optimizations — monitoring continues.",
      intro: "These are improvements, not urgent executive actions.",
    };
  }
  return {
    title: "Planned for later",
    chip: "Not today",
    kind: "follow_up",
    emptyMessage: "Nothing deferred — focus on today's decision.",
    intro: "Lower-priority follow-ups after today's decision.",
  };
}

export function buildExecutivePlannedDecisions(
  playbook: DailyAiPlaybook,
  mode: ExecutiveMode,
  primaryTitle?: string,
): ExecutivePlannedDecision[] {
  const kind = mode === "NO_ACTION" || mode === "OBSERVE" ? "optimization" : "follow_up";
  const labels =
    kind === "optimization"
      ? (["Tomorrow", "Next Week", "Later"] as const)
      : (["Tomorrow", "This week", "Next week"] as const);

  return playbook.items
    .filter((item) => {
      if (!primaryTitle) return true;
      return item.title.trim().toLowerCase() !== primaryTitle.trim().toLowerCase();
    })
    .slice(0, 3)
    .map((item, i) => ({
      rank: item.rank,
      title: item.title,
      plannedLabel: labels[i] ?? "Later",
      impactLabel: item.impactLabel,
      kind,
    }));
}

export function buildExecutiveCeoOsLayer(input: {
  priorityAction: PriorityAction | null;
  executiveFocus: ExecutiveFocusSummary;
  dailyPlaybook: DailyAiPlaybook;
  aiBehavior: ExecutiveAiBehavior;
  decisions: DecisionItem[];
  executiveMode: {
    biggestThreat: { label: string; amountMonthly: number };
    bestOpportunity: { label: string; amountMonthly: number };
    estimatedProfit: number;
  };
  previousVisit: ExecutiveVisitSnapshot | null;
  /** Campaign scan count for Deep AI / Executive consistency */
  campaignsScanned?: number;
  observingCampaignName?: string | null;
  upgradePlanLabel?: string | null;
  isUnlimitedPlan?: boolean;
  /** Demo Mode: when Alpine snapshot, Recoverable Profit comes from Demo Provider */
  snapshot?: import("@/lib/connectors/types").StoreSnapshot | null;
  /** Connected integration context for Executive Brief */
  connectedSources?: {
    shopify?: boolean;
    metaAds?: boolean;
    googleAds?: boolean;
    ga4?: boolean;
    inventory?: boolean;
    customers?: boolean;
  };
}): ExecutiveCeoOsLayer {
  const action = input.priorityAction;
  const focus = input.executiveFocus;
  const openDecisions = input.decisions.filter((d) => d.status === "open" || d.status === "viewed").length;

  const emptyPresentation: DecisionImpactPresentation = {
    heroLabel: DECISION_IMPACT_COPY.heroLabel,
    heroAmount: 0,
    heroValueFormatted: "$0",
    heroTooltip: DECISION_IMPACT_COPY.heroTooltip,
    netProfitLabel: DECISION_IMPACT_COPY.netProfitImprovement,
    netProfitAmount: 0,
    netProfitFormatted: "$0/month",
    confidencePct: 0,
    showNetProfitSecondary: false,
    waterfall: [],
    waterfallNarrative: "",
  };

  // Re-rank from open decisions so Today's #1 always matches Impact Engine eligibility.
  const connectedSources = input.connectedSources ?? {};
  const openCandidates = candidatesFromOpenDecisions(input.decisions).filter((c) =>
    canEmitAsRecommendation(c.title, connectedSources),
  );
  const selection = selectTodaysExecutiveDecision(openCandidates);

  let dailyDecision: ExecutiveCeoDailyDecision;

  /** Demo Mode Alpine: Recoverable Profit Opportunity from Demo Provider only */
  if (input.snapshot && isAlpineShowcaseActive(input.snapshot)) {
    const hero = getAlpineHeroRecommendation();
    const presentation = getAlpineRecoverableProfitPresentation();
    dailyDecision = {
      hasDecision: true,
      title: "Today's #1 executive decision",
      action: hero.title,
      narrative: hero.description,
      ceoOpinion: `Highest-leverage move for Alpine Outfitters: ${hero.title}. Estimated recoverable opportunity ${presentation.heroValueFormatted}/month.`,
      impactPresentation: presentation,
      estimatedMinutes: 15,
      risk: hero.priority === "critical" ? "Medium Risk" : "Low Risk",
      evidence: null,
      evidencePoints: hero.evidence.map((e) => `${e.label}: ${e.value}`),
      approvalHref: `/approvals?recommendationId=${encodeURIComponent(hero.id)}`,
      recommendationId: hero.id,
    };
  } else if (selection.kind === "none") {
    // Also try priority action if featured was built from opportunities with known amounts
    if (action) {
      const candidate = {
        id: action.decisionId ?? action.recommendationId ?? "priority",
        title: action.title,
        description: action.description,
        impactLabel: action.impactLabel,
        confidencePct: action.confidencePct,
        priority: "high" as const,
        risk: (/high/i.test(action.risk?.label ?? "")
          ? "high"
          : /medium/i.test(action.risk?.label ?? "")
            ? "medium"
            : "low") as "low" | "medium" | "high",
        decisionId: action.decisionId,
        recommendationId: action.recommendationId,
        opportunityKey: action.opportunityKey,
        knownBusinessRecovery: action.impactMonthly,
        knownNetProfit: action.netProfitMonthly,
        suggestedAction: action.suggestedAction,
        entityType: action.title.toLowerCase().includes("campaign")
          ? ("campaign" as const)
          : undefined,
      };
      const impact = computeDecisionImpactForCandidate(candidate);
      if (isEligibleExecutiveDecision(impact, candidate)) {
        const recommendationId = action.recommendationId;
        const approvalBase = focus.todayDecision?.approvalHref ?? "/approvals";
        const approvalHref = recommendationId
          ? `${approvalBase}${approvalBase.includes("?") ? "&" : "?"}recommendationId=${encodeURIComponent(recommendationId)}`
          : approvalBase;

        dailyDecision = {
          hasDecision: true,
          title: "Today's #1 executive decision",
          action: action.title,
          narrative: action.whyThisMatters
            ? `${action.whyThisMatters.currentSituation} ${action.whyThisMatters.businessImpact}`
            : `This is the highest-leverage move across marketing, profit, inventory, and sales.`,
          ceoOpinion: buildCeoOpinion(action, focus, input.executiveMode.biggestThreat.label),
          impactPresentation: buildDecisionImpactPresentation(impact),
          estimatedMinutes: parseMinutes(action.timeRequired),
          risk: action.risk.label ?? "Low Risk",
          evidence: action.evidence ?? null,
          evidencePoints: action.confidenceReasons ?? [],
          approvalHref,
          moduleHref: focus.todayDecision?.moduleHref,
          decisionId: action.decisionId,
          recommendationId,
        };
      } else {
        dailyDecision = {
          hasDecision: false,
          emptyMessage: selection.message,
          emptyDetail: selection.detail,
          title: "No executive decision required today",
          action: selection.message,
          narrative: selection.detail,
          ceoOpinion: selection.detail,
          impactPresentation: emptyPresentation,
          estimatedMinutes: 0,
          risk: "Low Risk",
          evidence: null,
          evidencePoints: [],
          approvalHref: "/approvals",
        };
      }
    } else {
      dailyDecision = {
        hasDecision: false,
        emptyMessage: selection.message,
        emptyDetail: selection.detail,
        title: "No executive decision required today",
        action: selection.message,
        narrative: selection.detail,
        ceoOpinion: selection.detail,
        impactPresentation: emptyPresentation,
        estimatedMinutes: 0,
        risk: "Low Risk",
        evidence: null,
        evidencePoints: [],
        approvalHref: "/approvals",
      };
    }
  } else {
    const { candidate, impact } = selection.ranked;
    const recommendationId = candidate.recommendationId ?? action?.recommendationId;
    const approvalBase = focus.todayDecision?.approvalHref ?? "/approvals";
    const approvalHref = recommendationId
      ? `${approvalBase}${approvalBase.includes("?") ? "&" : "?"}recommendationId=${encodeURIComponent(recommendationId)}`
      : approvalBase;

    const matchedAction =
      action &&
      (action.decisionId === candidate.decisionId ||
        action.recommendationId === candidate.recommendationId)
        ? action
        : null;

    dailyDecision = {
      hasDecision: true,
      title: "Today's #1 executive decision",
      action: candidate.title,
      narrative: matchedAction?.whyThisMatters
        ? `${matchedAction.whyThisMatters.currentSituation} ${matchedAction.whyThisMatters.businessImpact}`
        : candidate.description ||
          `This is the highest-leverage move across marketing, profit, inventory, and sales. Everything else on today's list can wait.`,
      ceoOpinion: buildCeoOpinion(
        matchedAction ??
          ({
            ...action,
            title: candidate.title,
            impactMonthly: impact.businessRecovery,
            netProfitMonthly: impact.netProfitImpact,
            confidencePct: impact.confidence,
          } as PriorityAction),
        focus,
        input.executiveMode.biggestThreat.label,
      ),
      impactPresentation: buildDecisionImpactPresentation(impact),
      estimatedMinutes: parseMinutes(matchedAction?.timeRequired),
      risk: matchedAction?.risk.label ?? (candidate.risk === "high" ? "High Risk" : candidate.risk === "medium" ? "Medium Risk" : "Low Risk"),
      evidence: matchedAction?.evidence ?? null,
      evidencePoints: matchedAction?.confidenceReasons ?? [],
      approvalHref,
      moduleHref: focus.todayDecision?.moduleHref,
      decisionId: candidate.decisionId,
      recommendationId,
    };
  }

  const thresholdPeek = peekExecutiveActionThreshold(openCandidates);
  const potentialOpportunities = Math.max(
    input.dailyPlaybook.items.length,
    openCandidates.length,
  );
  // Never substitute opportunity count for campaign scan count — that invents
  // "7 campaigns analyzed" when Meta/Google Ads are disconnected.
  const campaignsScanned =
    input.campaignsScanned ?? countLiveCampaignsScanned(input.snapshot);

  const adsConnected =
    Boolean(input.connectedSources?.metaAds) || Boolean(input.connectedSources?.googleAds);
  const observingCampaignNameRaw =
    input.observingCampaignName ??
    thresholdPeek?.title ??
    input.dailyPlaybook.items.find((i) => i.module === "marketing")?.title ??
    null;
  const observingCampaignName =
    adsConnected && looksLikeCampaignObservation(observingCampaignNameRaw)
      ? observingCampaignNameRaw
      : null;

  // Rule 4 + Rule 8 — coverage penalty and evidence standing before mode resolution
  if (dailyDecision.hasDecision) {
    const coverage = buildBusinessCoverage(connectedSources);
    const adjusted = applyCoverageConfidencePenalty(
      dailyDecision.impactPresentation.confidencePct,
      coverage,
    );
    const grounded = groundRecommendationEvidence({
      title: dailyDecision.action,
      sources: connectedSources,
      evidencePointCount: dailyDecision.evidencePoints.length,
      confidencePct: adjusted.confidencePct,
    });

    if (grounded.standing === "insufficient_data") {
      dailyDecision = {
        ...dailyDecision,
        hasDecision: false,
        title: "More data needed",
        action: dailyDecision.action,
        emptyMessage: "More data is needed before a recommendation.",
        emptyDetail: grounded.explanation,
        narrative: grounded.explanation,
        ceoOpinion: grounded.explanation,
        impactPresentation: {
          ...dailyDecision.impactPresentation,
          confidencePct: adjusted.confidencePct,
          heroAmount: 0,
          heroValueFormatted: "$0",
          netProfitAmount: 0,
          netProfitFormatted: "$0/month",
        },
        evidenceStanding: grounded.standing,
        evidenceExplanation: grounded.explanation || undefined,
        evidenceSupportedBy: grounded.supportedBy,
        evidencePoints: filterBusinessEvidencePoints([
          ...dailyDecision.evidencePoints,
          ...(adjusted.limitation ? [adjusted.limitation] : []),
        ]),
      };
    } else {
      dailyDecision = {
        ...dailyDecision,
        title:
          grounded.standing === "hypothesis"
            ? "Hypothesis to evaluate"
            : dailyDecision.title,
        impactPresentation: {
          ...dailyDecision.impactPresentation,
          confidencePct: adjusted.confidencePct,
        },
        evidenceStanding: grounded.standing,
        evidenceExplanation: grounded.explanation || undefined,
        evidenceSupportedBy: grounded.supportedBy,
        evidencePoints: filterBusinessEvidencePoints([
          ...dailyDecision.evidencePoints,
          ...(adjusted.limitation ? [adjusted.limitation] : []),
        ]),
        ceoOpinion:
          grounded.standing === "hypothesis"
            ? `Hypothesis — not a settled fact. ${grounded.explanation}`
            : dailyDecision.ceoOpinion,
      };
    }
  }

  const mode = resolveExecutiveMode({
    hasDecision: dailyDecision.hasDecision,
    priority: selection.kind === "decision" ? selection.ranked.candidate.priority : null,
    riskLabel: dailyDecision.risk,
    businessRecovery: dailyDecision.impactPresentation.heroAmount,
    materialThreatMonthly: input.executiveMode.biggestThreat.amountMonthly,
    opportunityCount: potentialOpportunities,
  });

  // Align empty-state copy with mode (Deep AI must match)
  if (!dailyDecision.hasDecision) {
    if (mode === "OBSERVE") {
      dailyDecision = {
        ...dailyDecision,
        emptyMessage: "No executive action required today.",
        emptyDetail:
          "Potential opportunities have been identified. StorePilot is validating their financial impact before recommending executive action.",
        title: "Building Evidence",
        action: "Building Evidence — validating opportunity.",
        narrative: dailyDecision.emptyDetail ?? dailyDecision.narrative,
      };
    } else {
      dailyDecision = {
        ...dailyDecision,
        emptyMessage: "No executive decision required today.",
        emptyDetail:
          "No significant opportunities detected. Your business is operating within acceptable thresholds.",
        title: "No opportunity",
      };
    }
  }

  const riskStory = buildExecutiveRiskStory({
    mode,
    decision: dailyDecision,
    threatLabel: dailyDecision.hasDecision ? input.executiveMode.biggestThreat.label : undefined,
    threatAmountMonthly: dailyDecision.hasDecision
      ? input.executiveMode.biggestThreat.amountMonthly
      : 0,
    scan: {
      campaignsScanned,
      potentialOpportunities,
      thresholdCurrent: thresholdPeek?.readinessPct,
      thresholdRequired: thresholdPeek?.requiredPct,
    },
  });

  const plannedSection = buildExecutivePlannedSection(mode);
  const playbookForPlanning = {
    ...input.dailyPlaybook,
    items: filterPlaybookTitlesForDataAvailability(
      input.dailyPlaybook.items,
      connectedSources,
    ),
  };
  const plannedDecisions = buildExecutivePlannedDecisions(
    playbookForPlanning,
    mode,
    dailyDecision.hasDecision ? dailyDecision.action : undefined,
  );
  const notes = buildExecutiveNotes(mode, dailyDecision);

  const sinceLastVisit = buildExecutiveSinceLastVisit(
    {
      estimatedProfit: input.executiveMode.estimatedProfit,
      businessHealthScore: focus.businessHealth.score,
      recoveryPotential: focus.recoveryPotentialMonthly,
      openDecisionCount: openDecisions,
      threatLabel: input.executiveMode.biggestThreat.label,
    },
    input.previousVisit,
  );

  const validationReports = validationReportsFromDecisionItems(input.decisions);
  const accuracyRollup = buildDecisionAccuracyRollup(validationReports, { limit: 500 });
  const decisionModelAccuracy: ExecutiveDecisionModelAccuracy | null =
    accuracyRollup.sampleSize > 0
      ? {
          accuracyPct: accuracyRollup.decisionModelAccuracyPct,
          sampleSize: accuracyRollup.sampleSize,
          windowLabel: accuracyRollup.windowLabel,
          correctPct: accuracyRollup.correctPct,
          neutralPct: accuracyRollup.neutralPct,
          negativePct: accuracyRollup.negativePct,
          avgPredictionAccuracy: accuracyRollup.avgPredictionAccuracy,
        }
      : null;

  const deepAiBrief = buildDeepAiExecutiveBrief({
    mode,
    campaignsScanned,
    potentialOpportunities,
    executiveCandidates: dailyDecision.hasDecision ? 1 : 0,
    observingCampaignName,
    thresholdPeek,
    hasDecisionAction: dailyDecision.hasDecision ? dailyDecision.action : null,
    upgradePlanLabel: input.upgradePlanLabel ?? null,
    isUnlimited: input.isUnlimitedPlan ?? false,
  });

  // Build evidence pipeline + observe context for OBSERVE mode
  let evidencePipeline: ExecutiveEvidencePipeline | null = null;
  let observeContext: ExecutiveObserveContext | null = null;

  if (mode === "OBSERVE") {
    const passedFinancialTrust = openCandidates.filter((c) => {
      const impact = computeDecisionImpactForCandidate(c);
      return Math.max(impact.businessRecovery, impact.netProfitImpact) > 0;
    }).length;

    const passedDecisionValidation = openCandidates.filter((c) => {
      const impact = computeDecisionImpactForCandidate(c);
      const confidence = impact.confidence > 0
        ? impact.confidence
        : c.confidencePct <= 1 ? Math.round(c.confidencePct * 100) : Math.round(c.confidencePct);
      return Math.max(impact.businessRecovery, impact.netProfitImpact) > 0 && confidence >= EXECUTIVE_MIN_CONFIDENCE_PCT;
    }).length;

    evidencePipeline = buildExecutiveEvidencePipeline({
      campaignsScanned,
      potentialOpportunities,
      passedFinancialTrust,
      passedDecisionValidation,
      exceededThreshold: dailyDecision.hasDecision ? 1 : 0,
    });

    const bestConfidence = thresholdPeek
      ? Math.round((thresholdPeek.readinessPct / Math.max(EXECUTIVE_ACTION_THRESHOLD_PCT, 1)) * 100)
      : 0;
    const bestImpactCandidate = openCandidates[0];
    const bestImpact = bestImpactCandidate
      ? computeDecisionImpactForCandidate(bestImpactCandidate)
      : null;

    observeContext = buildExecutiveObserveContext({
      thresholdCurrent: thresholdPeek?.readinessPct ?? 0,
      thresholdRequired: EXECUTIVE_ACTION_THRESHOLD_PCT,
      confidencePct: bestImpact
        ? (bestImpact.confidence > 0 ? bestImpact.confidence : (bestImpactCandidate!.confidencePct <= 1 ? bestImpactCandidate!.confidencePct * 100 : bestImpactCandidate!.confidencePct))
        : 0,
      minConfidencePct: EXECUTIVE_MIN_CONFIDENCE_PCT,
      netProfit: bestImpact?.netProfitImpact ?? 0,
      minNetProfit: resolveExecutiveNetProfitThreshold(),
      highestTitle: thresholdPeek?.title ?? null,
    });
  }

  const recommendationTitles = [
    ...(dailyDecision.hasDecision
      ? [{ title: dailyDecision.action, evidence: dailyDecision.evidencePoints }]
      : []),
    ...playbookForPlanning.items.map((i) => ({
      title: i.title,
      evidence: i.impactLabel ? [i.impactLabel] : [],
    })),
  ];

  const safeThreat =
    canEmitAsRecommendation(input.executiveMode.biggestThreat.label, connectedSources)
      ? input.executiveMode.biggestThreat
      : { label: dailyDecision.action || "Connected-data opportunity", amountMonthly: 0 };

  const executiveBrief = buildExecutiveBrief({
    mode,
    domains: input.aiBehavior.liveStatus.domains.map((d) => ({ label: d.label, status: d.status })),
    connectedSources: input.connectedSources,
    campaignsScanned,
    potentialOpportunities: playbookForPlanning.items.length,
    biggestThreat: safeThreat,
    bestOpportunity: canEmitAsRecommendation(
      input.executiveMode.bestOpportunity.label,
      connectedSources,
    )
      ? input.executiveMode.bestOpportunity
      : { label: "", amountMonthly: 0 },
    estimatedProfit: input.executiveMode.estimatedProfit,
    priorityAction:
      input.priorityAction &&
      canEmitAsRecommendation(input.priorityAction.title, connectedSources)
        ? input.priorityAction
        : null,
    dailyDecision,
    businessHealthLabel: focus.businessHealth.label,
    observingCampaignName,
    recommendationTitles,
  });

  return {
    mode,
    executiveBrief,
    dailyDecision,
    sinceLastVisit,
    accountabilityItems: buildExecutiveAccountabilityItems(input.aiBehavior, input.decisions),
    riskStory,
    plannedDecisions,
    plannedSection,
    notes,
    watchMessage: buildWatchMessage(input.aiBehavior, mode, dailyDecision),
    decisionModelAccuracy,
    deepAiBrief,
    evidencePipeline,
    observeContext,
  };
}

function buildWatchMessage(
  aiBehavior: ExecutiveAiBehavior,
  mode: ExecutiveMode,
  decision: ExecutiveCeoDailyDecision,
): string {
  const domains = aiBehavior.liveStatus.domains.map((d) => d.label).slice(0, 4).join(", ");
  const watching = domains || "profit, ads, inventory, and customers";
  if (mode === "NO_ACTION" || mode === "OBSERVE") {
    return `I'm monitoring ${watching} in the background. No executive call is required today.`;
  }
  if (mode === "CRITICAL") {
    return `I'm monitoring ${watching}. Critical call today: ${decision.action}.`;
  }
  return `I'm monitoring ${watching} in the background. You only need to make one call today: ${decision.action}.`;
}
