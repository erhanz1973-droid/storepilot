"use client";

import type { ProfitPeriodMetrics } from "@/lib/profit/types";
import { useState } from "react";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ProfitFormulaExpandable({ period }: { period: ProfitPeriodMetrics }) {
  const [open, setOpen] = useState(false);
  const net = period.netProfit ?? 0;

  const terms = [
    { label: "Revenue", value: period.revenue, op: "" },
    { label: "COGS", value: period.cogs, op: "−" },
    { label: "Advertising", value: period.adSpend, op: "−" },
    { label: "Shipping", value: period.shippingCost, op: "−" },
    { label: "Fees", value: period.transactionFees, op: "−" },
    { label: "Refunds", value: period.refunds, op: "−" },
  ];

  return (
    <div className="card profit-formula-card">
      <button
        type="button"
        className="profit-formula-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <h3 style={{ margin: 0 }}>Profit Formula</h3>
        <span className="muted">{open ? "Hide calculation" : "Inspect calculation"}</span>
      </button>

      {!open && (
        <p className="muted profit-formula-collapsed-hint" style={{ margin: "8px 0 0" }}>
          Net profit:{" "}
          <strong className={net < 0 ? "negative" : "positive"}>{formatMoney(net)}</strong>{" "}
          (last 30 days) — expand to see the full equation.
        </p>
      )}

      {open && (
        <div className="profit-formula-detail">
          {terms.map((t) => (
            <div key={t.label} className="profit-formula-row">
              <span>{t.label}</span>
              <span>
                {t.op}
                {formatMoney(t.value)}
              </span>
            </div>
          ))}
          <div className="profit-formula-row total">
            <span>Estimated Net Profit</span>
            <strong className={net < 0 ? "negative" : "positive"}>{formatMoney(net)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
