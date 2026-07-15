import type { DashboardSnapshot } from "@/lib/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import type { IntelligenceDashboard } from "@/lib/recommendations/intelligence/types";
import type { OutcomeRecord } from "@/lib/learning/outcome-types";
import type { DecisionItem } from "@/lib/decisions/center";
import { breakEvenFromProfitPeriod } from "@/lib/attribution/break-even-roas";
import type {
  FinancialImpact,
  LearningProgress,
  NextWeekPriority,
  ScorecardItem,
  TimelineEvent,
  TimelineEventType,
  TrendArrow,
  WeeklyBriefingReport,
  WinProblemItem,
} from "./types";
import { buildExecutiveOpportunities } from "@/lib/analytics/executive-experience";

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function weekBounds(): { start: string; end: string } {
  const now = new Date();
  const d = new Date(now);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  const start = d.toISOString().slice(0, 10);
  const endDate = new Date(start);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  return { start, end: endDate.toISOString().slice(0, 10) };
}

function trendItem(
  id: string,
  label: string,
  changePct: number | null,
  unavailableReason?: string,
): ScorecardItem {
  const direction: TrendArrow =
    changePct == null ? "flat" : changePct > 2 ? "up" : changePct < -2 ? "down" : "flat";
  return { id, label, changePct, direction, unavailableReason };
}

function buildScorecard(
  dashboard: DashboardSnapshot,
  profitDashboard: ProfitDashboard | null | undefined,
): ScorecardItem[] {
  const metrics = dashboard.storeManager?.trends?.metrics ?? [];
  const pick = (id: string) => metrics.find((m) => m.id === id)?.changePct ?? null;

  const revenueChange = pick("revenue_7d");
  const profitChange = pick("profit_7d");
  const marketingChange = pick("roas_7d") ?? pick("spend_7d");

  const inventoryScore = dashboard.storeHealth?.factors.find((f) => f.factor === "inventory_health");
  const invChange =
    inventoryScore != null
      ? inventoryScore.score >= 70
        ? 5
        : inventoryScore.score >= 50
          ? -4
          : -9
      : null;

  const customerChange = pick("conversion_rate_7d") ?? pick("orders_7d");

  const measuredCount = dashboard.aiPerformance?.measuredCount ?? 0;
  const aiAccuracy = dashboard.aiPerformance?.predictionAccuracy ?? 0;
  const aiChange =
    measuredCount > 0 && dashboard.weeklyReport?.accuracyTrend.length
      ? (dashboard.weeklyReport.accuracyTrend.at(-1)?.accuracy ?? 0) -
        (dashboard.weeklyReport.accuracyTrend[0]?.accuracy ?? 0)
      : null;

  const profitUnavailable =
    profitDashboard?.primaryProfit?.status === "unavailable" ||
    profitDashboard?.confidence?.setupRequired;

  return [
    trendItem(
      "revenue",
      "Revenue",
      revenueChange,
      revenueChange == null ? "Waiting for historical comparison" : undefined,
    ),
    trendItem(
      "profit",
      "Profit",
      profitChange,
      profitChange == null
        ? profitUnavailable
          ? "Cost configuration incomplete"
          : "Waiting for profit baseline"
        : undefined,
    ),
    trendItem(
      "marketing",
      "Marketing",
      marketingChange,
      marketingChange == null ? "Awaiting ad attribution sync" : undefined,
    ),
    trendItem(
      "inventory",
      "Inventory",
      invChange,
      invChange == null ? "Inventory health score pending" : undefined,
    ),
    trendItem(
      "customers",
      "Customers",
      customerChange,
      customerChange == null ? "Waiting for customer trend data" : undefined,
    ),
    trendItem(
      "ai",
      "AI Performance",
      aiChange,
      aiChange == null
        ? measuredCount === 0
          ? "Requires completed recommendations"
          : "Building accuracy baseline"
        : undefined,
    ),
  ];
}

type CampaignRow = { id: string; name: string; roas7d: number; spend7d: number };

function activeCampaigns(snapshot: StoreSnapshot): CampaignRow[] {
  return snapshot.campaigns
    .filter((c) => c.spend7d > 0 || c.roas7d > 0)
    .map((c) => ({ id: c.id, name: c.name, roas7d: c.roas7d, spend7d: c.spend7d }));
}

