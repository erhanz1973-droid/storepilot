import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";
import type { CommerceDailyBrief } from "@/lib/insights/daily-brief";
import type { StoreHealthScore } from "@/lib/store-health/score";
import type { PriorityQueueItem } from "@/lib/insights/types";
import type { AIEvent } from "@/lib/monitoring/types";

export type MorningExecutiveBrief = {
  generatedAt: string;
  readingTimeSec: number;
  storeHealth: { score: number; label: string; delta?: number };
  yesterdayPerformance: string[];
  criticalIssues: string[];
  newOpportunities: string[];
  revenueTrend: string;
  profitTrend: string;
  recommendationOfTheDay: {
    title: string;
    why: string;
    confidencePct: number;
    estimatedImpactLabel: string;
    futureAction?: string;
  } | null;
  sections: { title: string; lines: string[] }[];
};

export function buildMorningExecutiveBrief(input: {
  storeHealth: StoreHealthScore;
  dailyBrief: CommerceDailyBrief;
  priorityQueue: PriorityQueueItem[];
  opportunities: CommerceOpportunity[];
  aiEvents: AIEvent[];
  profitMarginPct?: number;
  revenueChangePct?: number | null;
}): MorningExecutiveBrief {
  const criticalEvents = input.aiEvents.filter((e) => e.severity === "critical");
  const top = input.priorityQueue[0];
  const topOpp = input.opportunities[0];

  const recommendationOfTheDay = top
    ? {
        title: top.title,
        why: top.summary,
        confidencePct: top.confidence,
        estimatedImpactLabel: top.expectedImpactLabel || "See impact estimate",
        futureAction: top.futureAction,
      }
    : topOpp
      ? {
          title: topOpp.title,
          why: topOpp.why.map((w) => `${w.label}: ${w.value}`).join(" · "),
          confidencePct: topOpp.confidence,
          estimatedImpactLabel: topOpp.expectedImpact.label,
          futureAction: topOpp.futureAction,
        }
      : null;

  const yesterdayPerformance = input.dailyBrief.bullets.filter(
    (b) => b.toLowerCase().includes("yesterday") || b.toLowerCase().includes("revenue"),
  );
  const revenueTrend =
    input.dailyBrief.bullets.find((b) => b.toLowerCase().includes("revenue")) ??
    `Revenue trend: ${input.revenueChangePct != null ? `${input.revenueChangePct > 0 ? "+" : ""}${input.revenueChangePct.toFixed(1)}% WoW` : "stable"}`;
  const profitTrend =
    input.profitMarginPct != null
      ? `Net margin ${input.profitMarginPct.toFixed(1)}% (30d)`
      : "Profit trend: connect Shopify for margin data";

  const sections = [
    {
      title: "Store Health",
      lines: [
        `Score ${input.storeHealth.score}/100 — ${input.storeHealth.label}`,
        ...input.storeHealth.changes.slice(0, 2).map((e) => e.reason),
      ],
    },
    {
      title: "Yesterday's Performance",
      lines: yesterdayPerformance.length > 0 ? yesterdayPerformance : input.dailyBrief.bullets.slice(0, 2),
    },
    {
      title: "Critical Issues",
      lines:
        criticalEvents.length > 0
          ? criticalEvents.slice(0, 3).map((e) => `${e.title} (${e.confidencePct}% confidence)`)
          : ["No critical issues detected."],
    },
    {
      title: "New Opportunities",
      lines:
        input.opportunities.length > 0
          ? input.opportunities.slice(0, 3).map((o) => `${o.title} — ${o.expectedImpact.label}`)
          : ["No new opportunities today."],
    },
    {
      title: "Revenue & Profit Trends",
      lines: [revenueTrend, profitTrend],
    },
  ];

  if (recommendationOfTheDay) {
    sections.push({
      title: "Recommendation of the Day",
      lines: [
        recommendationOfTheDay.title,
        recommendationOfTheDay.why,
        `Confidence ${recommendationOfTheDay.confidencePct}% · ${recommendationOfTheDay.estimatedImpactLabel}`,
      ],
    });
  }

  const lineCount = sections.reduce((n, s) => n + s.lines.length, 0);

  return {
    generatedAt: new Date().toISOString(),
    readingTimeSec: Math.max(30, Math.min(55, lineCount * 8)),
    storeHealth: {
      score: input.storeHealth.score,
      label: input.storeHealth.label,
      delta:
        input.storeHealth.previousScore != null
          ? input.storeHealth.score - input.storeHealth.previousScore
          : undefined,
    },
    yesterdayPerformance,
    criticalIssues: criticalEvents.map((e) => e.title),
    newOpportunities: input.opportunities.slice(0, 3).map((o) => o.title),
    revenueTrend,
    profitTrend,
    recommendationOfTheDay,
    sections,
  };
}
