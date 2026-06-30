import type { SupportingMetric } from "@/lib/types";
import { getActionCapability } from "@/lib/insights/actions";
import type {
  CopilotActionRecommendation,
  CopilotBusinessImpact,
  CopilotStructuredResponse,
} from "./types";

export function formatCopilotMessage(structured: CopilotStructuredResponse): string {
  const lines: string[] = [];
  if (structured.title) {
    lines.push(`**${structured.title}**`, "");
  }
  lines.push(structured.summary);

  if (structured.whyItHappened) {
    lines.push("", "**Why it happened**", structured.whyItHappened);
  }

  if (structured.unlockCapabilities && structured.unlockCapabilities.length > 0) {
    lines.push("", "**What will become available after syncing**");
    for (const item of structured.unlockCapabilities) {
      lines.push(`• ${item}`);
    }
  }

  lines.push("", "**Evidence**");

  for (const e of structured.evidence.slice(0, 8)) {
    const trend = e.trend === "up" ? " ↑" : e.trend === "down" ? " ↓" : "";
    lines.push(`• ${e.label}: ${e.value}${trend}`);
  }

  lines.push("", `**Confidence:** ${structured.confidencePct}%`);

  if (structured.recommendations.length > 0) {
    lines.push("", "**Recommendation**");
    for (const rec of structured.recommendations.slice(0, 3)) {
      lines.push(`• ${rec.action} — ${rec.detail}`);
      if (rec.futureAction) {
        const cap = getActionCapability(rec.futureAction);
        if (cap) {
          lines.push(
            `  _Action: ${cap.label} (${cap.available ? "available" : "coming soon"})_`,
          );
        }
      }
    }
  }

  if (structured.futureInsightExamples && structured.futureInsightExamples.length > 0) {
    lines.push("", "**After synchronization, ask:**");
    for (const example of structured.futureInsightExamples) {
      lines.push(`• ${example}`);
    }
  }

  const impact = structured.businessImpact;
  lines.push("", "**Estimated Business Impact**");
  if (impact.calculable) {
    if (impact.monthlyRevenue != null && impact.monthlyRevenue > 0) {
      lines.push(`• Est. monthly revenue: +$${impact.monthlyRevenue.toLocaleString()}`);
    }
    if (impact.monthlyProfit != null && impact.monthlyProfit > 0) {
      lines.push(`• Est. monthly profit: +$${impact.monthlyProfit.toLocaleString()}`);
    }
    if (impact.roasImprovement != null && impact.roasImprovement > 0) {
      lines.push(`• Est. ROAS improvement: +${impact.roasImprovement.toFixed(2)}`);
    }
    if (impact.label) lines.push(`• ${impact.label}`);
  } else {
    lines.push(`• ${impact.reasonIfNot ?? "Insufficient synced data to estimate impact."}`);
  }

  if (structured.riskAssessment) {
    const ra = structured.riskAssessment;
    lines.push("", "**Business Risk Assessment**");
    for (const cat of ra.categories) {
      lines.push(
        `• **${cat.label}** — Risk ${cat.score} · Confidence ${cat.confidencePct}% · ${cat.urgency} · ${cat.timeHorizon}`,
      );
      lines.push(`  ${cat.summary}`);
      if (cat.contributors.length > 0 && cat.score >= 40) {
        lines.push("  _Contributors:_");
        for (const c of cat.contributors) {
          lines.push(`  • ${c.label} (+${c.points})`);
        }
      }
    }
    if (ra.rankingExplanation) {
      lines.push("", "**Why this risk ranked first**");
      lines.push(ra.rankingExplanation);
    }
    lines.push("", `**Biggest Risk:** ${ra.primaryRisk.title}`);
    lines.push(ra.primaryRisk.reason);
    if (ra.secondaryRisk) {
      lines.push(`**Secondary Risk:** ${ra.secondaryRisk.title} — ${ra.secondaryRisk.reason}`);
    }
    if (ra.estimatedExposure.items.length > 0) {
      lines.push("", "**Estimated Exposure**");
      for (const item of ra.estimatedExposure.items) {
        lines.push(`• ${item.label}: ~$${item.amountMonthly.toLocaleString()}/month`);
      }
    }
    if (ra.primaryRisk.supportingFactors.length > 0) {
      lines.push("", "**Supporting Factors**");
      for (const f of ra.primaryRisk.supportingFactors) {
        lines.push(`• ${f}`);
      }
    }
    if (ra.recommendationSteps.length > 0) {
      lines.push("", "**Recommended Actions**");
      for (const step of ra.recommendationSteps) {
        lines.push(`• **Step ${step.step}:** ${step.action}`);
        lines.push(`  _Reason:_ ${step.reason}`);
      }
    }
  }

  return lines.join("\n");
}

export function buildBusinessImpactFromInsights(
  insights: { expectedImpact: { revenueMonthly: number; profitMonthly: number } }[],
): CopilotBusinessImpact {
  if (insights.length === 0) {
    return {
      label: "",
      calculable: false,
      reasonIfNot: "No matching insights with quantified impact — connect more data sources.",
    };
  }

  const monthlyRevenue = insights.reduce((s, i) => s + i.expectedImpact.revenueMonthly, 0);
  const monthlyProfit = insights.reduce((s, i) => s + i.expectedImpact.profitMonthly, 0);

  return {
    monthlyRevenue: monthlyRevenue > 0 ? Math.round(monthlyRevenue) : undefined,
    monthlyProfit: monthlyProfit > 0 ? Math.round(monthlyProfit) : undefined,
    label:
      monthlyProfit > 0
        ? `Combined est. +$${Math.round(monthlyProfit).toLocaleString()}/mo profit`
        : monthlyRevenue > 0
          ? `Combined est. +$${Math.round(monthlyRevenue).toLocaleString()}/mo revenue`
          : "Operational efficiency gains expected",
    calculable: monthlyRevenue > 0 || monthlyProfit > 0,
  };
}

export function recommendationsFromInsights(
  insights: {
    recommendation: string;
    title: string;
    futureAction?: import("@/lib/insights/actions").FutureActionType;
  }[],
): CopilotActionRecommendation[] {
  return insights.slice(0, 3).map((opp) => {
    const cap = opp.futureAction ? getActionCapability(opp.futureAction) : undefined;
    return {
      action: opp.title.replace(/^[^:]+:\s*/, ""),
      detail: opp.recommendation,
      futureAction: opp.futureAction,
      available: cap?.available ?? false,
    };
  });
}

export function averageConfidence(insights: { confidence: number }[], fallback = 70): number {
  if (insights.length === 0) return fallback;
  return Math.round(
    insights.reduce((s, i) => s + i.confidence, 0) / insights.length,
  );
}

export function mergeEvidence(
  primary: SupportingMetric[],
  extra: SupportingMetric[],
): SupportingMetric[] {
  const seen = new Set<string>();
  const merged: SupportingMetric[] = [];
  for (const m of [...primary, ...extra]) {
    if (seen.has(m.label)) continue;
    seen.add(m.label);
    merged.push(m);
  }
  return merged.slice(0, 8);
}
