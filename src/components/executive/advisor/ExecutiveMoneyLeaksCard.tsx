import type { MoneyLeaksSection } from "@/lib/analytics/executive-advisor";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ExecutiveMoneyLeaksCard({ leaks }: { leaks: MoneyLeaksSection }) {
  if (leaks.items.length === 0) return null;

  return (
    <section className="exec-advisor-money-leaks card">
      <h2 className="exec-advisor-section-title exec-advisor-money-leaks-title">Money Leaks</h2>
      <p className="muted exec-advisor-leaks-note">Unique losses only — overlapping items are excluded.</p>
      <ul className="exec-advisor-leaks-list">
        {leaks.items.map((item) => (
          <li key={item.id} className="exec-advisor-leak-row">
            <span>{item.label}</span>
            <strong className="exec-advisor-leak-amount">-{fmt(item.amountMonthly)}</strong>
          </li>
        ))}
      </ul>
      {leaks.excludedOverlaps.length > 0 && (
        <div className="exec-advisor-leaks-excluded">
          <p className="muted exec-advisor-leaks-excluded-title">Excluded (already counted above)</p>
          <ul>
            {leaks.excludedOverlaps.map((ex) => (
              <li key={ex.label}>
                {ex.label}: {ex.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="exec-advisor-leak-total">
        <span>TOTAL LOST</span>
        <strong>-{fmt(leaks.totalLostMonthly)}</strong>
      </div>
    </section>
  );
}
