"use client";

import { useEffect } from "react";
import type { ProfitCalculationTrace } from "@/lib/analytics/executive-finance";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type Props = {
  trace: ProfitCalculationTrace;
  label?: string;
  displayValue?: number;
  compact?: boolean;
  open: boolean;
  onClose: () => void;
};

export function ExecutiveCalculationDrawerPanel({
  trace,
  label = "Estimated Profit",
  displayValue,
  open,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || trace.status === "unavailable") return null;

  const value = displayValue ?? trace.estimatedProfit;

  return (
    <>
      <button
        type="button"
        className="exec-advisor-calc-backdrop"
        aria-label="Close calculation"
        onClick={onClose}
      />
      <aside className="exec-advisor-calc-sheet" role="dialog" aria-label="Profit calculation">
        <div className="exec-advisor-calc-sheet-header">
          <h3>{label}</h3>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="exec-advisor-calc-formula muted">{trace.formula}</p>
        <ul className="exec-advisor-calc-lines">
          {trace.lines.map((line) => (
            <li key={line.id} className={`exec-advisor-calc-line ${line.sign}`}>
              <span>{line.label}</span>
              <strong>
                {line.sign === "subtract" ? "−" : ""}
                {fmt(line.amount)}
              </strong>
            </li>
          ))}
          <li className="exec-advisor-calc-line total">
            <span>{label}</span>
            <strong className={value < 0 ? "negative" : "positive"}>{fmt(value)}</strong>
          </li>
        </ul>
        {!trace.isBalanced && (
          <p className="exec-advisor-calc-warning muted">
            Recalculated from components — original estimate differed by{" "}
            {fmt(Math.abs(trace.estimatedProfit - trace.computedProfit))}.
          </p>
        )}
        {trace.status === "estimated" && (
          <p className="muted exec-advisor-calc-estimated">Some inputs are estimated.</p>
        )}
      </aside>
    </>
  );
}