export function resolveCampaignWinProblem(
  campaigns: CampaignRow[],
  breakEvenRoas: number | null,
): { win: WinProblemItem | null; problem: WinProblemItem | null } {
  if (campaigns.length === 0) {
    return {
      win: { label: "Campaign performance", value: "Connect Meta Ads to track campaigns", tone: "neutral" },
      problem: { label: "Advertising", value: "No campaign data available", urgency: "medium", tone: "neutral" },
    };
  }

  const sorted = [...campaigns].sort((a, b) => b.roas7d - a.roas7d);
  const highestSpend = [...campaigns].sort((a, b) => b.spend7d - a.spend7d)[0]!;
  const worst = sorted[sorted.length - 1]!;
  const best = sorted[0]!;
  const allBelowBe =
    breakEvenRoas != null && campaigns.every((c) => c.roas7d < breakEvenRoas);

  let win: WinProblemItem | null = null;

  if (campaigns.length === 1) {
    win = {
      label: "Most active campaign",
      value: `${highestSpend.name} · ${fmt(highestSpend.spend7d * 4)}/mo spend`,
      tone: "neutral",
      isAchievement: false,
    };
  } else if (allBelowBe) {
    win = {
      label: "Campaign performance",
      value: "No winning campaigns this week — all active campaigns are below break-even ROAS.",
      tone: "neutral",
      isAchievement: false,
    };
  } else if (best.id !== worst.id && breakEvenRoas != null && best.roas7d >= breakEvenRoas) {
    win = {
      label: "Best performing campaign",
      value: `${best.name} · ROAS ${best.roas7d.toFixed(2)}`,
      tone: "positive",
      isAchievement: true,
    };
  } else if (best.id !== worst.id) {
    win = {
      label: "Highest ROAS campaign",
      value: `${best.name} · ROAS ${best.roas7d.toFixed(2)} (still below target)`,
      tone: "neutral",
      isAchievement: false,
    };
  }

  const problem: WinProblemItem = {
    label: worst.id === best.id && campaigns.length === 1 ? "Campaign efficiency" : "Worst campaign",
    value: `${worst.name} · ROAS ${worst.roas7d.toFixed(2)}`,
    tone: "negative",
    urgency:
      breakEvenRoas != null && worst.roas7d < breakEvenRoas * 0.75
        ? "critical"
        : breakEvenRoas != null && worst.roas7d < breakEvenRoas
          ? "high"
          : "medium",
  };

  if (win && win.label === "Best performing campaign" && problem.value.includes(best.name) && best.id === worst.id) {
    win = {
      label: "Most active campaign",
      value: `${highestSpend.name} · highest spend this week`,
      tone: "neutral",
    };
  }

  if (
    win &&
    problem.label === "Worst campaign" &&
    win.label === "Best performing campaign" &&
    win.value.split(" · ")[0] === problem.value.split(" · ")[0]
  ) {
    win = {
      label: "No winning campaigns this week",
      value: "Every active campaign is underperforming relative to break-even ROAS.",
      tone: "neutral",
    };
  }

  return { win, problem };
}

