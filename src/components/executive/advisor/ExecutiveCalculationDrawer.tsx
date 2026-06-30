"use client";

import { useState } from "react";
import type { ProfitCalculationTrace } from "@/lib/analytics/executive-finance";
import { ExecutiveCalculationDrawerPanel } from "./ExecutiveCalculationDrawerPanel";

type Props = {
  trace: ProfitCalculationTrace;
  label?: string;
  displayValue?: number;
  compact?: boolean;
};

export function ExecutiveCalculationDrawer({
  trace,
  label = "Estimated Profit",
  displayValue,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);

  if (trace.status === "unavailable") return null;

  return (
    <>
      <div className={`exec-advisor-calc-drawer ${compact ? "compact" : ""}`}>
        <button
          type="button"
          className="exec-advisor-calc-toggle"
          onClick={() => setOpen(true)}
          aria-expanded={open}
        >
          View Calculation
        </button>
      </div>
      <ExecutiveCalculationDrawerPanel
        trace={trace}
        label={label}
        displayValue={displayValue}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
