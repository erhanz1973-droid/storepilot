import type { SupportingMetric } from "@/lib/types";

/** Business value tier — lower number = higher priority in UI and AI copy */
export type MetricTier = 1 | 2 | 3;

export const METRIC_TIER_LABELS: Record<MetricTier, string> = {
  1: "Business Outcome",
  2: "Decision Metric",
  3: "Diagnostic",
};

/** Tier 1 — outcomes merchants care about first */
const TIER1_IDS = new Set([
  "profit",
  "net_profit",
  "revenue",
  "cash_flow",
  "contribution_margin",
  "orders",
  "gross_margin",
  "ltv",
  "customer_lifetime_value",
]);

/** Tier 2 — explain performance and drive decisions */
const TIER2_IDS = new Set([
  "roas",
  "blended_roas",
  "break_even_roas",
  "cac",
  "mer",
  "conversion_rate",
  "cvr",
  "aov",
  "returning_customer_rate",
  "cpa",
  "ad_spend",
  "spend",
]);

/** Tier 3 — diagnostic only; never lead AI headlines */
const TIER3_PATTERNS =
  /\b(cpm|cpc|ctr|frequency|reach|impressions?|clicks?|engagement rate)\b/i;

const TIER2_PATTERNS =
  /\b(roas|break[- ]?even|cac|mer|conversion|conv\.?\s*rate|aov|cpa|returning|spend|ad spend)\b/i;

const TIER1_PATTERNS =
  /\b(net profit|profit|revenue|cash flow|contribution margin|orders|gross margin|ltv|lifetime value)\b/i;

export function metricTierForLabel(label: string): MetricTier {
  const normalized = label.toLowerCase().trim();
  const id = normalized.replace(/[^a-z0-9]+/g, "_");

  if (TIER1_IDS.has(id) || TIER1_PATTERNS.test(label)) return 1;
  if (TIER3_PATTERNS.test(label)) return 3;
  if (TIER2_IDS.has(id) || TIER2_PATTERNS.test(label)) return 2;
  return 2;
}

export function isDiagnosticMetric(label: string): boolean {
  return metricTierForLabel(label) === 3;
}

export function sortSupportingMetricsByTier(metrics: SupportingMetric[]): SupportingMetric[] {
  return [...metrics].sort(
    (a, b) => metricTierForLabel(a.label) - metricTierForLabel(b.label),
  );
}

export type BusinessFirstInsightInput = {
  /** Tier 1 — what happened (business outcome) */
  headline: string;
  /** Tier 2 — why it happened */
  why: string;
  /** Optional explicit business impact */
  businessImpact?: string;
  /** What the merchant should do */
  action: string;
  /** Tier 3 — supporting diagnostics (shown in evidence expansion) */
  diagnostics: SupportingMetric[];
};

export type BusinessFirstInsight = {
  headline: string;
  summary: string;
  evidence: SupportingMetric[];
  action: string;
};

/**
 * Structures AI copy as: what happened → why → business impact.
 * Diagnostic metrics belong in evidence, never the headline.
 */
export function buildBusinessFirstInsight(input: BusinessFirstInsightInput): BusinessFirstInsight {
  const summaryParts = [input.why];
  if (input.businessImpact) summaryParts.push(input.businessImpact);

  return {
    headline: input.headline,
    summary: summaryParts.join(" "),
    evidence: sortSupportingMetricsByTier(input.diagnostics),
    action: input.action,
  };
}

/** Narrative order for copilot / advisor sections */
export const AI_INSIGHT_SECTION_ORDER = [
  "what_happened",
  "why_it_happened",
  "business_impact",
  "recommended_action",
  "diagnostic_evidence",
] as const;
