import Link from "next/link";
import type { BusinessForecast } from "@/lib/analytics/executive-experience";
import type { RecoveryBreakdown } from "@/lib/analytics/executive-advisor";
import type { ProfitCalculationTrace } from "@/lib/analytics/executive-finance";
import { ExecutiveRecoveryBreakdown } from "@/components/executive/advisor/ExecutiveRecoveryBreakdown";
import { ExecutiveCalculationDrawer } from "@/components/executive/advisor/ExecutiveCalculationDrawer";
import { EXEC_METRIC_ICONS, MetricLabel } from "@/components/executive/advisor/executive-metric-icons";

function fmt(n: number) {
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toLocaleString()}`;
}

export function ExecutiveHeroSection({
  forecast,
  recoveryBreakdown,
  profitCalculation,
}: {
  forecast: BusinessForecast;
  recoveryBreakdown: RecoveryBreakdown;
  profitCalculation: ProfitCalculationTrace;
}) {
  const profitNegative = forecast.projectedMonthlyProfit < 0;

  return (
    <section className="exec-advisor-hero card">
      <p className="exec-forecast-eyebrow">Financial Snapshot</p>
      <div className="exec-advisor-hero-grid exec-advisor-hero-hierarchy">
        <div className="exec-advisor-hero-metric tier-primary">
          <MetricLabel icon={EXEC_METRIC_ICONS.profit} className="exec-advisor-hero-label">
            Estimated Profit
          </MetricLabel>
          <span className={`exec-forecast-profit exec-hero-value-primary ${profitNegative ? "negative" : "positive"}`}>
            {fmt(forecast.projectedMonthlyProfit)}
          </span>
          <ExecutiveCalculationDrawer
            trace={profitCalculation}
            displayValue={forecast.projectedMonthlyProfit}
            compact
          />
        </div>
        <div className="exec-advisor-hero-metric tier-secondary">
          <MetricLabel icon={EXEC_METRIC_ICONS.recovery} className="exec-advisor-hero-label">
            Recovery Potential
          </MetricLabel>
          <div className="exec-hero-value-secondary">
            <ExecutiveRecoveryBreakdown breakdown={recoveryBreakdown} />
          </div>
        </div>
        <div className="exec-advisor-hero-metric tier-tertiary">
          <MetricLabel icon={EXEC_METRIC_ICONS.confidence} className="exec-advisor-hero-label">
            Confidence
          </MetricLabel>
          <span className="exec-advisor-hero-confidence">{forecast.confidencePct}%</span>
        </div>
      </div>
      <div className="exec-advisor-hero-actions">
        <Link href="/decisions" className="btn btn-primary">
          Review Recovery Plan
        </Link>
        <Link href="/decisions?autopilot=1" className="btn btn-secondary">
          Enable AI Autopilot
        </Link>
      </div>
    </section>
  );
}