function buildAchievementWins(
  dashboard: DashboardSnapshot,
  snapshot: StoreSnapshot,
  products: ProductIntelligenceDashboard | null | undefined,
  weekly: DashboardSnapshot["weeklyReport"],
  campaignWin: WinProblemItem | null,
): WinProblemItem[] {
  const achievements: WinProblemItem[] = [];
  const metrics = dashboard.storeManager?.trends?.metrics ?? [];

  const revenueChange = metrics.find((m) => m.id === "revenue_7d")?.changePct;
  if (revenueChange != null && revenueChange > 2) {
    achievements.push({
      label: `Revenue increased ${revenueChange.toFixed(1)}%`,
      value: "Week-over-week revenue growth",
      tone: "positive",
      isAchievement: true,
    });
  }

  const cvr = snapshot.storeMetrics.conversionRate30d;
  if (cvr >= 2.5) {
    achievements.push({
      label: "Conversion remained above industry average",
      value: `${cvr.toFixed(2)}% store conversion rate`,
      tone: "positive",
      isAchievement: true,
    });
  }

  const inventoryScore = dashboard.storeHealth?.factors.find((f) => f.factor === "inventory_health");
  if (inventoryScore && inventoryScore.score >= 65) {
    achievements.push({
      label: "Inventory shortages decreased",
      value: `Inventory health score ${inventoryScore.score}/100`,
      tone: "positive",
      isAchievement: true,
    });
  }

  const returningPct = snapshot.ga4Snapshot?.returningUserRatePct;
  const ordersChange = dashboard.storeManager?.trends?.metrics.find((m) => m.id === "orders_7d")
    ?.changePct;
  if (returningPct != null && returningPct >= 28) {
    achievements.push({
      label: "Returning customers increased",
      value: `${returningPct.toFixed(0)}% of sessions from returning users`,
      tone: "positive",
      isAchievement: true,
    });
  } else if (ordersChange != null && ordersChange > 3) {
    achievements.push({
      label: "Customer demand strengthened",
      value: `Orders up ${ordersChange.toFixed(1)}% week over week`,
      tone: "positive",
      isAchievement: true,
    });
  }

  if (weekly.bestPerforming) {
    achievements.push({
      label: "AI recommendation delivered results",
      value: weekly.bestPerforming.title,
      tone: "positive",
      isAchievement: true,
    });
  }

  const hero = products?.heroes[0];
  if (hero && achievements.length < 5) {
    achievements.push({
      label: "Top product performer",
      value: hero.title,
      tone: "positive",
      isAchievement: true,
    });
  }

  if (achievements.length === 0 && campaignWin) {
    achievements.push(campaignWin);
  }

  if (achievements.length === 0) {
    achievements.push({
      label: "Store monitoring active",
      value: "StorePilot is tracking campaigns, inventory, and revenue signals.",
      tone: "neutral",
      isAchievement: false,
    });
  }

  return achievements.slice(0, 5);
}

function buildPrioritizedProblems(
  snapshot: StoreSnapshot,
  products: ProductIntelligenceDashboard | null | undefined,
  campaignProblem: WinProblemItem | null,
  profitDashboard: ProfitDashboard | null | undefined,
  breakEvenRoas: number | null,
): WinProblemItem[] {
  const problems: WinProblemItem[] = [];

  const worstCamp = activeCampaigns(snapshot).sort((a, b) => a.roas7d - b.roas7d)[0];
  if (worstCamp && breakEvenRoas != null && worstCamp.roas7d < breakEvenRoas) {
    problems.push({
      label: "Advertising destroying profit",
      value: `${worstCamp.name} · ROAS ${worstCamp.roas7d.toFixed(2)} vs break-even ${breakEvenRoas.toFixed(2)}`,
      tone: "negative",
      urgency: "critical",
    });
  } else if (campaignProblem) {
    problems.push({ ...campaignProblem, label: "Advertising efficiency", urgency: campaignProblem.urgency ?? "high" });
  }

  const invRisk = products?.inventoryRisk.length ?? 0;
  if (invRisk > 0) {
    problems.push({
      label: "Inventory shortage",
      value: `${invRisk} SKU(s) at stockout risk`,
      tone: "negative",
      urgency: invRisk >= 3 ? "high" : "medium",
    });
  }

  const cvrMetric = snapshot.storeMetrics.conversionRate30d;
  const trends = snapshot.salesTrends;
  if (trends && trends.lastWeek.revenue > 0) {
    const wow =
      ((trends.thisWeek.revenue - trends.lastWeek.revenue) / trends.lastWeek.revenue) * 100;
    if (wow > 5 && cvrMetric < 2) {
      problems.push({
        label: "Conversion decline",
        value: "Revenue grew but conversion rate remains weak",
        tone: "negative",
        urgency: "medium",
      });
    }
  }

  const netProfit = profitDashboard?.primary.netProfit;
  if (netProfit != null && netProfit < 0 && !problems.some((p) => p.urgency === "critical")) {
    problems.push({
      label: "Profitability",
      value: `Net profit ${fmt(netProfit)} this period`,
      tone: "negative",
      urgency: "high",
    });
  }

  const worstProduct = products?.losingMoney[0];
  if (worstProduct && problems.length < 4) {
    problems.push({
      label: "Unprofitable SKU",
      value: worstProduct.title,
      tone: "negative",
      urgency: "low",
    });
  }

  if (problems.length === 0) {
    problems.push({
      label: "No critical issues",
      value: "Continue monitoring — no urgent risks detected this week.",
      tone: "neutral",
      urgency: "low",
    });
  }

  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  return problems.sort((a, b) => rank[a.urgency ?? "low"] - rank[b.urgency ?? "low"]).slice(0, 5);
}

