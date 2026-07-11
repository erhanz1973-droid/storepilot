import type { BusinessRiskAssessment, BusinessRiskCategory } from "@/lib/insights/business-risk-assessment";
import type { Opportunity } from "@/lib/types";
import type { Recommendation } from "@/lib/types";

export type FinancialImpactType =
  | "revenue_increase"
  | "profit_recovery"
  | "cost_reduction"
  | "cash_flow_improvement"
  | "risk_prevention";

export const FINANCIAL_IMPACT_LABELS: Record<FinancialImpactType, string> = {
  revenue_increase: "Estimated Revenue Increase",
  profit_recovery: "Estimated Profit Recovery",
  cost_reduction: "Estimated Cost Reduction",
  cash_flow_improvement: "Estimated Cash Flow Improvement",
  risk_prevention: "Estimated Risk Prevention",
};

const DOMAIN_TO_RISK: Record<string, BusinessRiskCategory> = {
  profit: "profitability",
  marketing: "marketing",
  inventory: "inventory",
  customers: "customer_retention",
  "cash-flow": "cash_flow",
};

const DOMAIN_ACTIONS: Record<string, string[]> = {
  profit: [
    "Improve gross margin by reducing unprofitable ad spend.",
    "Shift merchandising toward highest-margin products.",
    "Review discount depth on low-margin SKUs.",
  ],
  marketing: [
    "Pause low-performing Prospecting campaigns.",
    "Reallocate budget to retargeting and proven channels.",
    "Refresh creatives on fatigued ad sets.",
  ],
  inventory: [
    "Replenish top-selling SKUs.",
    "Enable back-in-stock notifications.",
    "Reduce paid acquisition until inventory recovers.",
  ],
  customers: [
    "Sync customer history to enable retention analysis.",
    "Launch a win-back flow for inactive customers.",
    "Add post-purchase sequences for first-time buyers.",
  ],
  "cash-flow": [
    "Reduce cash burn until inventory returns.",
    "Liquidate or discount dead inventory.",
    "Review operational costs against revenue trend.",
  ],
};

const IMPACT_TYPE_BY_DOMAIN: Record<string, FinancialImpactType> = {
  profit: "profit_recovery",
  marketing: "cost_reduction",
  inventory: "revenue_increase",
  customers: "revenue_increase",
  "cash-flow": "cash_flow_improvement",
};

export function domainRiskCategory(domainId: string): BusinessRiskCategory | undefined {
  return DOMAIN_TO_RISK[domainId];
}

export function pickDomainAction(
  domainId: string,
  risk: BusinessRiskAssessment,
  rec: Recommendation | null,
  opp: Opportunity | null,
  customersLimited: boolean,
): string {
  if (domainId === "customers" && customersLimited) {
    return DOMAIN_ACTIONS.customers[0]!;
  }
  if (rec?.actionLabel) return rec.actionLabel;
  if (rec?.title) return rec.title;
  if (opp?.title) return opp.title;

  const defaults = DOMAIN_ACTIONS[domainId];
  const riskCat = DOMAIN_TO_RISK[domainId];
  const categoryRisk = riskCat
    ? risk.categories.find((c) => c.category === riskCat)
    : undefined;

  if (defaults?.length) {
    const riskScore = categoryRisk?.score ?? 0;
    if (riskScore >= 70) return defaults[0]!;
    if (riskScore >= 50) return defaults[1] ?? defaults[0]!;
    return defaults[2] ?? defaults[1] ?? defaults[0]!;
  }

  return "Review this area in Analytics for specific next steps.";
}

export function buildCurrentSituation(
  domainId: string,
  detail: string,
  risk: BusinessRiskAssessment,
  customersLimited: boolean,
): string {
  if (domainId === "customers" && customersLimited) {
    return "Customer purchase history is not fully connected, so retention signals are limited.";
  }
  const riskCat = DOMAIN_TO_RISK[domainId];
  const row = riskCat ? risk.categories.find((c) => c.category === riskCat) : undefined;
  if (row && row.score >= 50) return row.summary;
  return detail;
}

