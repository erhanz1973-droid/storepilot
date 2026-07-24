import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ProfitCalculationTrace } from "./executive-finance";
import type {
  MoneyLeaksSection,
  RecommendationRow,
  RecoveryBreakdown,
  RiskAssessment,
} from "./executive-advisor";
import { applyDemoExecutiveKpis } from "@/lib/demo/showcase-overrides";

export type AiEvidenceStrength = "Limited" | "Moderate" | "Strong";

export type AiEvidence = {
  strength: AiEvidenceStrength;
  /** Plain-language explanation of how evidence strength was derived */
  explanation: string;
};

export type RecoveryScenario = {
  label: "Conservative" | "Expected" | "Best Case";
  amountMonthly: number;
  assumptions: string;
};

export type RecoveryScenarios = {
  conservative: RecoveryScenario;
  expected: RecoveryScenario;
  bestCase: RecoveryScenario;
};

export type RecommendationExplanation = {
  dataSources: string[];
  businessRulesTriggered: string[];
  aiReasoning: string;
  assumptions: string[];
  estimatedImpact: string;
  confidenceExplanation: string;
};

export type RecommendationCardMeta = {
  businessImpact: string;
  financialImpact: string;
  difficulty: "Easy" | "Moderate" | "Complex";
  timeRequired: string;
  riskLevel: RiskAssessment["label"];
  evidenceStrength: AiEvidenceStrength;
  expectedTimeToResults: string;
  explanation: RecommendationExplanation;
};

export type ExecutiveFinancialContext = {
  currentRevenue: number;
  estimatedProfit: number | null;
  profitStatus: "available" | "unavailable";
  profitUnavailableMessage: string;
  revenueAtRisk: number;
  cashLockedInInventory: number;
  monthlyRecoveryPotential: number;
  recoveryExplanation?: import("./executive-finance").RecoveryExplanation;
};

export type ExecutiveKpi = {
  id: string;
  label: string;
  value: string;
  sublabel?: string;
  tone: "neutral" | "positive" | "negative" | "warning" | "muted";
};

export type ProfitDisplay = {
  status: "available" | "unavailable";
  amount: number | null;
  unavailableMessage: string;
};

export function isProfitUnavailable(trace: ProfitCalculationTrace): boolean {
  return trace.status === "unavailable";
}

export function buildProfitDisplay(
  trace: ProfitCalculationTrace,
  amount: number,
): ProfitDisplay {
  if (isProfitUnavailable(trace)) {
    return {
      status: "unavailable",
      amount: null,
      unavailableMessage: "Connect Shopify Cost Data to calculate your true profit.",
    };
  }
  return {
    status: "available",
    amount,
    unavailableMessage: "",
  };
}

export function buildAiEvidence(
  confidencePct: number,
  confidenceReasons: string[],
): AiEvidence {
  const strength: AiEvidenceStrength =
    confidencePct >= 75 ? "Strong" : confidencePct >= 50 ? "Moderate" : "Limited";

  const reasonSummary =
    confidenceReasons.length > 0
      ? confidenceReasons.slice(0, 3).join("; ")
      : "limited connected data sources";

  const explanation =
    strength === "Strong"
      ? `Strong evidence: ${confidencePct}% model confidence backed by ${reasonSummary}. Multiple independent signals align.`
      : strength === "Moderate"
        ? `Moderate evidence: ${confidencePct}% confidence from ${reasonSummary}. Some assumptions remain because not all cost or outcome data is verified.`
        : `Limited evidence: ${confidencePct}% confidence — ${reasonSummary}. Treat impact estimates as directional until more store data is connected.`;

  return { strength, explanation };
}

export function buildRecoveryScenarios(
  breakdown: Pick<RecoveryBreakdown, "netMonthly" | "grossMonthly" | "overlapRemoved">,
): RecoveryScenarios {
  const expected = breakdown.netMonthly;
  const conservative = Math.round(expected * 0.55);
  const bestCase = Math.round(expected * 1.35);

  return {
    conservative: {
      label: "Conservative",
      amountMonthly: conservative,
      assumptions:
        "Assumes 45% execution friction, partial overlap with other initiatives, and slower customer response than modeled.",
    },
    expected: {
      label: "Expected",
      amountMonthly: expected,
      assumptions:
        "Assumes you approve top-priority recommendations, overlap is removed across channels, and historical conversion patterns hold.",
    },
    bestCase: {
      label: "Best Case",
      amountMonthly: bestCase,
      assumptions:
        "Assumes full execution within 14 days, compounding wins across inventory and ad efficiency, and no new margin headwinds.",
    },
  };
}

