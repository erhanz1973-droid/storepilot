"use client";

import { useState } from "react";
import type {
  RecoveryExplanation,
  RecoveryForecast,
} from "@/lib/analytics/recovery-business-constraints";
import { buildForecastExplanationLines } from "@/lib/analytics/recovery-business-constraints";

function fmt(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type Props = {
  forecast?: RecoveryForecast;
  explanation?: RecoveryExplanation;
  amountFallback?: number;
  compact?: boolean;
};

export function RecoveryForecastDisplay({
  forecast,
  explanation,
  amountFallback = 0,
  compact = false,
}: Props) {
  const [calcOpen, setCalcOpen] = useState(false);

  const range = forecast?.range ?? explanation?.range;
  const confidencePct = forecast?.confidencePct ?? explanation?.confidencePct;
  const quality = forecast?.quality ?? explanation?.quality;
  const components = forecast?.components ?? explanation?.components;
  const benchmark = forecast?.benchmark ?? explanation?.benchmark;
  const calculation = forecast?.calculation ?? explanation?.calculation;
  const mostLikely = range?.mostLikely ?? amountFallback;

  if (mostLikely <= 0 && !range) return null;

  const calcLines = forecast
    ? buildForecastExplanationLines(forecast)
    : explanation?.basedOn ?? [];

  return (
    <div className={`exec-recovery-forecast ${compact ? "compact" : ""}`}>
      {range && (
        <div className="exec-recovery-forecast-hero">
          <div className="exec-recovery-forecast-range-block">
            <span className="muted exec-recovery-forecast-label">Expected Recovery</span>
            <strong className="exec-recovery-forecast-range">
              {fmt(range.low)}–{fmt(range.high)}/month
            </strong>
          </div>
          <div className="exec-recovery-forecast-meta">
            <div>
              <span className="muted exec-recovery-forecast-label">Most Likely Outcome</span>
              <strong className="positive">+{fmt(mostLikely)}/month</strong>
            </div>
            {confidencePct != null && (
              <div>
                <span className="muted exec-recovery-forecast-label">Confidence</span>
                <strong>{confidencePct}%</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {quality && (
        <p className="exec-recovery-quality">
          <span aria-hidden>{quality.emoji}</span>{" "}
          <strong>
            {quality.label.charAt(0).toUpperCase() + quality.label.slice(1)} Estimate
          </strong>
          <span className="muted"> — {quality.description}</span>
        </p>
      )}

      {components && !compact && (
        <div className="exec-recovery-components">
          <p className="exec-recovery-components-title">Recovery Components</p>
          <ul className="exec-recovery-components-grid">
            <li>
              <span className="muted">Recoverable Ad Spend</span>
              <strong>{fmt(components.recoverableAdSpend)}/mo</strong>
            </li>
            <li>
              <span className="muted">Expected Profit Increase</span>
              <strong className="positive">+{fmt(components.expectedProfitIncrease)}/mo</strong>
            </li>
            <li>
              <span className="muted">Revenue Impact</span>
              <strong className={components.revenueImpact < 0 ? "negative" : "positive"}>
                {components.revenueImpact >= 0 ? "+" : ""}
                {fmt(components.revenueImpact)}/mo
              </strong>
            </li>
            {components.roasBefore && components.roasAfter && (
              <li>
                <span className="muted">Expected ROAS</span>
                <strong>
                  {components.roasBefore} → {components.roasAfter}
                </strong>
              </li>
            )}
          </ul>
        </div>
      )}

      {benchmark && (
        <div className="exec-recovery-benchmark">
          <p className="muted exec-recovery-benchmark-label">{benchmark.segmentLabel}</p>
          <div className="exec-recovery-benchmark-row">
            <span>
              Average recovery <strong>{fmt(benchmark.averageRecovery)}/mo</strong>
            </span>
            <span>
              Your estimate <strong className="positive">+{fmt(benchmark.yourRecovery)}/mo</strong>
            </span>
          </div>
          <p className="muted exec-recovery-benchmark-percentile">
            Better than {benchmark.percentileBetterThan}% of similar stores
          </p>
        </div>
      )}

      {(calculation || calcLines.length > 0) && (
        <div className="exec-recovery-calculation">
          <button
            type="button"
            className="exec-recovery-calculation-toggle"
            onClick={() => setCalcOpen((v) => !v)}
            aria-expanded={calcOpen}
          >
            {calcOpen ? "Hide calculation" : "How was this calculated?"}
          </button>
          {calcOpen && (
            <div className="exec-recovery-calculation-panel">
              <p className="exec-recovery-calculation-title">Recovery Model</p>
              <ul className="exec-recovery-calculation-list">
                {calcLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {calculation && (
                <p className="muted exec-recovery-calculation-foot">
                  Projected monthly profit increase:{" "}
                  <strong>+{fmt(calculation.projectedMonthlyProfitIncrease)}</strong>
                </p>
              )}
              {explanation?.wasCapped && explanation.capNote && (
                <p className="muted exec-recovery-calculation-foot">
                  Adjusted for business scale: {explanation.capNote}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
