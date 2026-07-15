import type { MetaCampaign } from "@/lib/connectors/types";
import { summarizeCampaigns } from "@/lib/meta/campaign-stats";
import type { StoreStatus } from "@/lib/store-status/types";
import {
  filterActionableRecommendations,
  INSUFFICIENT_DATA_MESSAGE,
  isActionableRecommendation,
} from "@/lib/approvals/filters";
import { EFFORT_SORT_RANK, effortForCategory } from "@/lib/approvals/effort";
import { calculateDecisionImpactFromRecommendation, mergeDecisionImpacts, buildDecisionImpactPresentation } from "@/lib/impact/decision-impact";
import type { DecisionImpact, DecisionImpactPresentation } from "@/lib/impact/decision-impact";
import type {
  ImplementationEffort,
  Recommendation,
  RecommendationCategory,
  RecommendationSeverity,
  RecommendationStatus,
} from "@/lib/types";

export type ApprovalEnrichedRecommendation = Recommendation & {
  status: RecommendationStatus;
  approval: {
    recommendationId: string;
    status: RecommendationStatus;
    note?: string;
    updatedAt: string;
    snoozedUntil?: string;
  };
};

export type CampaignBriefStats = {
  platform: string;
  scanned: number;
  active: number;
  paused: number;
  draft: number;
  needsReview: number;
  healthyOrInsufficient: number;
};

export type PresentedApprovalCard = {
  key: string;
  entityType: "campaign" | "product" | "collection" | "opportunity" | "campaign_portfolio";
  entityId?: string;
  category: RecommendationCategory;
  title: string;
  subtitle?: string;
  reason: string;
  expectedImpact: string;
  severity: RecommendationSeverity;
  confidenceScore: number;
  revenueImpact: number;
  /** Business-scale recovery (matches Executive hero) */
  businessRecovery: number;
  netProfitImpact: number;
  advertisingSavings: number | null;
  /** Canonical immutable impact — all financial UI reads from this */
  impact: DecisionImpact;
  impactPresentation: DecisionImpactPresentation;
  implementationEffort: ImplementationEffort;
  findingsCount: number;
  members: ApprovalEnrichedRecommendation[];
  isCampaignPortfolio: boolean;
  campaignBrief?: CampaignBriefStats;
  insufficientData: boolean;
};

/** @deprecated Use PresentedApprovalCard */
export type PresentedApprovalGroup = PresentedApprovalCard & { isGroup: boolean };

export type ApprovalPresentation = {
  aiSummary: string;
  aiSummaryLines: string[];
  topOpportunities: PresentedApprovalCard[];
  allOpportunities: PresentedApprovalCard[];
  totalActionable: number;
  hasActionableOpportunities: boolean;
  hiddenInsufficientCount: number;
  insufficientDataMessage: string;
  topFiveMonthlyImpact: number;
  storeStatus?: StoreStatus;
  awaitingImplementation: ApprovalEnrichedRecommendation[];
  measuring: ApprovalEnrichedRecommendation[];
  measured: ApprovalEnrichedRecommendation[];
  decided: ApprovalEnrichedRecommendation[];
};

const SEVERITY_RANK: Record<RecommendationSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

import { parseRevenueImpact } from "./revenue";

export { parseRevenueImpact };

function entityGroupKey(item: ApprovalEnrichedRecommendation): string {
  if (item.entityType && item.entityId) {
    return `${item.entityType}:${item.entityId}`;
  }
  return `rec:${item.id}`;
}

function highestSeverity(members: ApprovalEnrichedRecommendation[]): RecommendationSeverity {
  return members.reduce<RecommendationSeverity>(
    (best, m) => (SEVERITY_RANK[m.severity] < SEVERITY_RANK[best] ? m.severity : best),
    "low",
  );
}

