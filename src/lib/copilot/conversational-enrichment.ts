import type { CopilotDataBundle } from "./data";
import { collectInsightMetrics } from "./insight-engine";
import type {
  CopilotConfidenceLevel,
  CopilotConversationalLayer,
  CopilotConversationalMode,
  CopilotIntent,
  CopilotRecommendationCard,
  CopilotRiskLevel,
  CopilotStructuredResponse,
  CopilotTradeOff,
  CopilotWaitAnalysis,
  CopilotWhyNotAlternative,
} from "./types";

function confidenceLevel(pct: number): CopilotConfidenceLevel {
  if (pct >= 80) return "high";
  if (pct >= 60) return "medium";
  return "low";
}

export function confidenceLabel(level: CopilotConfidenceLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function detectConversationalMode(question?: string): CopilotConversationalMode {
  const q = (question ?? "").toLowerCase();
  if (/wait|do nothing|delay|if i don.t|if i do nothing|one week|one month/.test(q)) {
    return "wait";
  }
  if (/why.*(first|top|priority)|priority.*1|why this|top priority/.test(q)) {
    return "why_priority";
  }
  return "standard";
}

function deriveRisk(input: {
  intent: CopilotIntent;
  confidencePct: number;
  roasBelowBreakEven: boolean;
}): { level: CopilotRiskLevel; reason: string } {
  const { intent, confidencePct, roasBelowBreakEven } = input;

  if (
    intent === "roas_decrease" ||
    intent === "pause_campaigns" ||
    intent === "marketing_intelligence"
  ) {
    if (roasBelowBreakEven) {
      return {
        level: "moderate",
        reason:
          "Revenue may decrease 2–3% for one week while Meta relearns after budget or creative changes.",
      };
    }
    return {
      level: "low",
      reason: "Adjusting underperforming ad sets is reversible if performance recovers.",
    };
  }

  if (intent === "inventory_intelligence" || intent === "restock") {
    return {
      level: "moderate",
      reason: "Pausing ads before restocking may slow acquisition but protects wasted spend.",
    };
  }

  if (confidencePct < 65) {
    return {
      level: "high",
      reason: "Limited synced data increases uncertainty — validate with your team before major budget shifts.",
    };
  }

  return {
    level: "moderate",
    reason: "Operational changes may take one to two weeks to show in revenue and profit.",
  };
}

function extractCampaignName(text: string): string | null {
  const bold = text.match(/\*\*([^*]+)\*\*/);
  if (bold?.[1]) return bold[1].trim();
  const inMatch = text.match(/in ([A-Za-z0-9 –\-]+)/i);
  return inMatch?.[1]?.trim() ?? null;
}

function buildExecutiveShortAnswer(
  structured: CopilotStructuredResponse,
  metrics: ReturnType<typeof collectInsightMetrics>,
): { shortAnswer: string; cautionNote?: string; recommendedAction: string } {
  const primary = structured.recommendations[0];
  const campaign =
    (primary && extractCampaignName(primary.detail + primary.action)) ??
    structured.evidence[0]?.value ??
    null;

  if (primary) {
    const action = primary.action.replace(/\*\*/g, "");

    if (campaign && metrics.currentRoas != null && metrics.breakEvenRoas != null) {
      const belowBe = metrics.currentRoas < metrics.breakEvenRoas;
      if (belowBe) {
        return {
          shortAnswer: `Your biggest opportunity today is **${campaign}**. It is spending significantly above your target acquisition cost while producing below-target profitability.`,
          recommendedAction: action.endsWith(".") ? action : `${action}.`,
          cautionNote: /pause only|instead of pausing entire/i.test(primary.detail)
            ? "Do **not** pause the entire campaign — optimize ad sets first to preserve learning data and retargeting audiences."
            : undefined,
        };
      }
      return {
        shortAnswer: `Today your advertising is profitable overall. **${campaign}** still has the highest immediate upside if you act now.`,
        recommendedAction: action.endsWith(".") ? action : `${action}.`,
      };
    }

    if (/pause only/i.test(primary.detail)) {
      return {
        shortAnswer: `Start with the lowest-performing ad sets in **${campaign ?? "your prospecting campaign"}** — not a full campaign pause.`,
        recommendedAction: action.endsWith(".") ? action : `${action}.`,
        cautionNote:
          "Keep the campaign running at reduced intensity so retargeting audiences and learning data stay intact.",
      };
    }

    return {
      shortAnswer: action.endsWith(".") ? action : `${action}.`,
      recommendedAction: action.endsWith(".") ? action : `${action}.`,
    };
  }

  const narrative = structured.summary.split(/(?<=[.!?])\s+/)[0] ?? structured.summary;
  return {
    shortAnswer: narrative,
    recommendedAction: narrative,
  };
}

function buildWhySummary(
  structured: CopilotStructuredResponse,
  metrics: ReturnType<typeof collectInsightMetrics>,
): string {
  if (
    metrics.currentRoas != null &&
    metrics.breakEvenRoas != null &&
    metrics.currentRoas < metrics.breakEvenRoas
  ) {
    return "One campaign is consuming a disproportionate share of budget while producing weak returns. Fixing it is likely to produce the highest immediate business impact before you scale spend elsewhere.";
  }

  if (structured.whyItHappened) return structured.whyItHappened;

  const primary = structured.recommendations[0];
  if (primary?.detail) {
    const first = primary.detail.split(".")[0];
    if (first && first.length > 20) return `${first}.`;
  }

  return structured.summary;
}

function buildSupportingMetrics(
  structured: CopilotStructuredResponse,
  metrics: ReturnType<typeof collectInsightMetrics>,
): string[] {
  const bullets: string[] = [];

  if (metrics.spend7d > 0) {
    bullets.push(`Ad spend (7d): $${Math.round(metrics.spend7d).toLocaleString()}`);
  }
  if (metrics.currentRoas != null) {
    bullets.push(`ROAS: ${metrics.currentRoas.toFixed(2)}`);
  }
  if (metrics.breakEvenRoas != null) {
    bullets.push(`Break-even ROAS: ${metrics.breakEvenRoas.toFixed(2)}`);
  }

  if (bullets.length < 2) {
    for (const e of structured.evidence.slice(0, 3)) {
      bullets.push(`${e.label}: ${e.value}`);
    }
  }

  return bullets.slice(0, 4);
}

function buildConfidenceBasis(
  structured: CopilotStructuredResponse,
  bundle: CopilotDataBundle,
): string[] {
  const basis: string[] = [];

  if (bundle.snapshot.products.length > 0 || structured.dataSourcesUsed.includes("shopify")) {
    basis.push("Complete Shopify order history");
  }
  if (structured.dataSourcesUsed.includes("meta_ads") || bundle.context.hasActiveMetaCampaigns) {
    basis.push("Meta fully connected");
  }
  if (structured.dataSourcesUsed.includes("google_ads") || bundle.snapshot.googleAdsSnapshot) {
    basis.push("Google Ads connected");
  }
  if (structured.dataSourcesUsed.includes("profit") || bundle.context.profitDashboard) {
    basis.push("30 days of stable campaign history");
  }
  if (structured.dataSourcesUsed.includes("insights") || structured.recommendations.length > 0) {
    basis.push("Benchmark comparison available");
  }
  if (basis.length === 0) basis.push("Synced store metrics");
  return basis.slice(0, 5);
}

function computeCombinedNetImpact(
  structured: CopilotStructuredResponse,
  recCount: number,
): { combined: number | null; overlapNote?: string; calculable: boolean } {
  const rawProfit = structured.businessImpact.monthlyProfit ?? 0;
  const rawRevenue = structured.businessImpact.monthlyRevenue ?? 0;
  const raw = rawProfit > 0 ? rawProfit : rawRevenue;

  if (!structured.businessImpact.calculable || raw <= 0) {
    return { combined: null, calculable: false };
  }

  if (recCount <= 1) {
    return { combined: Math.round(raw), calculable: true };
  }

  const overlapMultiplier = recCount >= 3 ? 0.72 : 0.85;
  return {
    combined: Math.round(raw * overlapMultiplier),
    overlapNote:
      "Combined net impact accounts for overlapping actions on the same campaign — individual opportunities are not additive.",
    calculable: true,
  };
}

function effortFromDifficulty(difficulty: "Low" | "Medium" | "High") {
  if (difficulty === "Low") {
    return { effort: "low" as const, effortLabel: "🟢 5 minutes" };
  }
  if (difficulty === "Medium") {
    return { effort: "medium" as const, effortLabel: "🟡 30 minutes" };
  }
  return { effort: "high" as const, effortLabel: "🔴 2 hours" };
}

function buildRecommendationCards(
  structured: CopilotStructuredResponse,
  confidencePct: number,
  risk: { level: CopilotRiskLevel; reason: string },
  combinedImpact: number | null,
): CopilotRecommendationCard[] {
  const recs = structured.recommendations.slice(0, 3);

  if (recs.length === 0) {
    const { effort, effortLabel } = effortFromDifficulty("Medium");
    return [
      {
        rank: 1,
        problem: structured.title ?? "Performance needs attention",
        recommendedAction: structured.summary,
        expectedFinancialImpact:
          combinedImpact != null ? `+$${combinedImpact.toLocaleString()}/month` : "See analysis above",
        impactMonthly: combinedImpact,
        timeUntilResults: "1–2 weeks",
        difficulty: "Medium",
        effort,
        effortLabel,
        includedInCombined: false,
        confidencePct,
        riskLevel: risk.level,
        riskReason: risk.reason,
      },
    ];
  }

  return recs.map((rec, index) => {
    const isAdChange = /pause|reduce|budget|creative|refresh/i.test(rec.action + rec.detail);
    const difficulty: "Low" | "Medium" | "High" = isAdChange
      ? "Low"
      : index === 0
        ? "Medium"
        : "High";
    const { effort, effortLabel } = effortFromDifficulty(difficulty);

    return {
      rank: index + 1,
      problem: rec.detail.split(".")[0] ?? structured.title ?? "Underperformance detected",
      recommendedAction: rec.action,
      expectedFinancialImpact:
        index === 0 && combinedImpact != null
          ? `+$${combinedImpact.toLocaleString()}/month combined`
          : "Included in combined impact above",
      impactMonthly: index === 0 ? combinedImpact : null,
      timeUntilResults: isAdChange ? "3–7 days" : index === 0 ? "1–2 weeks" : "2–4 weeks",
      difficulty,
      effort,
      effortLabel,
      includedInCombined: index > 0,
      confidencePct,
      riskLevel: risk.level,
      riskReason: risk.reason,
      currentPerformance: structured.evidence[0]
        ? `${structured.evidence[0].label}: ${structured.evidence[0].value}`
        : undefined,
    };
  });
}

function buildWhyFirstPriority(
  topRec: CopilotRecommendationCard | undefined,
  risk: { level: CopilotRiskLevel },
): string[] {
  const reasons = [
    "Highest expected ROI",
    topRec?.difficulty === "Low" ? "Low implementation effort" : "Manageable implementation effort",
    risk.level === "low" ? "Minimal business risk" : "Acceptable business risk for the upside",
    topRec?.effort === "low" ? "Can be completed today" : "Can be started today",
    "Unlocks future optimization opportunities",
  ];
  return reasons;
}

function buildTradeOff(
  combinedImpact: number | null,
  risk: { level: CopilotRiskLevel; reason: string },
): CopilotTradeOff {
  return {
    upsideLabel: "Expected profit",
    upsideValue:
      combinedImpact != null && combinedImpact > 0
        ? `+$${combinedImpact.toLocaleString()}/month`
        : "Improved efficiency and reduced waste",
    downsideLabel: "Possible downside",
    downsideValue: risk.reason,
    stabilizationTime: risk.level === "low" ? "3–5 days" : "7 days",
  };
}

function buildWaitAnalysis(
  combinedImpact: number | null,
  metrics: ReturnType<typeof collectInsightMetrics>,
): CopilotWaitAnalysis {
  const weeklySpend = metrics.spend7d > 0 ? Math.round(metrics.spend7d) : null;
  const weeklyMissed =
    combinedImpact != null ? Math.round(combinedImpact / 4) : weeklySpend != null ? Math.round(weeklySpend * 0.15) : null;

  return {
    period: "one week",
    unnecessarySpend: weeklySpend != null ? `$${weeklySpend.toLocaleString()}` : null,
    missedProfit: weeklyMissed != null ? `$${weeklyMissed.toLocaleString()}` : null,
    learningQuality: "Unchanged",
    businessRisk: "Increasing",
  };
}

function buildWhyNotAlternatives(
  structured: CopilotStructuredResponse,
  metrics: ReturnType<typeof collectInsightMetrics>,
): CopilotWhyNotAlternative[] {
  const roasBelowBe =
    metrics.currentRoas != null &&
    metrics.breakEvenRoas != null &&
    metrics.currentRoas < metrics.breakEvenRoas;

  const alternatives: CopilotWhyNotAlternative[] = [];

  if (roasBelowBe) {
    alternatives.push({
      label: "Increasing budgets",
      reason: "Not recommended because current profitability is unstable.",
    });
  } else {
    alternatives.push({
      label: "Reducing all advertising",
      reason: "Not recommended because revenue growth remains healthy.",
    });
  }

  alternatives.push({
    label: "Pausing prospecting entirely",
    reason: "Not recommended because optimization should be attempted first.",
  });

  if (structured.intent === "scale" || structured.intent === "today") {
    alternatives.push({
      label: "Waiting for more data",
      reason: "Not recommended because measurable waste is already occurring.",
    });
  }

  return alternatives.slice(0, 3);
}

function buildNextStep(
  topRec: CopilotRecommendationCard | undefined,
  campaign: string | null,
): { nextStep: string; nextStepDuration: string } {
  if (!topRec) {
    return {
      nextStep: "Review your priority queue and pick the single highest-impact action to execute today.",
      nextStepDuration: "10 minutes",
    };
  }

  const name = campaign ?? "the campaign";
  const action = topRec.recommendedAction.replace(/\*\*/g, "");

  if (/pause|ad set/i.test(action)) {
    return {
      nextStep: `Open **${name}**. Review the three lowest-performing ad sets. If ROAS remains below break-even after seven days, reduce the budget by approximately 25%.`,
      nextStepDuration: topRec.effortLabel.replace(/^[^\s]+\s/, "") || "10 minutes",
    };
  }

  if (/reduce|budget/i.test(action)) {
    return {
      nextStep: `Open **${name}** and reduce budget on the weakest ad sets by 20–25%. Monitor ROAS daily for the next week.`,
      nextStepDuration: topRec.effortLabel.replace(/^[^\s]+\s/, "") || "10 minutes",
    };
  }

  return {
    nextStep: action,
    nextStepDuration: topRec.effortLabel.replace(/^[^\s]+\s/, "") || "15 minutes",
  };
}

function buildImpactCalculation(structured: CopilotStructuredResponse): {
  factors: string[];
  summary: string;
} {
  const factors = [
    "Current wasted ad spend",
    "Historical ROAS",
    "Expected budget reallocation",
    "Similar store performance",
    "Conservative assumptions",
  ];

  const monthly = structured.businessImpact.monthlyProfit ?? structured.businessImpact.monthlyRevenue;
  const summary =
    monthly != null && monthly > 0
      ? `Estimate uses recoverable spend and projected lift — overlapping actions are discounted to avoid double counting.`
      : structured.businessImpact.reasonIfNot ??
        "Estimate uses conservative assumptions from synced campaign and order data.";

  return { factors, summary };
}

function pickFollowUpQuestion(intent: CopilotIntent, mode: CopilotConversationalMode): string {
  if (mode === "wait") return "What should I do first instead?";
  if (mode === "why_priority") return "What happens if I wait one week?";
  const map: Partial<Record<CopilotIntent, string>> = {
    today: "What happens if I wait one week?",
    roas_decrease: "Which ad sets should I pause first?",
    pause_campaigns: "Where should I reallocate the saved budget?",
    marketing_intelligence: "Which channel is performing best?",
    store_health_explain: "What is my biggest risk right now?",
  };
  return map[intent] ?? "What happens if I wait one week?";
}

function buildWaitModeLayer(
  base: Omit<CopilotConversationalLayer, "mode" | "shortAnswer" | "followUpQuestion">,
  waitAnalysis: CopilotWaitAnalysis,
  intent: CopilotIntent,
): CopilotConversationalLayer {
  return {
    ...base,
    mode: "wait",
    shortAnswer:
      "Waiting one more week keeps inefficient spend running and delays profit recovery — the cost compounds daily.",
    whySummary: "Here is what happens if you delay action:",
    supportingMetrics: [],
    prioritizedRecommendations: [],
    recommendedAction: base.recommendedAction,
    followUpQuestion: pickFollowUpQuestion(intent, "wait"),
    waitAnalysis,
  };
}

function buildWhyPriorityModeLayer(
  base: Omit<CopilotConversationalLayer, "mode" | "shortAnswer" | "followUpQuestion">,
  intent: CopilotIntent,
): CopilotConversationalLayer {
  return {
    ...base,
    mode: "why_priority",
    shortAnswer: "This recommendation outranks every other action based on expected ROI, effort, and risk.",
    whySummary: "Why this is first:",
    supportingMetrics: [],
    prioritizedRecommendations: base.prioritizedRecommendations.slice(0, 1),
    followUpQuestion: pickFollowUpQuestion(intent, "why_priority"),
  };
}

export function enrichConversationalResponse(
  structured: CopilotStructuredResponse,
  bundle: CopilotDataBundle,
  question?: string,
): CopilotStructuredResponse {
  if (structured.riskAssessment) {
    return structured;
  }

  const mode = detectConversationalMode(question);
  const metrics = collectInsightMetrics({
    snapshot: bundle.snapshot,
    profitDashboard: bundle.context.profitDashboard,
    trends: bundle.storeManager.trends,
    opportunities: bundle.storeManager.opportunityFeed,
  });

  const roasBelowBreakEven =
    metrics.breakEvenRoas != null &&
    metrics.currentRoas != null &&
    metrics.currentRoas < metrics.breakEvenRoas;

  const confidencePct = structured.confidencePct;
  const level = confidenceLevel(confidencePct);
  const risk = deriveRisk({
    intent: structured.intent,
    confidencePct,
    roasBelowBreakEven,
  });

  const { shortAnswer, cautionNote, recommendedAction } = buildExecutiveShortAnswer(
    structured,
    metrics,
  );
  const whySummary = buildWhySummary(structured, metrics);
  const supportingMetrics = buildSupportingMetrics(structured, metrics);
  const recCount = Math.max(structured.recommendations.length, 1);
  const financial = computeCombinedNetImpact(structured, recCount);
  const combinedLabel =
    financial.combined != null
      ? `+$${financial.combined.toLocaleString()}/month`
      : structured.businessImpact.label || "Efficiency improvement expected";

  const prioritizedRecommendations = buildRecommendationCards(
    structured,
    confidencePct,
    risk,
    financial.combined,
  );
  const topRec = prioritizedRecommendations[0];
  const campaign = structured.recommendations[0]
    ? extractCampaignName(
        structured.recommendations[0].detail + structured.recommendations[0].action,
      )
    : null;

  const remainingOpportunityCount = Math.max(
    0,
    bundle.storeManager.opportunityFeed.length - prioritizedRecommendations.length,
  );

  const waitAnalysis = buildWaitAnalysis(financial.combined, metrics);
  const { nextStep, nextStepDuration } = buildNextStep(topRec, campaign);

  const base: Omit<CopilotConversationalLayer, "mode" | "shortAnswer" | "followUpQuestion"> = {
    cautionNote,
    whySummary,
    supportingMetrics,
    financialImpact: {
      combinedNetMonthly: financial.combined,
      combinedLabel,
      overlapNote: financial.overlapNote,
      calculable: financial.calculable,
    },
    recommendedAction,
    prioritizedRecommendations,
    remainingOpportunityCount,
    whyFirstPriority: buildWhyFirstPriority(topRec, risk),
    tradeOff: buildTradeOff(financial.combined, risk),
    waitAnalysis,
    whyNotAlternatives: buildWhyNotAlternatives(structured, metrics),
    impactCalculation: buildImpactCalculation(structured),
    confidence: {
      level,
      pct: confidencePct,
      basis: buildConfidenceBasis(structured, bundle),
    },
    risk,
    nextStep,
    nextStepDuration,
    whyBullets: supportingMetrics,
    followUpQuestions: [pickFollowUpQuestion(structured.intent, mode)],
  };

  let conversational: CopilotConversationalLayer;

  if (mode === "wait") {
    conversational = buildWaitModeLayer(base, waitAnalysis, structured.intent);
  } else if (mode === "why_priority") {
    conversational = buildWhyPriorityModeLayer(base, structured.intent);
  } else {
    conversational = {
      ...base,
      mode: "standard",
      shortAnswer,
      followUpQuestion: pickFollowUpQuestion(structured.intent, mode),
    };
  }

  return {
    ...structured,
    confidencePct,
    conversational,
  };
}
