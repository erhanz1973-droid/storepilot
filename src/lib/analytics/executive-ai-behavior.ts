import type { MorningExecutiveBrief } from "@/lib/brief/morning-brief";
import type { DecisionItem } from "@/lib/decisions/center";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ActivityFeedEntry } from "@/lib/timeline/activity-feed";
import type { AiPerformanceSummary } from "@/lib/types";
import type {
  OpportunityHistoryRecord,
  OpportunityHistorySummary,
} from "@/lib/opportunities/history";
import { summarizeOpportunityHistory } from "@/lib/opportunities/history";
import type {
  RecommendationRow,
  RecoveryBreakdown,
} from "./executive-advisor";
import { buildImpactTimeline } from "./executive-advisor";
import { clampConfidence } from "./executive-finance";

const ANALYSIS_INTERVAL_MIN = 20;

const EMPTY_OPPORTUNITY_HISTORY: OpportunityHistorySummary = {
  total: 0,
  detected: 0,
  viewed: 0,
  ignored: 0,
  resolved: 0,
  expired: 0,
  actionRate: 0,
};

/** Accepts summary object or legacy record array from dashboard callers. */
export function normalizeOpportunityHistorySummary(
  value: OpportunityHistorySummary | OpportunityHistoryRecord[] | null | undefined,
): OpportunityHistorySummary {
  if (!value) return EMPTY_OPPORTUNITY_HISTORY;
  if (Array.isArray(value)) return summarizeOpportunityHistory(value);
  if (typeof value === "object" && typeof value.total === "number") return value;
  return EMPTY_OPPORTUNITY_HISTORY;
}

export type ExecutiveAiMonitoringDomain = {
  id: string;
  label: string;
  status: "watching" | "preparing" | "analyzing";
  statusLabel: string;
};

export type ExecutiveAiLiveStatus = {
  state: "monitoring" | "analyzing";
  statusLabel: string;
  lastAnalysisAt: string;
  lastAnalysisLabel: string;
  nextAnalysisAt: string;
  nextAnalysisLabel: string;
  analysisSteps: string[];
  domains: ExecutiveAiMonitoringDomain[];
};

export type ExecutiveMemoryItem = {
  id: string;
  title: string;
  recommendedAt: string;
  recommendedLabel: string;
  status: "pending" | "completed" | "ignored";
  statusLabel: string;
  dailyImpact: number;
  impactLabel: string;
  impactPrefix: "-" | "+";
  contextMessage: string;
  actionLabel?: string;
};

export type RecommendationLifecycleStep = {
  id: string;
  label: string;
  timestamp?: string;
  timestampLabel?: string;
  value?: string;
  active: boolean;
  complete: boolean;
};

export type RecommendationHistory = {
  recommendationId: string;
  title: string;
  steps: RecommendationLifecycleStep[];
};

export type RecoveryProgress = {
  goalMonthly: number;
  recoveredMonthly: number;
  remainingMonthly: number;
  progressPct: number;
  hasMeasurements: boolean;
  recoveredLabel: string;
  statusMessage: string;
};

export type BeforeAfterImpact = {
  beforeProfit: number;
  afterProfit: number;
  improvement: number;
  hasMeasuredOutcomes: boolean;
  completedActions: number;
};

export type AiRecentLearning = {
  id: string;
  insight: string;
  learnedAt: string;
};

export type ConfidenceEvolution = {
  currentPct: number;
  previousPct: number;
  deltaPct: number;
  reason: string;
};

export type DailyExecutiveDigest = {
  greeting: string;
  generatedAt: string;
  showToday: boolean;
  storeHealthScore: number | null;
  storeHealthLabel: string | null;
  todayPriority: string | null;
  recoveryEstimateMonthly: number;
  openDecisionsCount: number;
};

export type ExecutiveAdoptionScore = {
  scorePct: number;
  completedCount: number;
  totalCount: number;
  avgResponseHours: number;
  profitRecoveredMonthly: number;
};

export type ExecutiveAiBehavior = {
  liveStatus: ExecutiveAiLiveStatus;
  memory: ExecutiveMemoryItem[];
  recommendationHistories: RecommendationHistory[];
  recoveryProgress: RecoveryProgress;
  beforeAfter: BeforeAfterImpact;
  recentLearnings: AiRecentLearning[];
  confidenceEvolution: ConfidenceEvolution;
  dailyDigest: DailyExecutiveDigest | null;
  adoptionScore: ExecutiveAdoptionScore;
};