function inferDifficulty(title: string): RecommendationCardMeta["difficulty"] {
  const t = title.toLowerCase();
  if (t.includes("pause") || t.includes("reduce") || t.includes("budget")) return "Easy";
  if (t.includes("inventory") || t.includes("pricing") || t.includes("clearance")) return "Moderate";
  return "Moderate";
}

function inferTimeToResults(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("pause") || t.includes("reduce")) return "3–7 days";
  if (t.includes("inventory") || t.includes("clearance")) return "2–4 weeks";
  if (t.includes("pricing")) return "1–2 weeks";
  if (t.includes("google") || t.includes("meta") || t.includes("budget")) return "7–14 days";
  return "1–3 weeks";
}

function inferBusinessRules(title: string): string[] {
  const t = title.toLowerCase();
  const rules: string[] = [];
  if (t.includes("pause") || t.includes("reduce")) {
    rules.push("ROAS below break-even threshold");
    rules.push("Sustained negative campaign profit");
  }
  if (t.includes("inventory") || t.includes("clearance") || t.includes("slow")) {
    rules.push("Slow-moving SKU detection (units sold < 2 in 30 days)");
    rules.push("Cash tied up in dead inventory");
  }
  if (t.includes("pricing")) {
    rules.push("Margin compression vs category benchmark");
  }
  if (t.includes("retarget") || t.includes("prospect")) {
    rules.push("Audience fatigue / diminishing returns");
  }
  if (rules.length === 0) {
    rules.push("Opportunity score above executive priority threshold");
  }
  return rules;
}

function inferDataSources(snapshot: StoreSnapshot, title: string): string[] {
  const sources = new Set<string>(["Shopify orders (30d)", "Shopify product catalog"]);
  const t = title.toLowerCase();
  if (t.includes("meta") || t.includes("pause") || t.includes("retarget") || t.includes("prospect")) {
    sources.add("Meta Ads sync cache");
  }
  if (t.includes("google")) {
    sources.add("Google Ads sync cache");
  }
  if (snapshot.ga4Snapshot) {
    sources.add("GA4 analytics");
  }
  return [...sources];
}

export function buildRecommendationExplanation(
  row: Omit<RecommendationRow, "cardMeta">,
  snapshot: StoreSnapshot,
): RecommendationExplanation {
  const evidence = buildAiEvidence(row.confidencePct, row.confidenceReasons);
  return {
    dataSources: inferDataSources(snapshot, row.opportunity),
    businessRulesTriggered: inferBusinessRules(row.opportunity),
    aiReasoning: `${row.whyThisMatters.recommendedChange} ${row.whyThisMatters.businessImpact}`,
    assumptions: [
      "Historical performance patterns continue unless the recommended change is applied",
      row.risk.label === "High Risk"
        ? "Higher variance in outcome — monitor weekly after execution"
        : "Standard execution timeline with measurable impact within 30 days",
      snapshot.source === "demo"
        ? "Some ad metrics may be simulated where connectors are not live"
        : "Live Shopify data; ad metrics reflect connected or simulated channels as labeled",
    ],
    estimatedImpact: `+$${row.expectedMonthlyProfit.toLocaleString()}/month estimated profit recovery`,
    confidenceExplanation: evidence.explanation,
  };
}

export function buildRecommendationCardMeta(
  row: Omit<RecommendationRow, "cardMeta">,
  snapshot: StoreSnapshot,
): RecommendationCardMeta {
  const evidence = buildAiEvidence(row.confidencePct, row.confidenceReasons);
  return {
    businessImpact: row.whyThisMatters.businessImpact,
    financialImpact: `+$${row.expectedMonthlyProfit.toLocaleString()}/month`,
    difficulty: inferDifficulty(row.opportunity),
    timeRequired: row.timeRequired,
    riskLevel: row.risk.label,
    evidenceStrength: evidence.strength,
    expectedTimeToResults: inferTimeToResults(row.opportunity),
    explanation: buildRecommendationExplanation(row, snapshot),
  };
}