function buildWinsProblems(
  snapshot: StoreSnapshot,
  products: ProductIntelligenceDashboard | null | undefined,
  weekly: DashboardSnapshot["weeklyReport"],
  dashboard: DashboardSnapshot,
  profitDashboard: ProfitDashboard | null | undefined,
): { wins: WinProblemItem[]; problems: WinProblemItem[] } {
  const period = profitDashboard?.primary;
  const breakEven = period ? breakEvenFromProfitPeriod(period) : null;
  const campaigns = activeCampaigns(snapshot);
  const { win: campaignWin, problem: campaignProblem } = resolveCampaignWinProblem(
    campaigns,
    breakEven?.breakEvenRoas ?? null,
  );

  const wins = buildAchievementWins(dashboard, snapshot, products, weekly, campaignWin);
  const problems = buildPrioritizedProblems(
    snapshot,
    products,
    campaignProblem,
    profitDashboard,
    breakEven?.breakEvenRoas ?? null,
  );

  return { wins, problems };
}

function inferTimelineType(label: string, feedSeverity?: string): TimelineEventType {
  const lower = label.toLowerCase();
  if (lower.includes("approved") || lower.includes("accept")) return "approval";
  if (lower.includes("implemented") || lower.includes("executed")) return "execution";
  if (lower.includes("measured") || lower.includes("outcome") || lower.includes("accuracy")) {
    return "measurement";
  }
  if (lower.includes("recommend") || lower.includes("decision") || lower.includes("action")) {
    return "recommendation";
  }
  if (feedSeverity === "success") return "measurement";
  return "observation";
}

function buildTimeline(
  activityFeed: DashboardSnapshot["activityFeed"],
  outcomes: OutcomeRecord[],
  decisions: DecisionItem[],
): TimelineEvent[] {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const events: TimelineEvent[] = [];

  for (const o of outcomes.filter((r) => r.measureStatus === "completed").slice(0, 2)) {
    events.push({
      day: days[events.length % 7]!,
      label: o.outcomeSummary ?? `Measured: ${o.title}`,
      type: "measurement",
      tone: o.outcomeRating === "successful" ? "positive" : "action",
    });
  }

  for (const d of decisions.filter((x) => x.status === "accepted").slice(0, 2)) {
    events.push({
      day: days[events.length % 7]!,
      label: `Approved: ${d.summary}`,
      type: "approval",
      tone: "positive",
    });
  }

  const feed = activityFeed ?? [];
  for (const item of feed.slice(0, 5)) {
    if (events.length >= 7) break;
    events.push({
      day: days[events.length % 7]!,
      label: item.detail ? `${item.event} — ${item.detail}` : item.event,
      type: inferTimelineType(item.event, item.severity),
      tone: item.severity === "success" ? "positive" : "action",
    });
  }

  if (events.length === 0) {
    return [
      { day: "Monday", label: "Store synced — AI monitoring started", type: "observation", tone: "neutral" },
      { day: "Wednesday", label: "Recommendations generated from live data", type: "recommendation", tone: "action" },
      { day: "Friday", label: "Weekly report ready for review", type: "observation", tone: "positive" },
    ];
  }

  return events.slice(0, 7);
}

function buildLearning(dashboard: DashboardSnapshot, intelligence?: IntelligenceDashboard): LearningProgress {
  const completed =
    dashboard.weeklyReport?.recommendationsCompleted ??
    dashboard.aiPerformance?.measuredCount ??
    0;
  const minimumRequired = 10;
  const readinessPct = Math.min(100, Math.round((completed / minimumRequired) * 100));

  let currentStage = "Initial Baseline";
  if (completed >= minimumRequired) currentStage = "Active Learning";
  else if (completed >= 3) currentStage = "Early Calibration";

  const nextMilestone =
    completed === 0
      ? "Approve your first recommendation"
      : completed < minimumRequired
        ? `${minimumRequired - completed} more measured outcomes to reach full readiness`
        : "Maintain approval cadence for higher accuracy";

  return {
    statusLabel: completed >= minimumRequired ? "Learning active" : "AI Learning Progress",
    description:
      "The recommendation engine improves as approved actions are measured against real business outcomes.",
    completedCount: completed,
    minimumRequired,
    readinessPct,
    currentStage,
    nextMilestone,
  };
}

