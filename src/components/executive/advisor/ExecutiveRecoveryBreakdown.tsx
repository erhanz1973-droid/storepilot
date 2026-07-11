"use client";

import { useState } from "react";
import type { RecoveryBreakdown } from "@/lib/analytics/executive-advisor";
import { RecoveryForecastDisplay } from "@/components/executive/advisor/RecoveryForecastDisplay";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type Props = {
  breakdown: RecoveryBreakdown;
  compact?: boolean;
};

export function ExecutiveRecoveryBreakdown({ breakdown, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const { scenarios, explanation, forecast } = breakdown;

  if (breakdown.items.length === 0 && breakdown.netMonthly <= 0) return null;

  return (
    <div className={`exec-advisor-recovery-breakdown ${compact ? "compact" : ""}`}>
      <RecoveryForecastDisplay
        forecast={forecast}
        explanation={explanation}
        amountFallback={breakdown.netMonthly}
        compact={compact}
      />

      <div className="exec-advisor-recovery-scenarios">
        {(["conservative", "expected", "bestCase"] as const).map((key) => {
          const scenario = scenarios[key];
          const isExpected = key === "expected";
          return (
            <div
              key={key}
              className={`exec-advisor-recovery-scenario ${isExpected ? "primary" : ""}`}
            >
              <span className="exec-advisor-recovery-scenario-label muted">{scenario.label}</span>
              <strong className={isExpected ? "exec-advisor-recovery-net positive" : ""}>
                +{fmt(scenario.amountMonthly)}/mo
              </strong>
              {!compact && (
                <p className="muted exec-advisor-recovery-scenario-assumptions">
                  {scenario.assumptions}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {explanation && !forecast && explanation.basedOn.length > 0 && (
        <div className="exec-advisor-recovery-explanation">
          <p className="muted" style={{ margin: "8px 0 4px", fontSize: "0.82rem" }}>
            Based on:
          </p>
          <ul className="exec-advisor-recovery-explanation-list">
            {explanation.basedOn.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.78rem" }}>
            {explanation.disclaimer}
          </p>
        </div>
      )}

      <button
        type="button"
        className="exec-advisor-recovery-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="muted exec-advisor-recovery-toggle-hint">
          {open ? "Hide breakdown" : "See opportunity breakdown"}
          {breakdown.overlapRemoved > 0 &&
            ` (${fmt(breakdown.overlapRemoved)} overlap removed)`}
        </span>
      </button>
      {open && (
        <div className="exec-advisor-recovery-panel">
          <p className="exec-advisor-recovery-panel-title">Recovery Breakdown</p>
          <ul className="exec-advisor-recovery-list">
            {breakdown.items.map((item) => (
              <li key={item.id} className="exec-advisor-recovery-item">
                <span>{item.label}</span>
                <strong>+{fmt(item.amountMonthly)}</strong>
              </li>
            ))}
          </ul>
          <div className="exec-advisor-recovery-total">
            <span>Gross Opportunity</span>
            <strong>+{fmt(breakdown.grossMonthly)}</strong>
          </div>
          {breakdown.overlapRemoved > 0 && (
            <div className="exec-advisor-recovery-overlap">
              <span>Overlap removed</span>
              <strong>−{fmt(breakdown.overlapRemoved)}</strong>
            </div>
          )}
          <div className="exec-advisor-recovery-total net">
            <span>Expected Net Recovery</span>
            <strong>+{fmt(breakdown.netMonthly)}</strong>
          </div>
          <div className="exec-advisor-recovery-scenario-details">
            {(["conservative", "expected", "bestCase"] as const).map((key) => {
              const scenario = scenarios[key];
              return (
                <p key={key} className="muted exec-advisor-recovery-scenario-assumptions">
                  <strong>{scenario.label}:</strong> {scenario.assumptions}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
