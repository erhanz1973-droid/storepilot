/**
 * Phase 5 scaffolding — classify differences vs external analytics (Shopify / Meta / GA4).
 * Never silently ignore discrepancies.
 */

export type ExternalSource =
  | "shopify_analytics"
  | "meta_ads_manager"
  | "google_ads"
  | "ga4"
  | "storepilot";

export type DiscrepancyCategory =
  | "exact_match"
  | "attribution_model"
  | "attribution_window"
  | "timezone"
  | "refund_timing"
  | "currency_fx"
  | "filter_scope"
  | "data_lag"
  | "unexplained";

export type ExternalMetricPoint = {
  metricId: string;
  source: ExternalSource;
  value: number;
  windowLabel: string;
  observedAt: string;
};

export type MetricDiscrepancy = {
  metricId: string;
  storepilot: number;
  external: number;
  externalSource: ExternalSource;
  relativeDelta: number;
  category: DiscrepancyCategory;
  explanation: string;
  requiresInvestigation: boolean;
};

export function classifyDiscrepancy(input: {
  metricId: string;
  storepilot: number;
  external: number;
  externalSource: ExternalSource;
  knownCause?: DiscrepancyCategory;
  explanation?: string;
  /** Relative tolerance before "unexplained" (default 1%) */
  relTolerance?: number;
}): MetricDiscrepancy {
  const delta = input.external === 0
    ? Math.abs(input.storepilot - input.external)
    : Math.abs(input.storepilot - input.external) / Math.abs(input.external);
  const tol = input.relTolerance ?? 0.01;

  if (Math.abs(input.storepilot - input.external) < 1e-6 || delta <= Number.EPSILON) {
    return {
      metricId: input.metricId,
      storepilot: input.storepilot,
      external: input.external,
      externalSource: input.externalSource,
      relativeDelta: 0,
      category: "exact_match",
      explanation: "Values match.",
      requiresInvestigation: false,
    };
  }

  if (delta <= tol && !input.knownCause) {
    return {
      metricId: input.metricId,
      storepilot: input.storepilot,
      external: input.external,
      externalSource: input.externalSource,
      relativeDelta: delta,
      category: "data_lag",
      explanation:
        input.explanation ??
        `Within ${tol * 100}% tolerance — treat as provisional until sync confirms.`,
      requiresInvestigation: false,
    };
  }

  const category = input.knownCause ?? "unexplained";
  return {
    metricId: input.metricId,
    storepilot: input.storepilot,
    external: input.external,
    externalSource: input.externalSource,
    relativeDelta: delta,
    category,
    explanation:
      input.explanation ??
      (category === "unexplained"
        ? "Unexplained discrepancy — investigate before treating metric as authoritative."
        : `Categorized as ${category}.`),
    requiresInvestigation: category === "unexplained",
  };
}