function buildFinancialImpact(
  dashboard: DashboardSnapshot,
  snapshot: StoreSnapshot,
  intelligence?: IntelligenceDashboard,
  outcomeRecords?: OutcomeRecord[],
): FinancialImpact {
  const opps = dashboard.topOpportunities ?? [];
  const est = opps.reduce((s, o) => s + o.estimatedMonthlyNetProfitImpact, 0);

  const completed = (outcomeRecords ?? []).filter(
    (r) => r.measureStatus === "completed" && r.actualMonthlyImpact != null,
  );
  const measuredTotal = completed.reduce(
    (s, r) => s + (r.actualMonthlyImpact ?? 0),
    0,
  );
  const successful = completed.filter((r) => r.outcomeRating === "successful");
  const successfulTotal = successful.reduce(
    (s, r) => s + Math.max(0, r.actualMonthlyImpact ?? 0),
    0,
  );
  const needsImprovement = completed.filter(
    (r) => r.outcomeRating === "needs_improvement",
  );

  // Prefer measured outcome rollups; fall back to estimates only when no measured data.
  const hasMeasured = completed.length > 0;
  const performanceFallback =
    !hasMeasured && (dashboard.aiPerformance?.revenueInfluenced ?? 0) > 0
      ? dashboard.aiPerformance!.revenueInfluenced
      : null;

  const worstCamp = activeCampaigns(snapshot).sort((a, b) => a.roas7d - b.roas7d)[0];
  const adWasteEst =
    worstCamp && worstCamp.roas7d < 1 ? Math.round(worstCamp.spend7d * 4) : Math.round(est * 0.15);

  const measuredProfit = hasMeasured
    ? Math.round(measuredTotal)
    : performanceFallback != null
      ? Math.round(performanceFallback)
      : null;

  const measuredSaved = hasMeasured
    ? Math.round(
        completed
          .filter((r) =>
            /campaign|ad|waste|cost|inventory|slow/i.test(
              `${r.category} ${r.actionType ?? ""} ${r.title}`,
            ),
          )
          .reduce((s, r) => s + Math.max(0, r.actualMonthlyImpact ?? 0), 0),
      )
    : null;

  const measuredRevenue = hasMeasured
    ? Math.round(
        completed
          .filter((r) =>
            /pricing|bundle|promotion|homepage|revenue/i.test(
              `${r.category} ${r.actionType ?? ""} ${r.title}`,
            ),
          )
          .reduce((s, r) => s + Math.max(0, r.actualMonthlyImpact ?? 0), 0),
      )
    : null;

  const measuredAdWaste = hasMeasured
    ? Math.round(
        completed
          .filter((r) => /campaign|ad/i.test(`${r.category} ${r.title}`))
          .reduce((s, r) => s + Math.max(0, r.actualMonthlyImpact ?? 0), 0),
      )
    : null;

  const measuredInventory = hasMeasured
    ? Math.round(
        completed
          .filter((r) => /inventory|slow|stock/i.test(`${r.category} ${r.title}`))
          .reduce((s, r) => s + Math.max(0, r.actualMonthlyImpact ?? 0), 0),
      )
    : null;

  const lines = [
    {
      label: "Money saved",
      estimatedMonthly: Math.round(est * 0.35 + adWasteEst * 0.5),
      measuredMonthly:
        measuredSaved != null && measuredSaved > 0
          ? measuredSaved
          : hasMeasured
            ? Math.round(successfulTotal * 0.4)
            : null,
    },
    {
      label: "Additional revenue",
      estimatedMonthly: Math.round(est * 0.45),
      measuredMonthly:
        measuredRevenue != null && measuredRevenue > 0
          ? measuredRevenue
          : hasMeasured
            ? Math.round(successfulTotal * 0.35)
            : null,
    },
    {
      label: "Profit recovered",
      estimatedMonthly: Math.round(est * 0.55),
      measuredMonthly: measuredProfit,
    },
    {
      label: "Advertising waste reduced",
      estimatedMonthly: adWasteEst,
      measuredMonthly: measuredAdWaste != null && measuredAdWaste > 0 ? measuredAdWaste : null,
    },
    {
      label: "Inventory value recovered",
      estimatedMonthly: Math.round(est * 0.2),
      measuredMonthly: measuredInventory != null && measuredInventory > 0 ? measuredInventory : null,
    },
  ];

  // Surface failed outcomes explicitly as zero measured profit contribution (not estimates).
  if (hasMeasured && needsImprovement.length > 0 && measuredProfit == null) {
    lines[2]!.measuredMonthly = 0;
  }

  void intelligence;
  return { lines };
}

