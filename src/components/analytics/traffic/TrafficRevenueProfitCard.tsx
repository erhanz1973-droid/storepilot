"use client";

import type { TrafficRevenueProfitCard } from "@/lib/analytics/traffic-revenue-profit-card";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtSigned(n: number, sign: "+" | "-") {
  if (n === 0) return fmt(0);
  const prefix = sign === "-" ? "−" : "";
  return `${prefix}${fmt(n)}`;
}

function FlowBreakdown({ card }: { card: TrafficRevenueProfitCard }) {
  if (!card.breakdown.length) return null;

  return (
    <div className="trf-flow-breakdown">
      <span className="trf-flow-section-label">Contribution Breakdown</span>
      <dl className="trf-flow-breakdown-lines">
        {card.breakdown.map((line) => (
          <div
            key={line.id}
            className={`trf-flow-breakdown-line ${line.id === "net" ? "net" : ""}`}
          >
            <dt>{line.label}</dt>
            <dd>
              <span
                className={
                  line.id === "net"
                    ? card.netContribution < 0
                      ? "negative"
                      : "positive"
                    : line.sign === "-" && line.amount > 0
                      ? "negative"
                      : ""
                }
              >
                {line.id === "revenue"
                  ? fmt(line.amount)
                  : fmtSigned(line.amount, line.sign)}
              </span>
              <span className="trf-flow-breakdown-pct">{line.pctOfRevenue}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function TrafficRevenueProfitCardView({
  card,
  maxSessions,
}: {
  card: TrafficRevenueProfitCard;
  maxSessions: number;
}) {
  return (
    <article className={`trf-flow-card trf-flow-${card.profitStatus}`}>
      <header className="trf-flow-card-header">
        <div>
          <h4>{card.channelLabel}</h4>
          <p className="trf-flow-tier">
            <span aria-hidden>{card.tierEmoji}</span> {card.tierLabel}
          </p>
        </div>
        <div className="trf-flow-status-grid">
          <div>
            <span className="muted">Profit Margin</span>
            <strong className={card.contributionMarginPct < 0 ? "negative" : "positive"}>
              {card.contributionMarginPct}%
            </strong>
          </div>
          {card.breakEvenRoas != null && (
            <div>
              <span className="muted">Break-even ROAS</span>
              <strong>{card.breakEvenRoas.toFixed(2)}</strong>
            </div>
          )}
          {card.roas != null && (
            <div>
              <span className="muted">Current ROAS</span>
              <strong className={card.roas < (card.breakEvenRoas ?? 1) ? "negative" : "positive"}>
                {card.roas.toFixed(2)}
              </strong>
            </div>
          )}
          <div>
            <span className="muted">Status</span>
            <strong
              className={
                card.urgencyStatus === "immediate_action" ? "negative" : ""
              }
            >
              {card.urgencyLabel}
            </strong>
          </div>
        </div>
      </header>

      <div className="trf-flow-journey">
        <div className="trf-flow-step">
          <span className="muted">Traffic</span>
          <div className="trf-v2-flow-bar-wrap">
            <div
              className="trf-v2-flow-bar trf-v2-flow-traffic"
              style={{ width: `${(card.sessions / maxSessions) * 100}%` }}
            />
          </div>
          <strong>{card.sessions.toLocaleString()}</strong>
        </div>
        <span className="trf-v2-flow-arrow" aria-hidden>
          →
        </span>
        <div className="trf-flow-step">
          <span className="muted">Revenue</span>
          <strong>{fmt(card.revenue)}</strong>
        </div>
        <span className="trf-v2-flow-arrow" aria-hidden>
          →
        </span>
        <div className="trf-flow-step">
          <span className="muted">Profit</span>
          <strong className={card.netContribution < 0 ? "negative" : "positive"}>
            {fmt(card.netContribution)}
          </strong>
        </div>
      </div>

      <p className="trf-flow-insight muted">{card.flowInsight}</p>

      <div className="trf-flow-ai">
        <span className="trf-flow-section-label">AI Insight</span>
        <p>{card.aiInsight}</p>
        <div className="trf-flow-driver">
          <span className="muted">Primary Driver</span>
          <strong>{card.primaryDriver}</strong>
        </div>
      </div>

      <FlowBreakdown card={card} />

      {card.opportunityText && (
        <div className="trf-flow-opportunity">
          <span className="trf-flow-section-label">Potential Improvement</span>
          <p>{card.opportunityText}</p>
        </div>
      )}

      <div className="trf-flow-benchmark">
        <span className="trf-flow-section-label">Compare Against Store</span>
        <div className="trf-flow-benchmark-grid">
          <div>
            <span className="muted">Share of Store Traffic</span>
            <strong>{card.trafficBenchmark.trafficSharePct}%</strong>
          </div>
          <div>
            <span className="muted">Share of Store Revenue</span>
            <strong>{card.trafficBenchmark.revenueSharePct}%</strong>
          </div>
          <div>
            <span className="muted">Share of Store Profit</span>
            <strong className={card.trafficBenchmark.profitSharePct < 0 ? "negative" : "positive"}>
              {card.trafficBenchmark.profitSharePct}%
            </strong>
          </div>
        </div>
        <p className="muted trf-flow-benchmark-insight">{card.trafficBenchmark.insight}</p>
      </div>

      <div className="trf-flow-action">
        <span className="trf-flow-section-label">Recommended Action</span>
        <p>{card.recommendedAction}</p>
        {card.potentialRecoveryMonthly > 0 && (
          <div className="trf-flow-impact-row">
            <div>
              <span className="muted">Expected Improvement</span>
              <strong className="positive">+{fmt(card.potentialRecoveryMonthly)}/month</strong>
            </div>
            <div>
              <span className="muted">Confidence</span>
              <strong>{card.recommendationConfidencePct}%</strong>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function TrafficRevenueProfitSection({
  cards,
}: {
  cards: TrafficRevenueProfitCard[];
}) {
  const visible = cards.filter((c) => c.revenue > 0 || c.sessions > 0 || c.adSpend > 0);
  if (!visible.length) return null;

  const maxSessions = Math.max(...visible.map((c) => c.sessions), 1);

  return (
    <section className="card trf-v2-flow">
      <h3 style={{ marginTop: 0 }}>Traffic → Revenue → Profit</h3>
      <p className="muted trf-v2-section-desc">
        Follow the business journey for each channel — and understand why traffic becomes profit or loss.
      </p>
      <div className="trf-v2-flow-list">
        {visible.map((card) => (
          <TrafficRevenueProfitCardView
            key={card.channelId}
            card={card}
            maxSessions={maxSessions}
          />
        ))}
      </div>
    </section>
  );
}
