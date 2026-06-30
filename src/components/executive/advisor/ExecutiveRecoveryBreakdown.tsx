"use client";

import { useState } from "react";
import type { RecoveryBreakdown } from "@/lib/analytics/executive-advisor";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type Props = {
  breakdown: RecoveryBreakdown;
  compact?: boolean;
};

export function ExecutiveRecoveryBreakdown({ breakdown, compact = false }: Props) {
  const [open, setOpen] = useState(false);

  if (breakdown.items.length === 0) return null;

  return (
    <div className={`exec-advisor-recovery-breakdown ${compact ? "compact" : ""}`}>
      <div className="exec-advisor-recovery-summary">
        <div className="exec-advisor-recovery-metric">
          <span className="exec-advisor-recovery-metric-label">Expected Net Recovery</span>
          <strong className="exec-advisor-recovery-net">+{fmt(breakdown.netMonthly)}/month</strong>
        </div>
        <div className="exec-advisor-recovery-metric secondary">
          <span className="exec-advisor-recovery-metric-label">Gross Opportunity</span>
          <span className="exec-advisor-recovery-gross">+{fmt(breakdown.grossMonthly)}/month</span>
        </div>
      </div>
      <button
        type="button"
        className="exec-advisor-recovery-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="muted exec-advisor-recovery-toggle-hint">
          {open ? "Hide breakdown" : "See recovery breakdown"}
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
        </div>
      )}
    </div>
  );
}
