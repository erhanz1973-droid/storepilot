import type { ExecutiveFinancialContext } from "@/lib/analytics/executive-advisor-enrichment";
import { RecoveryForecastDisplay } from "@/components/executive/advisor/RecoveryForecastDisplay";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ExecutiveFinancialContextCard({
  context,
}: {
  context: ExecutiveFinancialContext;
}) {
  return (
    <section className="exec-advisor-financial-context card">
      <h2 className="exec-advisor-section-title">Financial Context</h2>
      <p className="muted exec-advisor-financial-context-intro">
        Recovery numbers are easier to act on when viewed against your full financial picture.
      </p>
      <ul className="exec-advisor-financial-context-grid">
        <li>
          <span className="muted">Current Revenue</span>
          <strong>{fmt(context.currentRevenue)}</strong>
          <span className="exec-advisor-financial-sub muted">30-day run rate</span>
        </li>
        <li>
          <span className="muted">Estimated Profit</span>
          {context.profitStatus === "unavailable" ? (
            <>
              <strong className="exec-kpi-warning">Unavailable</strong>
              <span className="exec-advisor-financial-sub muted">{context.profitUnavailableMessage}</span>
            </>
          ) : (
            <>
              <strong className={(context.estimatedProfit ?? 0) < 0 ? "negative" : "positive"}>
                {fmt(context.estimatedProfit ?? 0)}
              </strong>
              <span className="exec-advisor-financial-sub muted">Monthly run rate</span>
            </>
          )}
        </li>
        <li>
          <span className="muted">Revenue at Risk</span>
          <strong className="negative">{fmt(context.revenueAtRisk)}</strong>
          <span className="exec-advisor-financial-sub muted">Monthly waste & leakage</span>
        </li>
        <li>
          <span className="muted">Cash Locked in Inventory</span>
          <strong className="exec-kpi-warning">{fmt(context.cashLockedInInventory)}</strong>
          <span className="exec-advisor-financial-sub muted">Slow-moving SKUs</span>
        </li>
        <li className="exec-advisor-financial-recovery-cell">
          <span className="muted">Monthly Recovery Potential</span>
          <RecoveryForecastDisplay
            explanation={context.recoveryExplanation}
            amountFallback={context.monthlyRecoveryPotential}
            compact
          />
          {!context.recoveryExplanation?.range && (
            <>
              <strong className="positive">+{fmt(context.monthlyRecoveryPotential)}</strong>
              <span className="exec-advisor-financial-sub muted">Expected net scenario</span>
            </>
          )}
        </li>
      </ul>
    </section>
  );
}
