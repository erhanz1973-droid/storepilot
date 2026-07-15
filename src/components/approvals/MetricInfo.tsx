"use client";

import { useMemo, useState } from "react";
import type { ExplainedValue } from "@/lib/calculations/audit/types";
import { MetricExplainDrawer } from "@/components/audit/MetricExplainDrawer";

const METRIC_DEFINITIONS: Record<string, string> = {
  roas: "Return on Ad Spend. Measures revenue generated for every advertising dollar.",
  cpa: "Average advertising cost required to acquire one customer.",
  confidence: "Probability that StorePilot's recommendation will improve profitability.",
  estimated_profit: "Projected monthly improvement after implementation.",
  ad_spend: "Estimated change in monthly advertising spend after approval.",
  recoverable_profit_opportunity:
    "Recoverable Business Value estimates the total monthly financial opportunity currently being lost. Net Profit Improvement estimates the portion expected to appear directly in operating profit after implementation.",
};

/**
 * Info control for every executive / approval KPI.
 * When `explained` is provided, opens a step-by-step audit drawer (merchant transparency).
 * Otherwise falls back to a title tooltip.
 */
export function MetricInfo({
  metricKey,
  label,
  explained,
  title,
}: {
  metricKey?: string;
  label?: string;
  explained?: ExplainedValue | null;
  /** Drawer heading override */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const text = (metricKey && METRIC_DEFINITIONS[metricKey]) || label;
  const drawerTitle = useMemo(
    () => title || (metricKey ? METRIC_DEFINITIONS[metricKey]?.split(".")[0] : null) || "Metric",
    [title, metricKey],
  );

  if (!text && !explained) return null;

  if (explained) {
    return (
      <>
        <button
          type="button"
          className="metric-info metric-info-button"
          aria-label={`Explain ${drawerTitle}`}
          onClick={() => setOpen(true)}
        >
          <InfoIcon />
        </button>
        <MetricExplainDrawer
          open={open}
          onClose={() => setOpen(false)}
          title={drawerTitle}
          explained={explained}
        />
      </>
    );
  }

  return (
    <span className="metric-info" title={text!} aria-label={text!}>
      <InfoIcon />
    </span>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
      <text x="7" y="10" textAnchor="middle" fontSize="8" fill="currentColor" fontWeight="600">
        i
      </text>
    </svg>
  );
}
