import Link from "next/link";
import type { BusinessForecast } from "@/lib/analytics/executive-experience";

function fmt(n: number) {
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toLocaleString()}`;
}

export function BusinessForecastCard({ forecast }: { forecast: BusinessForecast }) {
  const profitNegative = forecast.projectedMonthlyProfit < 0;

  return (
    <section className="exec-forecast-card card">
      <p className="exec-forecast-eyebrow">AI Forecast</p>
      <p className="exec-forecast-lead">{forecast.trendLabel}, your estimated monthly profit will be:</p>
      <p className={`exec-forecast-profit ${profitNegative ? "negative" : "positive"}`}>
        {fmt(forecast.projectedMonthlyProfit)}
      </p>
      <div className="exec-forecast-recovery">
        <span className="muted">AI believes it can recover:</span>
        <strong className="exec-forecast-recovery-value">+{fmt(forecast.recoveryMonthly)}/month</strong>
      </div>
      <p className="exec-forecast-confidence muted">
        Confidence: <strong>{forecast.confidencePct}%</strong>
      </p>
      <Link href="/decisions" className="btn btn-primary exec-forecast-cta">
        Review Recovery Plan
      </Link>
    </section>
  );
}