export function buildWhyItMatters(
  domainId: string,
  risk: BusinessRiskAssessment,
  customersLimited: boolean,
): string {
  const riskCat = DOMAIN_TO_RISK[domainId];
  const row = riskCat ? risk.categories.find((c) => c.category === riskCat) : undefined;

  const defaults: Record<string, string> = {
    profit:
      "Thin or negative margins mean every sale and ad dollar must work harder to protect profitability.",
    marketing:
      "Inefficient acquisition spend drains budget without generating profitable growth.",
    inventory:
      "Advertising cannot convert into revenue without available inventory.",
    customers:
      customersLimited
        ? "Without customer history, churn and repeat-purchase opportunities stay hidden."
        : "Weak retention raises acquisition costs and caps lifetime value.",
    "cash-flow":
      "Cash burn without inventory or profit recovery shortens your operating runway.",
  };

  if (row?.financialExposure[0]) {
    const exposure = row.financialExposure[0]!.amountMonthly;
    if (domainId === "inventory") {
      return `Advertising cannot convert into revenue without available inventory — an estimated $${exposure.toLocaleString()}/month may be at risk.`;
    }
    if (domainId === "marketing") {
      return `Inefficient ad spend may waste approximately $${exposure.toLocaleString()}/month without profitable returns.`;
    }
  }

  return defaults[domainId] ?? "This area directly affects revenue, margin, or retention.";
}

export function buildExpectedOutcome(
  domainId: string,
  impactMonthly: number | null,
): string {
  const impactType = IMPACT_TYPE_BY_DOMAIN[domainId] ?? "profit_recovery";
  const label = FINANCIAL_IMPACT_LABELS[impactType];

  if (impactMonthly != null && impactMonthly > 0) {
    if (impactType === "cost_reduction") {
      return `${label}: approximately $${impactMonthly.toLocaleString()}/month in wasted spend.`;
    }
    return `Potential recovery of approximately $${impactMonthly.toLocaleString()}/month.`;
  }

  const fallbacks: Record<string, string> = {
    profit: "Stabilize margin and stop profit leakage from unprofitable spend.",
    marketing: "Improve ROAS and reduce wasted acquisition budget.",
    inventory: "Restore sell-through and recover lost revenue from stockouts.",
    customers: "Unlock retention campaigns and repeat-purchase revenue.",
    "cash-flow": "Extend runway and reduce unnecessary cash burn.",
  };
  return fallbacks[domainId] ?? "Measurable improvement in this health area.";
}

export function financialImpactType(domainId: string): FinancialImpactType {
  return IMPACT_TYPE_BY_DOMAIN[domainId] ?? "profit_recovery";
}

export function buildInactionConsequence(
  domainId: string,
  impactMonthly: number | null,
  status: string,
): { label: string; amountMonthly: number | null } | null {
  if (status !== "critical" && status !== "warning") return null;

  const labels: Record<string, string> = {
    profit: "Estimated profit erosion",
    marketing: "Estimated wasted ad spend",
    inventory: "Estimated lost revenue",
    customers: "Estimated missed repeat revenue",
    "cash-flow": "Estimated cash burn",
  };

  return {
    label: labels[domainId] ?? "Estimated business impact",
    amountMonthly: impactMonthly,
  };
}

export function interpretBenchmarkPercentile(
  label: string,
  percentile: number,
): { kind: "strength" | "weakness" | "neutral"; text: string } {
  if (percentile >= 75) {
    return {
      kind: "strength",
      text: `${label} ranks in the top ${100 - percentile}% of similar stores — a competitive advantage worth protecting.`,
    };
  }
  if (percentile <= 25) {
    return {
      kind: "weakness",
      text: `Your ${label.toLowerCase()} is lower than approximately ${100 - percentile}% of similar stores.`,
    };
  }
  if (percentile <= 40) {
    return {
      kind: "weakness",
      text: `${label} is below most comparable businesses and may be limiting growth.`,
    };
  }
  return {
    kind: "neutral",
    text: `${label} is near the cohort median for similar stores.`,
  };
}

export function buildPriorityMeta(input: {
  domainId: string;
  impactMonthly: number | null;
  confidencePct?: number;
}): {
  difficulty: "Low" | "Medium" | "High";
  timeRequired: string;
  confidence: string;
  timeUntilResults: string;
} {
  const { domainId, impactMonthly, confidencePct = 75 } = input;

  const difficultyByDomain: Record<string, "Low" | "Medium" | "High"> = {
    profit: "Medium",
    marketing: "Low",
    inventory: "Medium",
    customers: impactMonthly == null ? "Low" : "Medium",
    "cash-flow": "Medium",
  };

  const timeByDomain: Record<string, string> = {
    profit: "1–2 weeks",
    marketing: "2–5 days",
    inventory: "3–10 days",
    customers: "1–3 days setup",
    "cash-flow": "1–2 weeks",
  };

  const resultsByDomain: Record<string, string> = {
    profit: "2–4 weeks",
    marketing: "3–7 days",
    inventory: "1–2 weeks after restock",
    customers: "2–6 weeks",
    "cash-flow": "2–4 weeks",
  };

  return {
    difficulty: difficultyByDomain[domainId] ?? "Medium",
    timeRequired: timeByDomain[domainId] ?? "1–2 weeks",
    confidence: `${confidencePct}%`,
    timeUntilResults: resultsByDomain[domainId] ?? "2–4 weeks",
  };
}
