"use client";

import { useState } from "react";
import type { ExecutiveHealthBreakdown } from "@/lib/analytics/executive-advisor";

function scoreColor(score: number | null): string {
  if (score == null) return "var(--muted)";
  if (score >= 70) return "var(--low)";
  if (score >= 40) return "var(--medium)";
  return "var(--critical)";
}

export function ExecutiveHealthBreakdownCard({
  health,
}: {
  health: ExecutiveHealthBreakdown | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!health) return null;

  const overallColor = scoreColor(health.overall);

  return (
    <section className="exec-advisor-health card">
      <button
        type="button"
        className="exec-advisor-health-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <h2 className="exec-advisor-section-title">Store Health</h2>
        <span className="muted exec-advisor-health-toggle-hint">
          {expanded ? "Hide breakdown" : "View score breakdown →"}
        </span>
      </button>
      <div className="exec-advisor-health-header">
        <div className="health-ring" style={{ borderColor: overallColor }}>
          <span className="health-ring-value">{health.overall}</span>
          <span className="health-ring-max">/100</span>
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: overallColor }}>{health.label}</p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
            Weighted score across inventory, ads, pricing, conversion, retention & profitability
          </p>
        </div>
      </div>
      {expanded && (
        <ul className="exec-advisor-health-categories">
          {health.categories.map((cat) => (
            <li key={cat.id} className="exec-advisor-health-category">
              <div className="exec-advisor-health-category-head">
                <span>{cat.label}</span>
                <strong style={{ color: scoreColor(cat.score) }}>
                  {cat.status === "waiting" ? "Waiting for Data" : `${cat.score}/100`}
                </strong>
              </div>
              <p className="muted exec-advisor-health-explanation">{cat.explanation}</p>
              {cat.contributionNote && (
                <p className="muted exec-advisor-health-contribution">{cat.contributionNote}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
