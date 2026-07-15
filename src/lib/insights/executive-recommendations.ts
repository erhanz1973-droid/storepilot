import type { DecisionItem, DecisionStatus } from "@/lib/decisions/center";
import { calculateDecisionImpact } from "@/lib/impact/decision-impact";

export type RecommendationLifecycle =
  | "new"
  | "approved"
  | "applied"
  | "monitoring"
  | "successful"
  | "dismissed";

export type ExecutiveRecommendation = {
  id: string;
  entityName: string;
  problem: string;
  cause: string;
  impactMonthly: number;
  impactLabel: string;
  action: string;
  expectedOutcomes: string[];
  priorityScore: number;
  confidencePct: number;
  priority: DecisionItem["priority"];
  lifecycle: RecommendationLifecycle;
  lifecycleLabel: string;
  reasoning: string[];
  mergedCount: number;
  decisionId: string;
  status: DecisionStatus;
};

export type ExecutiveInsightsSummary = {
  opportunityCount: number;
  estimatedMonthlyRecovery: number;
  highestPriorityTitle: string;
  highestPriorityAction: string;
};

export type ExecutiveInsightsView = {
  summary: ExecutiveInsightsSummary;
  topRecommendations: ExecutiveRecommendation[];
  moreRecommendations: ExecutiveRecommendation[];
  byPriority: {
    critical: ExecutiveRecommendation[];
    high: ExecutiveRecommendation[];
    medium: ExecutiveRecommendation[];
  };
  completed: ExecutiveRecommendation[];
};

const LIFECYCLE_LABELS: Record<RecommendationLifecycle, string> = {
  new: "New",
  approved: "Approved",
  applied: "Applied",
  monitoring: "Monitoring",
  successful: "Successful",
  dismissed: "Dismissed",
};

const TITLE_REWRITES: [RegExp, string][] = [
  [/campaign needs review/i, "This campaign is losing money"],
  [/roas below target/i, "Your advertising spend is not profitable"],
  [/high spend,\s*low purchases/i, "This campaign is spending heavily without enough sales"],
  [/pause campaign/i, "Stop wasting budget on this campaign"],
  [/underperforming campaign/i, "This campaign is underperforming"],
  [/low roas/i, "Advertising is not returning enough revenue"],
  [/dead inventory/i, "Slow-moving products are tying up cash"],
  [/low margin/i, "This product's margin is too thin"],
];

const URGENCY_SCORE: Record<DecisionItem["priority"], number> = {
  critical: 28,
  high: 20,
  medium: 12,
  low: 6,
};

export function parseImpactMonthly(
  label: string,
  opts?: { category?: string; confidencePct?: number },
): number {
  return calculateDecisionImpact({
    expectedImpactLabel: label,
    category: opts?.category,
    confidenceScore: opts?.confidencePct,
  }).businessRecovery;
}

export function humanizeRecommendationTitle(title: string): string {
  let result = title.trim();
  for (const [pattern, replacement] of TITLE_REWRITES) {
    if (pattern.test(result)) {
      return replacement;
    }
  }
  return result;
}

function mapLifecycle(item: DecisionItem): RecommendationLifecycle {
  if (item.status === "ignored" || item.status === "expired") return "dismissed";
  if (item.status === "snoozed") return "dismissed";
  if (item.status === "accepted") return "approved";
  if (item.status === "resolved") {
    if (item.outcome?.measureStatus === "completed") return "successful";
    if (item.outcome?.measureStatus === "scheduled") return "monitoring";
    return "successful";
  }
  if (item.status === "viewed") return "new";
  return "new";
}

function financialImpactScore(monthly: number): number {
  if (monthly <= 0) return 8;
  if (monthly >= 10_000) return 40;
  if (monthly >= 5_000) return 34;
  if (monthly >= 2_000) return 28;
  if (monthly >= 500) return 20;
  return Math.round(12 + Math.log10(monthly + 1) * 6);
}

/** 0–100 score for merchant-facing priority ranking */
export function computeExecutivePriorityScore(item: DecisionItem, impactMonthly: number): number {
  const financial = financialImpactScore(impactMonthly);
  const confidence = Math.round(item.confidencePct * 0.32);
  const urgency = URGENCY_SCORE[item.priority];
  const effort = item.actionAvailable ? 8 : 4;
  const mergeBoost = item.mergedFrom?.length ? Math.min(8, item.mergedFrom.length * 2) : 0;
  return Math.min(100, Math.round(financial + confidence + urgency + effort + mergeBoost));
}

function buildProblemStatement(item: DecisionItem): string {
  const title = humanizeRecommendationTitle(item.entityName || item.summary);
  if (title.endsWith(".") || title.length > 80) return title;
  if (item.entityName && item.summary !== item.entityName) {
    return `${title}: ${humanizeRecommendationText(item.summary)}`;
  }
  return humanizeRecommendationText(item.summary);
}