function cashLockedInInventory(snapshot: StoreSnapshot): number {
  const deadProducts = snapshot.products.filter(
    (p) => p.inventoryQuantity > 0 && p.unitsSold30d < 2,
  );
  return Math.round(
    deadProducts.reduce((s, p) => s + p.inventoryQuantity * (p.price * 0.45), 0),
  );
}

export function buildExecutiveFinancialContext(input: {
  profitDashboard: ProfitDashboard | null;
  profitCalculation: ProfitCalculationTrace;
  snapshot: StoreSnapshot;
  moneyLeaks: MoneyLeaksSection;
  recoveryBreakdown: RecoveryBreakdown;
}): ExecutiveFinancialContext {
  const profitUnavailable = isProfitUnavailable(input.profitCalculation);
  const revenue =
    input.profitDashboard?.primary.revenue ??
    input.snapshot.salesTrends?.last30Days.revenue ??
    0;
  const profit = profitUnavailable
    ? null
    : input.profitCalculation.isBalanced
      ? input.profitCalculation.estimatedProfit
      : input.profitCalculation.computedProfit;

  return {
    currentRevenue: Math.round(revenue),
    estimatedProfit: profit != null ? Math.round(profit) : null,
    profitStatus: profitUnavailable ? "unavailable" : "available",
    profitUnavailableMessage: "Connect Shopify Cost Data to calculate your true profit.",
    revenueAtRisk: Math.round(input.moneyLeaks.totalLostMonthly),
    cashLockedInInventory: cashLockedInInventory(input.snapshot),
    monthlyRecoveryPotential: input.recoveryBreakdown.netMonthly,
    recoveryExplanation: input.recoveryBreakdown.explanation,
  };
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function buildExecutiveKpis(input: {
  financialContext: ExecutiveFinancialContext;
  moneyLeaks: MoneyLeaksSection;
  recoveryScenarios: RecoveryScenarios;
  /** When provided and Alpine demo is active, KPIs come from Demo Provider */
  snapshot?: import("@/lib/connectors/types").StoreSnapshot | null;
}): ExecutiveKpi[] {
  const { financialContext: ctx, moneyLeaks, recoveryScenarios } = input;
  const topThreat = moneyLeaks.items[0];

  const profitValue =
    ctx.profitStatus === "unavailable"
      ? "Unavailable"
      : fmtCurrency(ctx.estimatedProfit ?? 0);

  const profitTone =
    ctx.profitStatus === "unavailable"
      ? "warning"
      : (ctx.estimatedProfit ?? 0) < 0
        ? "negative"
        : "positive";

  const kpis: ExecutiveKpi[] = [
    {
      id: "revenue",
      label: "Revenue",
      value: fmtCurrency(ctx.currentRevenue),
      sublabel: "Last 30 days",
      tone: "neutral",
    },
    {
      id: "profit",
      label: "Estimated Profit",
      value: profitValue,
      sublabel:
        ctx.profitStatus === "unavailable" ? ctx.profitUnavailableMessage : "Monthly run rate",
      tone: profitTone,
    },
    {
      id: "cash_at_risk",
      label: "Cash at Risk",
      value: fmtCurrency(ctx.revenueAtRisk),
      sublabel: "Monthly waste & leakage",
      tone: ctx.revenueAtRisk > 0 ? "negative" : "neutral",
    },
    {
      id: "inventory_risk",
      label: "Inventory Risk",
      value: fmtCurrency(ctx.cashLockedInInventory),
      sublabel: topThreat?.label?.toLowerCase().includes("inventory")
        ? topThreat.label
        : "Cash locked in slow movers",
      tone: ctx.cashLockedInInventory > 0 ? "warning" : "neutral",
    },
    {
      id: "recovery",
      label: "Recovery Opportunity",
      value: fmtCurrency(recoveryScenarios.expected.amountMonthly),
      sublabel: `Up to ${fmtCurrency(recoveryScenarios.bestCase.amountMonthly)} best case`,
      tone: "positive",
    },
  ];

  if (input.snapshot) {
    return applyDemoExecutiveKpis(input.snapshot, kpis);
  }
  return kpis;
}
