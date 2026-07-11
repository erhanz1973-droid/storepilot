import type { DecisionItem } from "@/lib/decisions/center";
import type { DailyAiPlaybook, ExecutiveFocusSummary } from "@/lib/analytics/ai-daily-playbook";
import type { ExecutiveAiBehavior } from "@/lib/analytics/executive-ai-behavior";
import type { AiEvidence, PriorityAction } from "@/lib/analytics/executive-advisor";
import type { ExecutiveVisitSnapshot } from "@/lib/analytics/executive-visit";

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
  title: string;
  action: string;
  narrative: string;
  ceoOpinion: string;
  expectedMonthlyImpact: number;
  estimatedMinutes: number;
  risk: string;
  evidence: AiEvidence | null;
  evidencePoints: string[];
  approvalHref: string;
  moduleHref?: string;
  decisionId?: string;
};

export type ExecutiveAccountabilityItem = {
  id: string;
  type: "rejected" | "approved" | "pending" | "measuring";
  title: string;
  narrative: string;
  metrics: { label: string; value: string }[];
};

export type ExecutiveRiskStory = {
  headline: string;
  story: string;
};

export type ExecutivePlannedDecision = {
  rank: number;
  title: string;
  plannedLabel: string;
  impactLabel: string;
};

export type ExecutiveCeoOsLayer = {
  dailyDecision: ExecutiveCeoDailyDecision;
  sinceLastVisit: ExecutiveSinceLastVisit;
  accountabilityItems: ExecutiveAccountabilityItem[];
  riskStory: ExecutiveRiskStory;
  plannedDecisions: ExecutivePlannedDecision[];
  watchMessage: string;
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

export function buildExecutiveRiskStory(
  focus: ExecutiveFocusSummary,
  threatLabel: string,
  threatAmount: number,
  opportunityLabel: string,
  opportunityAmount: number,
): ExecutiveRiskStory {
  const risks = focus.topRisks.map((r) => r.label);
  const parts: string[] = [];

  if (threatLabel && threatAmount > 0) {
    parts.push(
      `Your business is leaking approximately ${fmt(threatAmount)} per month through ${threatLabel.toLowerCase()}.`,
    );
  }

  if (risks.length >= 2) {
    parts.push(
      `This connects to a wider pattern: ${risks[0]?.toLowerCase()} is feeding into ${risks[1]?.toLowerCase()}, which means fixing one area without the other will only buy time.`,
    );
  } else if (risks[0]) {
    parts.push(`${risks[0]} is the dominant drag on performance right now.`);
  }

  if (opportunityLabel && opportunityAmount > 0) {
    parts.push(
      `The counter-move is ${opportunityLabel.toLowerCase()} — worth up to ${fmt(opportunityAmount)}/month if you act while conditions are still recoverable.`,
    );
  } else {
    parts.push("The window to act without deeper structural damage is still open — but it narrows every week spend runs unchecked.");
  }

  return {
    headline: "The business story behind today's decision",
    story: parts.join(" "),
  };
}

export function buildExecutivePlannedDecisions(playbook: DailyAiPlaybook): ExecutivePlannedDecision[] {
  return playbook.items.slice(1, 4).map((item, i) => ({
    rank: item.rank,
    title: item.title,
    plannedLabel: i === 0 ? "Tomorrow" : i === 1 ? "This week" : "Next week",
    impactLabel: item.impactLabel,
  }));
}

export function buildExecutiveCeoOsLayer(input: {
  priorityAction: PriorityAction | null;
  executiveFocus: ExecutiveFocusSummary;
  dailyPlaybook: DailyAiPlaybook;
  aiBehavior: ExecutiveAiBehavior;
  decisions: DecisionItem[];
  executiveMode: { biggestThreat: { label: string; amountMonthly: number }; bestOpportunity: { label: string; amountMonthly: number }; estimatedProfit: number };
  previousVisit: ExecutiveVisitSnapshot | null;
}): ExecutiveCeoOsLayer {
  const action = input.priorityAction;
  const focus = input.executiveFocus;
  const title = action?.title ?? focus.todayDecision?.title ?? "Review top business priority";
  const impact = action?.impactMonthly ?? focus.recoveryPotentialMonthly ?? 0;
  const openDecisions = input.decisions.filter((d) => d.status === "open" || d.status === "viewed").length;

  const dailyDecision: ExecutiveCeoDailyDecision = {
    title: "Today's #1 executive decision",
    action: title,
    narrative: action?.whyThisMatters
      ? `${action.whyThisMatters.currentSituation} ${action.whyThisMatters.businessImpact}`
      : `This is the highest-leverage move across marketing, profit, inventory, and sales. Everything else on today's list can wait.`,
    ceoOpinion: buildCeoOpinion(action, focus, input.executiveMode.biggestThreat.label),
    expectedMonthlyImpact: impact,
    estimatedMinutes: parseMinutes(action?.timeRequired),
    risk: action?.risk.label ?? "Low Risk",
    evidence: action?.evidence ?? null,
    evidencePoints: action?.confidenceReasons ?? [],
    approvalHref: focus.todayDecision?.approvalHref ?? "/approvals",
    moduleHref: focus.todayDecision?.moduleHref,
    decisionId: action?.decisionId,
  };

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

  return {
    dailyDecision,
    sinceLastVisit,
    accountabilityItems: buildExecutiveAccountabilityItems(input.aiBehavior, input.decisions),
    riskStory: buildExecutiveRiskStory(
      focus,
      input.executiveMode.biggestThreat.label,
      input.executiveMode.biggestThreat.amountMonthly,
      input.executiveMode.bestOpportunity.label,
      input.executiveMode.bestOpportunity.amountMonthly,
    ),
    plannedDecisions: buildExecutivePlannedDecisions(input.dailyPlaybook),
    watchMessage: buildWatchMessage(input.aiBehavior, title),
  };
}

function buildWatchMessage(aiBehavior: ExecutiveAiBehavior, decisionTitle: string): string {
  const domains = aiBehavior.liveStatus.domains.map((d) => d.label).slice(0, 4).join(", ");
  return `I'm monitoring ${domains || "profit, ads, inventory, and customers"} in the background. You only need to make one call today: ${decisionTitle}.`;
}
