import type { ExecutiveFocusSummary } from "@/lib/analytics/ai-daily-playbook";
import { EXECUTIVE_MODULES } from "@/lib/analytics/executive-modules";
import { RecoveryForecastDisplay } from "@/components/executive/advisor/RecoveryForecastDisplay";
import Link from "next/link";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ExecutiveFocusSummaryCard({ focus }: { focus: ExecutiveFocusSummary }) {
  return (
    <section className="card exec-focus-summary">
      <p className="exec-focus-badge">CEO Briefing</p>
      <h2 style={{ margin: "4px 0 12px" }}>What should I focus on today?</h2>

      <div className="exec-focus-grid">
        {focus.todayDecision && (
          <div className="exec-focus-card exec-focus-decision">
            <span className="muted">Today&apos;s Executive Decision</span>
            <strong>{focus.todayDecision.title}</strong>
            <div className="exec-focus-links">
              <Link href={focus.todayDecision.moduleHref} className="btn btn-ghost btn-sm">
                {EXECUTIVE_MODULES[focus.todayDecision.module].label} →
              </Link>
              <Link href={focus.todayDecision.approvalHref} className="btn btn-primary btn-sm">
                Approve
              </Link>
            </div>
          </div>
        )}

        {focus.topRisks.length > 0 && (
          <div className="exec-focus-card">
            <span className="muted">Top Business Risks</span>
            <ul className="exec-focus-risk-list">
              {focus.topRisks.map((r) => (
                <li key={r.label}>
                  <Link href={r.href}>{r.label}</Link>
                  <span className="exec-focus-module-tag">{EXECUTIVE_MODULES[r.module].role}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="exec-focus-card">
          <span className="muted">Recovery Potential</span>
          <RecoveryForecastDisplay
            explanation={focus.recoveryExplanation}
            amountFallback={focus.recoveryPotentialMonthly}
            compact
          />
          {!focus.recoveryExplanation?.range && (
            <strong className="positive">+{fmt(focus.recoveryPotentialMonthly)}/month</strong>
          )}
          <Link href={EXECUTIVE_MODULES.profit.href} className="exec-focus-inline-link">
            View financial recovery →
          </Link>
        </div>

        <div className="exec-focus-card">
          <span className="muted">Business Health</span>
          {focus.businessHealth.score > 0 ? (
            <strong>
              {focus.businessHealth.score}/100 — {focus.businessHealth.label}
            </strong>
          ) : (
            <strong>{focus.businessHealth.label}</strong>
          )}
          <Link href={focus.businessHealth.href} className="exec-focus-inline-link">
            Health diagnosis →
          </Link>
        </div>
      </div>
    </section>
  );
}