function buildNextWeekPlan(decisions: DecisionItem[], snapshot: StoreSnapshot): NextWeekPriority[] {
  const opps = buildExecutiveOpportunities({
    decisions,
    opportunityFeed: [],
    priorityQueue: [],
    snapshot,
    minCount: 4,
  });

  return opps.slice(0, 3).map((o, i) => ({
    priority: i + 1,
    title: o.title,
    impactLabel: o.impactLabel,
    metricLabel: i === 0 ? "Estimated Profit" : i === 1 ? "Risk" : "Expected Impact",
    metricValue:
      i === 1 && o.title.toLowerCase().includes("inventory")
        ? "Stockout"
        : o.impactLabel.replace(/^Expected impact:\s*/i, ""),
  }));
}

function buildNarrativeParagraph(input: {
  revenueChange: number | null;
  profitChange: number | null;
  netProfit: number | null;
  roas: number | null;
  breakEvenRoas: number | null;
  worstCampaignName: string | null;
  opportunityTitle: string;
  opportunityImpact: number;
  inventoryRisk: number;
}): string {
  const parts: string[] = [];

  if (input.revenueChange != null && Math.abs(input.revenueChange) >= 3) {
    parts.push(
      input.revenueChange >= 0
        ? `This week revenue remained stable with a ${input.revenueChange.toFixed(1)}% improvement,`
        : `This week revenue declined ${Math.abs(input.revenueChange).toFixed(1)}%,`,
    );
  } else {
    parts.push("This week revenue remained relatively stable,");
  }

  if (input.roas != null && input.breakEvenRoas != null && input.roas < input.breakEvenRoas) {
    parts.push(
      `but profitability deteriorated due to inefficient advertising. ${input.worstCampaignName ? `${input.worstCampaignName} campaigns` : "Prospecting campaigns"} generated significant advertising waste`,
    );
    if (input.inventoryRisk > 0) {
      parts.push("while inventory constraints limited growth opportunities.");
    } else {
      parts.push("while other channels held steady.");
    }
  } else if (input.netProfit != null && input.netProfit < 0) {
    parts.push("but net profit turned negative after advertising and cost allocation.");
  } else {
    parts.push("with profitability broadly in line with recent trends.");
  }

  parts.push(
    `The highest-impact action is ${input.opportunityTitle.toLowerCase()}, projected to recover approximately ${fmt(input.opportunityImpact)} per month.`,
  );

  return parts.join(" ");
}

