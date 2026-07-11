"use client";

const METRIC_DEFINITIONS: Record<string, string> = {
  roas: "Return on Ad Spend. Measures revenue generated for every advertising dollar.",
  cpa: "Average advertising cost required to acquire one customer.",
  confidence: "Probability that StorePilot's recommendation will improve profitability.",
  estimated_profit: "Projected monthly improvement after implementation.",
  ad_spend: "Estimated change in monthly advertising spend after approval.",
};

export function MetricInfo({ metricKey, label }: { metricKey?: string; label?: string }) {
  const text = (metricKey && METRIC_DEFINITIONS[metricKey]) || label;
  if (!text) return null;

  return (
    <span className="metric-info" title={text} aria-label={text}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
        <text x="7" y="10" textAnchor="middle" fontSize="8" fill="currentColor" fontWeight="600">
          i
        </text>
      </svg>
    </span>
  );
}