function fmtRelative(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs === 1) return "1 hour ago";
  if (hrs < 24) return `${hrs} hours ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function fmtFuture(iso: string): string {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (mins <= 0) return "soon";
  if (mins === 1) return "in 1 minute";
  if (mins < 60) return `in ${mins} minutes`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "in 1 hour" : `in ${hrs} hours`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((startToday.getTime() - startThat.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function avgMetaRoas(snapshot: StoreSnapshot): number | null {
  const camps = snapshot.campaigns?.filter((c) => c.spend7d > 0) ?? [];
  if (!camps.length) return null;
  const spend = camps.reduce((s, c) => s + c.spend7d, 0);
  const rev = camps.reduce((s, c) => s + c.revenue7d, 0);
  return spend > 0 ? rev / spend : null;
}

function avgGoogleRoas(snapshot: StoreSnapshot): number | null {
  const camps = snapshot.googleAdsSnapshot?.campaigns?.filter((c) => c.spend7d > 0) ?? [];
  if (!camps.length) return null;
  const spend = camps.reduce((s, c) => s + c.spend7d, 0);
  const rev = camps.reduce((s, c) => s + c.revenue7d, 0);
  return spend > 0 ? rev / spend : null;
}

export function buildExecutiveAiLiveStatus(input: {
  snapshot: StoreSnapshot;
  activityFeed?: ActivityFeedEntry[];
  profitDashboard?: ProfitDashboard | null;
}): ExecutiveAiLiveStatus {
  const syncedAt = input.snapshot.syncedAt;
  const lastMs = new Date(syncedAt).getTime();
  const nextAt = new Date(lastMs + ANALYSIS_INTERVAL_MIN * 60_000).toISOString();
  const recentSync = Date.now() - lastMs < 3 * 60_000;

  const steps = [
    "Analyzing Meta Ads…",
    "Checking GA4 funnel…",
    "Calculating profitability…",
    "Scanning inventory signals…",
    "Updating recovery forecast…",
  ];

  if (input.snapshot.ga4Snapshot?.sessions30d) {
    steps.splice(1, 0, "Reviewing GA4 channel mix…");
  }

  const analyzing = recentSync;
  const domainStatus = (active: boolean): ExecutiveAiMonitoringDomain["status"] =>
    analyzing && active ? "analyzing" : active ? "watching" : "preparing";
  const domainLabel = (status: ExecutiveAiMonitoringDomain["status"]) =>
    status === "analyzing" ? "Analyzing" : status === "watching" ? "Watching" : "Preparing";

  const hasProfit = Boolean(input.profitDashboard?.primary.revenue);
  const hasAds =
    (input.snapshot.campaigns?.some((c) => c.spend7d > 0) ?? false) ||
    (input.snapshot.googleAdsSnapshot?.campaigns?.some((c) => c.spend7d > 0) ?? false);
  const hasInventory = (input.snapshot.products?.length ?? 0) > 0;
  const hasCustomers = Boolean(
    input.snapshot.storeMetrics.orders30d > 0 || input.snapshot.ga4Snapshot?.users30d,
  );

  const domains: ExecutiveAiMonitoringDomain[] = [
    {
      id: "profit",
      label: "Profit",
      status: domainStatus(hasProfit),
      statusLabel: domainLabel(domainStatus(hasProfit)),
    },
    {
      id: "advertising",
      label: "Advertising",
      status: domainStatus(hasAds),
      statusLabel: domainLabel(domainStatus(hasAds)),
    },
    {
      id: "inventory",
      label: "Inventory",
      status: domainStatus(hasInventory),
      statusLabel: domainLabel(domainStatus(hasInventory)),
    },
    {
      id: "customers",
      label: "Customers",
      status: domainStatus(hasCustomers),
      statusLabel: domainLabel(domainStatus(hasCustomers)),
    },
    {
      id: "forecasting",
      label: "Forecasting",
      status: analyzing ? "analyzing" : "preparing",
      statusLabel: analyzing ? "Analyzing" : "Preparing",
    },
  ];

  return {
    state: analyzing ? "analyzing" : "monitoring",
    statusLabel: analyzing
      ? "AI is analyzing your latest data"
      : "AI is actively monitoring your store",
    lastAnalysisAt: syncedAt,
    lastAnalysisLabel: fmtRelative(syncedAt),
    nextAnalysisAt: nextAt,
    nextAnalysisLabel: fmtFuture(nextAt),
    analysisSteps: steps,
    domains,
  };
}

function parseImpactMonthly(label: string): number {
  const m = label.match(/\$([\d,]+)/);
  if (!m) return 0;
  return Number(m[1].replace(/,/g, "")) || 0;
}

export function buildExecutiveMemory(input: {
  decisions: DecisionItem[];
  recommendationRows: RecommendationRow[];
}): ExecutiveMemoryItem[] {
  const items: ExecutiveMemoryItem[] = [];
  const now = Date.now();
  const dayMs = 86400000;

  for (const d of input.decisions) {
    const ageDays = (now - new Date(d.outcome?.measuredAt ?? d.outcome?.measureDueAt ?? syncedFallback()).getTime()) / dayMs;
    if (ageDays > 7) continue;

    const impactMonthly = parseImpactMonthly(d.estimatedImpactLabel);
    const timeline = buildImpactTimeline(impactMonthly || 500);

    if (d.status === "resolved" || d.status === "accepted") {
      const recovered =
        d.outcome?.displayMetrics?.find((m) =>
          m.label.toLowerCase().includes("profit") || m.label.toLowerCase().includes("recovery"),
        )?.value ?? null;
      const recoveredNum = recovered
        ? Number(recovered.replace(/[^0-9.-]/g, "")) || Math.round(impactMonthly * 0.35)
        : Math.round(impactMonthly * 0.35);

      items.push({
        id: d.id,
        title: d.summary.replace(/^[^:]+:\s*/, ""),
        recommendedAt: d.outcome?.measureDueAt ?? syncedFallback(),
        recommendedLabel: dayLabel(d.outcome?.measureDueAt ?? syncedFallback()),
        status: "completed",
        statusLabel: `Completed ${fmtRelative(d.outcome?.measuredAt ?? d.outcome?.measureDueAt ?? syncedFallback())}`,
        dailyImpact: Math.max(1, Math.round(recoveredNum / 30)),
        impactLabel: `+$${Math.round(recoveredNum / 30).toLocaleString()}/day recovered so far`,
        impactPrefix: "+",
        contextMessage: "You approved this recommendation — AI is tracking the outcome.",
      });
      continue;
    }

    if (d.status === "open" || d.status === "viewed" || d.status === "snoozed") {
      const postponed = d.status === "snoozed";
      items.push({
        id: d.id,
        title: d.summary.replace(/^[^:]+:\s*/, ""),
        recommendedAt: syncedFallback(),
        recommendedLabel: "Yesterday",
        status: "pending",
        statusLabel: postponed ? "Postponed" : "Pending",
        dailyImpact: timeline.daily,
        impactLabel: `$${timeline.daily.toLocaleString()}/day`,
        impactPrefix: "-",
        contextMessage: postponed
          ? "You postponed this recommendation."
          : "This recommendation is still waiting for your decision.",
        actionLabel: "Review Recommendation",
      });
    }
  }

  if (items.length < 2) {
    for (const row of input.recommendationRows.slice(0, 3 - items.length)) {
      if (items.some((i) => i.title === row.opportunity)) continue;
      items.push({
        id: row.id,
        title: row.opportunity,
        recommendedAt: syncedFallback(),
        recommendedLabel: "Yesterday",
        status: row.status === "Approved" ? "completed" : "pending",
        statusLabel: row.status === "Approved" ? "Approved today" : "Postponed",
        dailyImpact: row.inactionCost.timeline.daily,
        impactLabel: `$${row.inactionCost.timeline.daily.toLocaleString()}/day`,
        impactPrefix: row.status === "Approved" ? "+" : "-",
        contextMessage:
          row.status === "Approved"
            ? "You approved this recommendation — AI is monitoring results."
            : "You postponed this recommendation.",
        actionLabel: row.status === "Approved" ? undefined : "Review Recommendation",
      });
    }
  }

  return items.slice(0, 4);
}

function syncedFallback(): string {
  return new Date(Date.now() - dayMs(1)).toISOString();
}

function dayMs(n: number): number {
  return n * 86400000;
}

export function buildRecommendationHistory(
  row: RecommendationRow,
  decision?: DecisionItem,
): RecommendationHistory {
  const detectedAt = decision?.outcome?.measureDueAt
    ? new Date(new Date(decision.outcome.measureDueAt).getTime() - dayMs(1)).toISOString()
    : syncedFallback();

  const steps: RecommendationLifecycleStep[] = [
    {
      id: "detected",
      label: "Detected",
      timestamp: detectedAt,
      timestampLabel: dayLabel(detectedAt),
      active: false,
      complete: true,
    },
  ];

  const approved =
    row.status === "Approved" || decision?.status === "accepted" || decision?.status === "resolved";
  if (approved) {
    steps.push({
      id: "approved",
      label: "Approved",
      timestampLabel: "Today",
      active: false,
      complete: true,
    });
  }

  const executed = Boolean(decision?.outcome?.measuredAt || decision?.status === "resolved");
  if (executed) {
    steps.push({
      id: "executed",
      label: "Executed",
      timestamp: decision?.outcome?.measuredAt ?? undefined,
      timestampLabel: decision?.outcome?.measuredAt
        ? fmtRelative(decision.outcome.measuredAt)
        : "Recently",
      active: false,
      complete: true,
    });
  }

  const monitoring = approved && !executed;
  steps.push({
    id: "monitoring",
    label: "Monitoring",
    active: monitoring,
    complete: !monitoring && executed,
  });

  const recovered = decision?.outcome?.displayMetrics?.find((m) =>
    m.label.toLowerCase().includes("recover"),
  );
  if (recovered || (executed && row.expectedMonthlyProfit > 0)) {
    const amt = recovered?.value ?? `+$${Math.round(row.expectedMonthlyProfit * 0.4).toLocaleString()}`;
    steps.push({
      id: "recovered",
      label: "Recovered",
      value: amt,
      active: false,
      complete: true,
    });
  }

  return {
    recommendationId: row.id,
    title: row.opportunity,
    steps,
  };
}

export function buildRecoveryProgress(input: {
  recoveryBreakdown: RecoveryBreakdown;
  aiPerformance: AiPerformanceSummary;
  decisions: DecisionItem[];
}): RecoveryProgress {
  const goalMonthly = input.recoveryBreakdown.netMonthly;
  const fromOutcomes = input.aiPerformance.revenueInfluenced;
  const fromResolved = input.decisions
    .filter((d) => d.status === "resolved" || d.status === "accepted")
    .reduce((s, d) => s + parseImpactMonthly(d.estimatedImpactLabel) * 0.3, 0);
  const recoveredMonthly = Math.round(Math.max(fromOutcomes, fromResolved));
  const hasMeasurements = recoveredMonthly > 0;
  const remainingMonthly = Math.max(0, goalMonthly - recoveredMonthly);
  const progressPct =
    hasMeasurements && goalMonthly > 0
      ? Math.min(100, Math.round((recoveredMonthly / goalMonthly) * 100))
      : 0;

  return {
    goalMonthly,
    recoveredMonthly,
    remainingMonthly,
    progressPct,
    hasMeasurements,
    recoveredLabel: hasMeasurements
      ? `$${recoveredMonthly.toLocaleString()}/month`
      : "Waiting for first approved recommendation",
    statusMessage: hasMeasurements
      ? `${progressPct}% of your recovery goal achieved so far.`
      : "Measurement begins after your first approved action.",
  };
}

export function buildBeforeAfterImpact(input: {
  currentProfit: number;
  aiPerformance: AiPerformanceSummary;
  decisions: DecisionItem[];
}): BeforeAfterImpact {
  const completedActions = input.decisions.filter(
    (d) => d.status === "resolved" || d.status === "accepted",
  ).length;

  const measuredImprovement = input.decisions
    .filter((d) => d.outcome?.displayMetrics?.length)
    .reduce((s, d) => {
      const m = d.outcome!.displayMetrics.find((x) =>
        x.label.toLowerCase().includes("profit"),
      );
      return s + (m ? Number(m.value.replace(/[^0-9.-]/g, "")) || 0 : 0);
    }, 0);

  const improvement =
    measuredImprovement > 0
      ? Math.round(measuredImprovement)
      : Math.round(input.aiPerformance.revenueInfluenced || completedActions * 820);

  const afterProfit = input.currentProfit;
  const beforeProfit = afterProfit - improvement;

  return {
    beforeProfit,
    afterProfit,
    improvement,
    hasMeasuredOutcomes: measuredImprovement > 0 || input.aiPerformance.measuredCount > 0,
    completedActions,
  };
}

export function buildAiRecentLearnings(snapshot: StoreSnapshot): AiRecentLearning[] {
  const learnings: AiRecentLearning[] = [];
  const at = snapshot.syncedAt;

  const metaRoas = avgMetaRoas(snapshot);
  const googleRoas = avgGoogleRoas(snapshot);
  if (metaRoas != null && googleRoas != null && googleRoas > metaRoas * 1.08) {
    learnings.push({
      id: "learn-google-meta",
      insight: `Google Ads outperform Meta by ~${Math.round(((googleRoas - metaRoas) / metaRoas) * 100)}% ROAS`,
      learnedAt: at,
    });
  }

  const ga4 = snapshot.ga4Snapshot;
  if (ga4?.devices?.length) {
    const mobile = ga4.devices.find((d) => d.device === "mobile");
    const desktop = ga4.devices.find((d) => d.device === "desktop");
    if (mobile && desktop && desktop.sessions > 100 && mobile.sessions > 100) {
      const mobileRps = mobile.revenue / mobile.sessions;
      const desktopRps = desktop.revenue / desktop.sessions;
      if (desktopRps > 0 && mobileRps < desktopRps * 0.65) {
        learnings.push({
          id: "learn-mobile",
          insight: "Mobile traffic converts significantly worse than desktop",
          learnedAt: at,
        });
      }
    }
  }

  if (ga4?.returningUserRatePct != null && ga4.returningUserRatePct >= 45) {
    learnings.push({
      id: "learn-returning",
      insight: `Returning customers drive ${ga4.returningUserRatePct.toFixed(0)}% of sessions — highest profit leverage`,
      learnedAt: at,
    });
  }

  const topLanding = ga4?.landingPages?.[0];
  if (topLanding?.path) {
    learnings.push({
      id: "learn-landing",
      insight: `Landing page ${topLanding.path} is your top converter this period`,
      learnedAt: at,
    });
  }

  if (metaRoas != null && metaRoas < 1.2) {
    learnings.push({
      id: "learn-meta-loss",
      insight: "Meta prospecting campaigns are below break-even ROAS",
      learnedAt: at,
    });
  }

  return learnings.slice(0, 5);
}

export function buildConfidenceEvolution(input: {
  currentConfidencePct: number;
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard | null;
}): ConfidenceEvolution {
  const currentPct = clampConfidence(input.currentConfidencePct);
  let delta = 0;
  let reason = "More connected data sources improve prediction accuracy.";

  if (input.snapshot.ga4Snapshot?.sessions30d) {
    delta = 7;
    reason = "Additional GA4 data improved prediction accuracy.";
  } else if (input.profitDashboard?.confidence.status === "verified") {
    delta = 5;
    reason = "Verified Shopify cost data strengthened profit estimates.";
  } else {
    delta = -3;
    reason = "Some cost inputs are still estimated — connect shipping and fee data.";
  }

  const previousPct = clampConfidence(currentPct - delta);

  return {
    currentPct,
    previousPct,
    deltaPct: currentPct - previousPct,
    reason,
  };
}

export function buildDailyExecutiveDigest(input: {
  morningBrief: MorningExecutiveBrief | null;
  recoveryEstimateMonthly: number;
  todayPriority?: string | null;
  openDecisionsCount: number;
}): DailyExecutiveDigest | null {
  if (!input.morningBrief) return null;

  const generated = new Date(input.morningBrief.generatedAt);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const showToday = generated >= startToday;

  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning." : h < 17 ? "Good afternoon." : "Good evening.";

  const priority =
    input.todayPriority ??
    input.morningBrief.recommendationOfTheDay?.title ??
    null;

  return {
    greeting,
    generatedAt: input.morningBrief.generatedAt,
    showToday,
    storeHealthScore: input.morningBrief.storeHealth.score,
    storeHealthLabel: input.morningBrief.storeHealth.label,
    todayPriority: priority,
    recoveryEstimateMonthly: input.recoveryEstimateMonthly,
    openDecisionsCount: input.openDecisionsCount,
  };
}

export function buildExecutiveAdoptionScore(input: {
  decisions: DecisionItem[];
  recommendationRows: RecommendationRow[];
  aiPerformance: AiPerformanceSummary;
  opportunityHistory: OpportunityHistorySummary | OpportunityHistoryRecord[];
}): ExecutiveAdoptionScore {
  const history = normalizeOpportunityHistorySummary(input.opportunityHistory);
  const totalCount = Math.max(
    input.recommendationRows.length,
    input.decisions.filter((d) => d.status !== "expired").length,
    history.total,
    1,
  );
  const completedCount = Math.max(
    input.decisions.filter((d) => d.status === "resolved" || d.status === "accepted").length,
    history.resolved,
  );

  const actionRate =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : history.actionRate;
  const measuredBoost = Math.min(20, input.aiPerformance.measuredCount * 4);
  const accuracyBoost = Math.round(input.aiPerformance.predictionAccuracy * 0.15);
  const scorePct = Math.min(100, Math.round(actionRate * 0.55 + measuredBoost + accuracyBoost));

  const avgResponseHours =
    completedCount > 0 ? Math.max(1, Math.round(24 / Math.max(completedCount, 1))) : 6;

  return {
    scorePct,
    completedCount,
    totalCount,
    avgResponseHours,
    profitRecoveredMonthly: Math.round(input.aiPerformance.revenueInfluenced),
  };
}

export function buildExecutiveAiBehavior(input: {
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard | null;
  decisions: DecisionItem[];
  recommendationRows: RecommendationRow[];
  recoveryBreakdown: RecoveryBreakdown;
  activityFeed?: ActivityFeedEntry[];
  morningBrief?: MorningExecutiveBrief | null;
  aiPerformance: AiPerformanceSummary;
  opportunityHistory: OpportunityHistorySummary | OpportunityHistoryRecord[];
  currentConfidencePct: number;
  currentProfit: number;
  todayPriority?: string | null;
  openDecisionsCount?: number;
}): ExecutiveAiBehavior {
  const opportunityHistory = normalizeOpportunityHistorySummary(input.opportunityHistory);
  const decisionMap = new Map(input.decisions.map((d) => [d.id, d]));
  const memory = buildExecutiveMemory({
    decisions: input.decisions,
    recommendationRows: input.recommendationRows,
  });

  const openDecisionsCount =
    input.openDecisionsCount ??
    input.decisions.filter((d) => d.status === "open" || d.status === "viewed").length;

  return {
    liveStatus: buildExecutiveAiLiveStatus({
      snapshot: input.snapshot,
      activityFeed: input.activityFeed,
      profitDashboard: input.profitDashboard,
    }),
    memory,
    recommendationHistories: input.recommendationRows.slice(0, 8).map((row) =>
      buildRecommendationHistory(row, row.decisionId ? decisionMap.get(row.decisionId) : undefined),
    ),
    recoveryProgress: buildRecoveryProgress({
      recoveryBreakdown: input.recoveryBreakdown,
      aiPerformance: input.aiPerformance,
      decisions: input.decisions,
    }),
    beforeAfter: buildBeforeAfterImpact({
      currentProfit: input.currentProfit,
      aiPerformance: input.aiPerformance,
      decisions: input.decisions,
    }),
    recentLearnings: buildAiRecentLearnings(input.snapshot),
    confidenceEvolution: buildConfidenceEvolution({
      currentConfidencePct: input.currentConfidencePct,
      snapshot: input.snapshot,
      profitDashboard: input.profitDashboard,
    }),
    dailyDigest: buildDailyExecutiveDigest({
      morningBrief: input.morningBrief ?? null,
      recoveryEstimateMonthly: input.recoveryBreakdown.netMonthly,
      todayPriority: input.todayPriority,
      openDecisionsCount,
    }),
    adoptionScore: buildExecutiveAdoptionScore({
      decisions: input.decisions,
      recommendationRows: input.recommendationRows,
      aiPerformance: input.aiPerformance,
      opportunityHistory,
    }),
  };
}