export function buildWeeklyBriefingReport(input: {
  dashboard: DashboardSnapshot;
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  productIntelligence?: ProductIntelligenceDashboard | null;
  intelligence?: IntelligenceDashboard;
  outcomeRecords?: OutcomeRecord[];
}): WeeklyBriefingReport {
  const { dashboard, snapshot, profitDashboard, productIntelligence, intelligence, outcomeRecords } =
    input;
  const { start, end } = weekBounds();
  const weekly = dashboard.weeklyReport;

  const revenue = profitDashboard?.primary.revenue ?? weekly.revenue30d ?? snapshot.storeMetrics.revenue30d;
  const netProfit =
    profitDashboard?.primaryProfit.status !== "unavailable"
      ? (profitDashboard?.primary.netProfit ?? weekly.profit30d ?? 0)
      : 0;

  const worstCamp = weekly.worstCampaigns?.[0] ?? activeCampaigns(snapshot).sort((a, b) => a.roas7d - b.roas7d)[0];
  const topOpp = weekly.biggestOpportunities?.[0] ?? dashboard.topOpportunities[0];

  const biggestProblem = worstCamp
    ? `Unprofitable campaigns — ${"name" in worstCamp ? worstCamp.name : worstCamp} underperforming`
    : netProfit < 0
      ? "Profit is negative after ad spend and costs"
      : "Marketing efficiency needs attention";

  const opportunityTitle = topOpp?.title ?? dashboard.decisionCenter?.[0]?.summary ?? "Reduce underperforming ad spend";
  const opportunityImpact =
    resolveOpportunityImpact(topOpp) ||
    parseImpactMonthly(dashboard.decisionCenter?.[0]?.estimatedImpactLabel ?? "");

  const healthLabel = dashboard.storeHealth?.label ?? "Fair";
  const statusTone =
    healthLabel === "Excellent" || healthLabel === "Healthy"
      ? "positive"
      : healthLabel === "At Risk"
        ? "critical"
        : "warning";

  const profitChange = dashboard.storeManager?.trends?.metrics.find((m) => m.id === "profit_7d")?.changePct;
  const revenueChange = dashboard.storeManager?.trends?.metrics.find((m) => m.id === "revenue_7d")?.changePct;
  const roas = weekly.roas30d ?? profitDashboard?.blendedRoas?.blendedRoas30d;
  const breakEven = profitDashboard?.primary
    ? breakEvenFromProfitPeriod(profitDashboard.primary)
    : null;

  const narrativeParagraph = buildNarrativeParagraph({
    revenueChange: revenueChange ?? null,
    profitChange: profitChange ?? null,
    netProfit: netProfit ?? null,
    roas: roas ?? null,
    breakEvenRoas: breakEven?.breakEvenRoas ?? null,
    worstCampaignName: worstCamp ? ("name" in worstCamp ? worstCamp.name : String(worstCamp)) : null,
    opportunityTitle,
    opportunityImpact: Math.round(opportunityImpact),
    inventoryRisk: productIntelligence?.inventoryRisk.length ?? 0,
  });

  const narrativeLines = [narrativeParagraph];

  const { wins, problems } = buildWinsProblems(
    snapshot,
    productIntelligence,
    weekly,
    dashboard,
    profitDashboard,
  );

  const generated = intelligence?.generated ?? dashboard.decisionCenter?.length ?? weekly.recommendationsMeasured + 5;
  const approved = intelligence
    ? Math.round((intelligence.approvedPct / 100) * Math.max(generated, 1))
    : dashboard.decisionCenter?.filter((d) => d.status === "accepted").length ?? 0;
  const completed = weekly.recommendationsCompleted;
  const minimumRequired = 10;
  const estimatedRecovery =
    dashboard.topOpportunities.reduce((s, o) => s + o.estimatedMonthlyNetProfitImpact, 0) ||
    Math.round(opportunityImpact * 1.8);
  const actualRecovery = dashboard.aiPerformance?.revenueInfluenced ?? 0;
  const accuracyAvailable =
    weekly.overallAccuracy > 0 || (dashboard.aiPerformance?.predictionAccuracy ?? 0) > 0;
  const accuracyPct = accuracyAvailable
    ? weekly.overallAccuracy > 0
      ? weekly.overallAccuracy
      : dashboard.aiPerformance!.predictionAccuracy
    : 0;

  return {
    weekStart: weekly.weekStart ?? start,
    weekEnd: weekly.weekEnd ?? end,
    generatedAt: weekly.generatedAt ?? new Date().toISOString(),
    executive: {
      revenue: Math.round(revenue),
      netProfit: Math.round(netProfit),
      biggestProblem,
      biggestOpportunity: opportunityTitle,
      opportunityImpactMonthly: Math.round(opportunityImpact),
      businessStatus: healthLabel,
      statusTone,
      narrativeLines,
      narrativeParagraph,
    },
    scorecard: buildScorecard(dashboard, profitDashboard),
    wins,
    problems,
    aiOutcomes: {
      generated,
      approved,
      completed,
      estimatedRecovery,
      actualRecovery,
      accuracyPct,
      accuracyAvailable,
      measurementStatus: "Waiting for sufficient post-implementation data.",
      completedProgressLabel: `${completed} / ${minimumRequired}`,
      accuracyEta: "Estimated accuracy available after approximately 14 days of measured outcomes.",
    },
    financialImpact: buildFinancialImpact(dashboard, snapshot, intelligence, outcomeRecords),
    timeline: buildTimeline(
      dashboard.activityFeed,
      outcomeRecords ?? [],
      dashboard.decisionCenter ?? [],
    ),
    learning: buildLearning(dashboard, intelligence),
    nextWeekPlan: buildNextWeekPlan(dashboard.decisionCenter ?? [], snapshot),
  };
}

function parseImpactMonthly(label: string): number {
  const m = label.match(/\$[\d,]+/);
  if (!m) return 0;
  return Number(m[0].replace(/[$,]/g, "")) || 0;
}

function resolveOpportunityImpact(
  topOpp: { title: string; profitImpact: number } | { title: string; estimatedMonthlyNetProfitImpact: number } | undefined,
): number {
  if (!topOpp) return 0;
  if ("profitImpact" in topOpp) return topOpp.profitImpact;
  return topOpp.estimatedMonthlyNetProfitImpact;
}