export function humanizeRecommendationText(text: string): string {
  let result = text;
  for (const [pattern, replacement] of TITLE_REWRITES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function buildCause(item: DecisionItem): string {
  const why = humanizeRecommendationText(item.why);
  if (why.length > 0) return why.split("\n")[0] ?? why;
  return "StorePilot detected a pattern in your connected sales and advertising data.";
}

function buildExpectedOutcomes(item: DecisionItem, impactMonthly: number): string[] {
  const outcomes: string[] = [];
  if (impactMonthly > 0) {
    outcomes.push(`Profit +$${impactMonthly.toLocaleString()}/month`);
  }
  for (const metric of item.supportingMetrics.slice(0, 3)) {
    const line = `${metric.label}: ${metric.value}`;
    if (!outcomes.some((o) => o.includes(metric.label))) {
      outcomes.push(line);
    }
  }
  if (item.mergedFrom?.length) {
    outcomes.push(`Consolidates ${item.mergedFrom.length + 1} related signals into one action`);
  }
  return outcomes.slice(0, 4);
}

function buildReasoning(item: DecisionItem): string[] {
  const lines: string[] = [];
  for (const metric of item.supportingMetrics) {
    lines.push(`${metric.label}: ${metric.value}`);
  }
  const whyParts = item.why
    .split(/[·\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of whyParts) {
    if (!lines.some((l) => l.toLowerCase() === part.toLowerCase())) {
      lines.push(humanizeRecommendationText(part));
    }
  }
  if (item.mergedFrom?.length) {
    lines.push(
      `Historical data shows similar issues improved after taking action on related campaigns or products.`,
    );
  }
  if (lines.length === 0) {
    lines.push("This recommendation is based on verified store and advertising data.");
  }
  return lines.slice(0, 6);
}

function toExecutiveRecommendation(item: DecisionItem): ExecutiveRecommendation {
  const impactMonthly = parseImpactMonthly(item.estimatedImpactLabel, {
    category: item.entityType === "campaign" ? "campaign_review" : undefined,
    confidencePct: item.confidencePct,
  });
  const lifecycle = mapLifecycle(item);

  return {
    id: item.id,
    entityName: item.entityName ?? item.summary,
    problem: buildProblemStatement(item),
    cause: buildCause(item),
    impactMonthly,
    impactLabel: item.estimatedImpactLabel,
    action: item.recommendedAction,
    expectedOutcomes: buildExpectedOutcomes(item, impactMonthly),
    priorityScore: computeExecutivePriorityScore(item, impactMonthly),
    confidencePct: item.confidenceBreakdown?.overallPct ?? item.confidencePct,
    priority: item.priority,
    lifecycle,
    lifecycleLabel: LIFECYCLE_LABELS[lifecycle],
    reasoning: buildReasoning(item),
    mergedCount: (item.mergedFrom?.length ?? 0) + 1,
    decisionId: item.id,
    status: item.status,
  };
}

function isActive(item: DecisionItem): boolean {
  return item.status === "open" || item.status === "viewed";
}

function isCompleted(item: DecisionItem): boolean {
  return !isActive(item);
}

export function buildExecutiveInsightsView(
  decisions: DecisionItem[],
  options?: { topLimit?: number },
): ExecutiveInsightsView {
  const topLimit = options?.topLimit ?? 5;
  const active = decisions.filter(isActive);
  const ranked = [...active].sort(
    (a, b) =>
      computeExecutivePriorityScore(b, parseImpactMonthly(b.estimatedImpactLabel)) -
        computeExecutivePriorityScore(a, parseImpactMonthly(a.estimatedImpactLabel)) ||
      b.priorityScore - a.priorityScore,
  );

  const executive = ranked.map(toExecutiveRecommendation);
  const topRecommendations = executive.slice(0, topLimit);
  const moreRecommendations = executive.slice(topLimit);

  const estimatedMonthlyRecovery = executive.reduce((sum, r) => sum + r.impactMonthly, 0);
  const top = topRecommendations[0];

  return {
    summary: {
      opportunityCount: executive.length,
      estimatedMonthlyRecovery,
      highestPriorityTitle: top?.entityName ?? "No urgent actions",
      highestPriorityAction: top?.action ?? "Your store looks healthy",
    },
    topRecommendations,
    moreRecommendations,
    byPriority: {
      critical: executive.filter((r) => r.priority === "critical"),
      high: executive.filter((r) => r.priority === "high"),
      medium: executive.filter((r) => r.priority === "medium" || r.priority === "low"),
    },
    completed: decisions.filter(isCompleted).map(toExecutiveRecommendation).slice(0, 8),
  };
}

export { LIFECYCLE_LABELS };