function dedupeByEntity(
  items: ApprovalEnrichedRecommendation[],
): Map<string, ApprovalEnrichedRecommendation[]> {
  const map = new Map<string, ApprovalEnrichedRecommendation[]>();
  for (const item of items) {
    const key = entityGroupKey(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function pickPrimaryMember(
  members: ApprovalEnrichedRecommendation[],
): ApprovalEnrichedRecommendation {
  return members.reduce((best, m) => {
    const bestRev = parseRevenueImpact(best.expectedImpact);
    const rev = parseRevenueImpact(m.expectedImpact);
    if (rev !== bestRev) return rev > bestRev ? m : best;
    if (m.confidenceScore !== best.confidenceScore) {
      return m.confidenceScore > best.confidenceScore ? m : best;
    }
    return SEVERITY_RANK[m.severity] < SEVERITY_RANK[best.severity] ? m : best;
  });
}

function oneMemberPerEntity(
  items: ApprovalEnrichedRecommendation[],
): ApprovalEnrichedRecommendation[] {
  return [...dedupeByEntity(items).values()].map(pickPrimaryMember);
}

function collectCardImpact(
  members: ApprovalEnrichedRecommendation[],
  netMarginPct?: number,
): DecisionImpact {
  const parts = members.map((m) => calculateDecisionImpactFromRecommendation(m, netMarginPct));
  const merged = mergeDecisionImpacts(parts);
  if (members.length > 0) {
    const avgConfidence = Math.round(
      (members.reduce((s, m) => s + m.confidenceScore, 0) / members.length) * 100,
    );
    return { ...merged, confidence: avgConfidence };
  }
  return merged;
}

function attachImpactFields(
  card: Omit<
    PresentedApprovalCard,
    | "impact"
    | "impactPresentation"
    | "businessRecovery"
    | "netProfitImpact"
    | "advertisingSavings"
    | "revenueImpact"
  > & { expectedImpact?: string },
  impact: DecisionImpact,
): PresentedApprovalCard {
  const impactPresentation = buildDecisionImpactPresentation(impact);
  return {
    ...card,
    impact,
    impactPresentation,
    businessRecovery: impact.businessRecovery,
    netProfitImpact: impact.netProfitImpact,
    advertisingSavings: impact.advertisingSavings,
    revenueImpact: impact.revenueRecovered ?? impact.sourceAmount,
    expectedImpact:
      impact.businessRecovery > 0
        ? `${impactPresentation.heroValueFormatted}/month ${impactPresentation.heroLabel.toLowerCase()}`
        : card.expectedImpact ?? primaryExpectedImpactFallback(card),
  };
}

function primaryExpectedImpactFallback(
  card: { expectedImpact?: string },
): string {
  return card.expectedImpact ?? "—";
}

function isPresentedCardActionable(card: PresentedApprovalCard): boolean {
  if (card.netProfitImpact <= 0) return false;
  if (card.confidenceScore < 0.5) return false;
  if (card.isCampaignPortfolio && card.findingsCount === 0) return false;
  return true;
}

function buildEntityCard(
  members: ApprovalEnrichedRecommendation[],
  key: string,
  netMarginPct?: number,
): PresentedApprovalCard {
  const primary = members[0];
  const impact = collectCardImpact(members, netMarginPct);
  const confidenceScore =
    members.reduce((s, m) => s + m.confidenceScore, 0) / members.length;
  const entityType =
    (primary.entityType as PresentedApprovalCard["entityType"]) ?? "opportunity";

  const displayTitle =
    members.length === 1
      ? primary.title.replace(/^[^:]+:\s*/, "") || primary.title
      : primary.title.replace(/^[^:]+:\s*/, "") || primary.title;

  return attachImpactFields(
    {
      key,
      entityType,
      entityId: primary.entityId,
      category: primary.category,
      title: displayTitle,
      reason: members.length === 1 ? primary.reason : summarizeFindings(members),
      expectedImpact: primary.expectedImpact,
      severity: highestSeverity(members),
      confidenceScore,
      implementationEffort: effortForCategory(primary.category),
      findingsCount: members.length,
      members,
      isCampaignPortfolio: false,
      insufficientData: false,
    },
    impact,
  );
}

function summarizeFindings(members: ApprovalEnrichedRecommendation[]): string {
  if (members.length === 1) return members[0].reason;
  const names = members
    .map((m) => m.title.replace(/^[^:]+:\s*/, ""))
    .slice(0, 3)
    .join(", ");
  const suffix = members.length > 3 ? ` and ${members.length - 3} more` : "";
  return `${members.length} findings for this item: ${names}${suffix}.`;
}

function buildCampaignPortfolioCard(
  campaignMembers: ApprovalEnrichedRecommendation[],
  allCampaigns: MetaCampaign[],
  netMarginPct?: number,
): PresentedApprovalCard {
  const stats = summarizeCampaigns(allCampaigns);
  const impact = collectCardImpact(campaignMembers, netMarginPct);
  const confidenceScore =
    campaignMembers.length > 0
      ? campaignMembers.reduce((s, m) => s + m.confidenceScore, 0) / campaignMembers.length
      : 0;

  const scanned = stats.totalCount;
  const needsReview = campaignMembers.length;
  const healthyOrInsufficient = Math.max(0, scanned - needsReview);

  return attachImpactFields(
    {
      key: "campaign-portfolio",
      entityType: "campaign_portfolio",
      category: "campaign_review",
      title: "Campaign Reviews",
      subtitle: "Meta Ads",
      reason: `${scanned} campaigns scanned. ${needsReview} require immediate attention.`,
      expectedImpact: "—",
      severity: needsReview > 0 ? highestSeverity(campaignMembers) : "low",
      confidenceScore,
      implementationEffort: "High",
      findingsCount: needsReview,
      members: campaignMembers,
      isCampaignPortfolio: true,
      campaignBrief: {
        platform: "Meta Ads",
        scanned,
        active: stats.activeCount,
        paused: stats.pausedCount,
        draft: stats.draftCount,
        needsReview,
        healthyOrInsufficient,
      },
      insufficientData: false,
    },
    impact,
  );
}

function buildOpportunityCards(
  pending: ApprovalEnrichedRecommendation[],
  campaigns: MetaCampaign[],
  netMarginPct?: number,
): { actionable: PresentedApprovalCard[]; hiddenCount: number } {
  const actionableItems = filterActionableRecommendations(pending);
  const hiddenCount = pending.length - actionableItems.length;

  const campaignItems = oneMemberPerEntity(
    actionableItems.filter((i) => i.category === "campaign_review"),
  );
  const nonCampaignItems = actionableItems.filter((i) => i.category !== "campaign_review");

  const cards: PresentedApprovalCard[] = [];

  if (campaignItems.length > 0) {
    cards.push(buildCampaignPortfolioCard(campaignItems, campaigns, netMarginPct));
  }

  const byEntity = dedupeByEntity(nonCampaignItems);
  for (const [key, members] of byEntity) {
    cards.push(buildEntityCard(members, key, netMarginPct));
  }

  const actionable = sortOpportunityCards(cards).filter(isPresentedCardActionable);
  return { actionable, hiddenCount };
}

export function sortOpportunityCards(cards: PresentedApprovalCard[]): PresentedApprovalCard[] {
  return [...cards].sort((a, b) => {
    if (b.netProfitImpact !== a.netProfitImpact) {
      return b.netProfitImpact - a.netProfitImpact;
    }
    if (b.confidenceScore !== a.confidenceScore) {
      return b.confidenceScore - a.confidenceScore;
    }
    return (
      EFFORT_SORT_RANK[a.implementationEffort] - EFFORT_SORT_RANK[b.implementationEffort]
    );
  });
}

/** @deprecated */
export function sortByBusinessImpact(groups: PresentedApprovalCard[]): PresentedApprovalCard[] {
  return sortOpportunityCards(groups);
}

function buildAiSummary(
  allCards: PresentedApprovalCard[],
  pending: ApprovalEnrichedRecommendation[],
  hiddenCount: number,
  storeStatus?: StoreStatus,
): { summary: string; lines: string[] } {
  if (allCards.length === 0) {
    if (storeStatus) {
      const analyzed = storeStatus.analyzed;
      return {
        summary: storeStatus.reassuranceMessage,
        lines: [
          `I analyzed ${analyzed.products} products, ${analyzed.campaigns} campaigns, and ${analyzed.orders} recent orders.`,
          storeStatus.unavailableReasons[0]?.message ??
            "No high-confidence opportunities met our threshold right now.",
          "Your store is healthy or needs more data — I'll surface recommendations when evidence is strong enough.",
        ],
      };
    }
    if (pending.length === 0) {
      return {
        summary: "All caught up — no pending recommendations require your attention.",
        lines: ["You're clear to focus on growth opportunities from the dashboard."],
      };
    }
    return {
      summary: "No high-confidence opportunities right now.",
      lines: [
        "Pending signals did not meet our confidence threshold.",
        INSUFFICIENT_DATA_MESSAGE,
      ],
    };
  }

  if (pending.length === 0) {
    return {
      summary: "All caught up — no pending recommendations require your attention.",
      lines: ["You're clear to focus on growth opportunities from the dashboard."],
    };
  }

  const campaignCard = allCards.find((c) => c.isCampaignPortfolio);
  const lines: string[] = [];

  if (campaignCard?.campaignBrief) {
    const b = campaignCard.campaignBrief;
    lines.push(`StorePilot scanned ${b.scanned} campaigns across connected ad accounts.`);
    if (b.needsReview === 0) {
      lines.push("No campaigns require immediate action right now.");
    } else {
      lines.push(
        `${b.needsReview} campaign${b.needsReview === 1 ? "" : "s"} need executive review based on ROAS and spend signals.`,
      );
    }
    if (b.healthyOrInsufficient > 0) {
      lines.push(
        `The remaining ${b.healthyOrInsufficient} campaigns are healthy or lack sufficient conversion data.`,
      );
    }
  }

  const nonCampaignCount = pending.filter((p) => p.category !== "campaign_review").length;
  const actionableNonCampaign = filterActionableRecommendations(
    pending.filter((p) => p.category !== "campaign_review"),
  ).length;

  if (nonCampaignCount > 0 && actionableNonCampaign > 0) {
    lines.push(
      `${actionableNonCampaign} inventory and merchandising opportunit${actionableNonCampaign === 1 ? "y" : "ies"} ranked by expected net profit impact.`,
    );
  }

  const totalImpact = allCards.reduce((s, c) => s + c.netProfitImpact, 0);
  if (allCards.length > 0 && totalImpact > 0) {
    lines.push(
      `Combined estimated monthly profit improvement: $${totalImpact.toLocaleString()}.`,
    );
  }

  return {
    summary: lines[0] ?? "Here are your highest-impact opportunities.",
    lines,
  };
}

export type BuildApprovalOptions = {
  campaigns?: MetaCampaign[];
  storeStatus?: StoreStatus;
  netMarginPct?: number;
  now?: number;
};

export function buildApprovalPresentation(
  items: ApprovalEnrichedRecommendation[],
  options: BuildApprovalOptions = {},
): ApprovalPresentation {
  const now = options.now ?? Date.now();
  const campaigns = options.campaigns ?? [];
  const storeStatus = options.storeStatus;

  const snoozeExpired = (snoozedUntil?: string) =>
    snoozedUntil ? new Date(snoozedUntil).getTime() <= now : true;

  const pending = items.filter(
    (i) =>
      i.approval.status === "pending" ||
      (i.approval.status === "snoozed" && snoozeExpired(i.approval.snoozedUntil)),
  );

  const decided = items.filter(
    (i) =>
      i.approval.status === "ignored" ||
      i.approval.status === "completed" ||
      (i.approval.status === "snoozed" && !snoozeExpired(i.approval.snoozedUntil)),
  );

  const awaitingImplementation = items.filter((i) => i.approval.status === "approved");
  const measuring = items.filter((i) => i.approval.status === "implemented");
  const measured = items.filter((i) => i.approval.status === "measured");

  const { actionable: allOpportunities, hiddenCount } = buildOpportunityCards(
    pending,
    campaigns,
    options.netMarginPct,
  );

  const topOpportunities = allOpportunities.slice(0, 5);
  const topFiveMonthlyImpact = topOpportunities.reduce((s, c) => s + c.netProfitImpact, 0);
  const hasActionableOpportunities = allOpportunities.length > 0;

  const { summary, lines } = buildAiSummary(
    allOpportunities,
    pending,
    hiddenCount,
    storeStatus,
  );

  return {
    aiSummary: summary,
    aiSummaryLines: lines,
    topOpportunities,
    allOpportunities,
    totalActionable: allOpportunities.length,
    hasActionableOpportunities,
    hiddenInsufficientCount: hasActionableOpportunities ? hiddenCount : 0,
    insufficientDataMessage: INSUFFICIENT_DATA_MESSAGE,
    topFiveMonthlyImpact,
    storeStatus,
    awaitingImplementation,
    measuring,
    measured,
    decided,
  };
}

/** Group pending items that failed actionable filter for debug/display */
export function listInsufficientRecommendations(
  items: ApprovalEnrichedRecommendation[],
): ApprovalEnrichedRecommendation[] {
  return items.filter((i) => !isActionableRecommendation(i));
}
