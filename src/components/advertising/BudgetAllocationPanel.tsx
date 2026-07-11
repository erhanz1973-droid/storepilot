import type { AdvertisingWorkspaceView } from "@/lib/advertising/types";
import { formatRoas } from "@/lib/attribution/format-roas";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const DIR_ICON = { up: "↑", down: "↓", flat: "→" } as const;

export function BudgetAllocationPanel({
  allocation,
}: {
  allocation: AdvertisingWorkspaceView["budgetAllocation"];
}) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Budget Allocation</h2>
      <p className="muted adv-budget-rationale">{allocation.rationale}</p>
      <div className="adv-budget-compare">
        <div className="adv-budget-col">
          <h4>Current</h4>
          {allocation.channels.map((c) => (
            <div key={`cur-${c.channel}`} className="adv-budget-row">
              <span>{c.label}</span>
              <strong>{fmt(c.currentAmount)}</strong>
            </div>
          ))}
        </div>
        <div className="adv-budget-col">
          <h4>Recommended</h4>
          {allocation.channels.map((c) => (
            <div key={`rec-${c.channel}`} className="adv-budget-row">
              <span>
                {c.direction !== "flat" && (
                  <span className={`adv-budget-dir adv-dir-${c.direction}`}>
                    {DIR_ICON[c.direction]}
                  </span>
                )}
                {c.label}
              </span>
              <strong>{fmt(c.recommendedAmount)}</strong>
            </div>
          ))}
        </div>
      </div>

      {allocation.reasons.length > 0 && (
        <div className="adv-budget-reasons">
          <h4 style={{ margin: "0 0 8px" }}>Reason</h4>
          {allocation.reasons.map((r) => (
            <article key={r.channel} className="adv-budget-reason-card">
              <div className="adv-budget-reason-header">
                <strong>{r.label}</strong>
                <span className={`adv-budget-dir adv-dir-${r.direction}`}>
                  {DIR_ICON[r.direction]} ROAS {formatRoas(r.roas)}
                </span>
              </div>
              <p className="muted" style={{ margin: "4px 0", fontSize: "0.85rem" }}>{r.summary}</p>
              <p className="adv-budget-gain">
                Expected Gain: <strong className="positive">+{fmt(r.expectedGainMonthly)}/mo</strong>
              </p>
            </article>
          ))}
        </div>
      )}

      <p className="adv-budget-impact">
        Expected Monthly Profit:{" "}
        <strong className="positive">+{fmt(allocation.expectedMonthlyProfit)}</strong>
      </p>
    </div>
  );
}
