import type { ChannelProfitabilityCard } from "@/lib/analytics/channel-profitability-card";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatTrend(pct: number | null): { arrow: string; label: string; tone: string } | null {
  if (pct == null) return null;
  if (Math.abs(pct) < 2) {
    return { arrow: "—", label: "Flat", tone: "flat" };
  }
  if (pct > 0) {
    return { arrow: "▲", label: `+${Math.round(pct)}%`, tone: "positive" };
  }
  return { arrow: "▼", label: `${Math.round(pct)}%`, tone: "negative" };
}

function TrendCell({ label, pct }: { label: string; pct: number | null }) {
  const trend = formatTrend(pct);
  return (
    <div className="ch-profit-trend-cell">
      <span className="muted">{label}</span>
      {trend ? (
        <strong className={`ch-profit-trend-${trend.tone}`}>
          {trend.arrow} {trend.label}
        </strong>
      ) : (
        <strong className="muted">—</strong>
      )}
    </div>
  );
}

function BreakdownTable({ lines }: { lines: ChannelProfitabilityCard["breakdown"] }) {
  return (
    <div className="ch-profit-breakdown">
      <span className="ch-profit-section-label">Contribution Breakdown</span>
      <dl className="ch-profit-breakdown-lines">
        {lines.map((line) => (
          <div
            key={line.id}
            className={`ch-profit-breakdown-line ${line.id === "net" ? "net" : ""}`}
          >
            <dt>{line.label}</dt>
            <dd>
              <span className={line.sign === "-" && line.amount > 0 ? "negative" : ""}>
                {formatMoney(line.amount)}
              </span>
              <span className="ch-profit-breakdown-pct">{line.pctOfRevenue}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ChannelProfitabilityDecisionCard({ card }: { card: ChannelProfitabilityCard }) {
  const hasTrends =
    card.trends.revenuePct != null ||
    card.trends.profitPct != null ||
    card.trends.trafficPct != null;

  return (
    <article className={`card ch-profit-card ch-profit-tier-${card.tier}`}>
      <header className="ch-profit-header">
        <div>
          <h4 className="ch-profit-channel">{card.channelLabel}</h4>
          <p className="ch-profit-tier">
            <span aria-hidden>{card.tierEmoji}</span> {card.tierLabel}
          </p>
        </div>
        <div className="ch-profit-margin-block">
          <span className="muted">Net Contribution Margin</span>
          <strong className={card.contributionMarginPct < 0 ? "negative" : "positive"}>
            {card.contributionMarginPct}%
          </strong>
        </div>
      </header>

      <div className="ch-profit-kpi-grid">
        <div>
          <span className="muted">Revenue</span>
          <strong>{formatMoney(card.revenue)}</strong>
        </div>
        <div>
          <span className="muted">Estimated Net Contribution</span>
          <strong className={card.netContribution < 0 ? "negative" : "positive"}>
            {formatMoney(card.netContribution)}
          </strong>
        </div>
        <div>
          <span className="muted">Orders</span>
          <strong>{card.orders.toLocaleString()}</strong>
        </div>
        <div>
          <span className="muted">Average Order Value</span>
          <strong>{formatMoney(card.aov)}</strong>
        </div>
      </div>

      <p className="ch-profit-summary">
        <strong>{card.summaryLine}</strong> {card.narrative}
      </p>

      {card.breakdown.length > 0 && <BreakdownTable lines={card.breakdown} />}

      {hasTrends && (
        <div className="ch-profit-trends">
          <span className="ch-profit-section-label">vs Previous Period</span>
          <div className="ch-profit-trend-grid">
            <TrendCell label="Revenue" pct={card.trends.revenuePct} />
            <TrendCell label="Profit" pct={card.trends.profitPct} />
            <TrendCell label="Traffic" pct={card.trends.trafficPct} />
          </div>
        </div>
      )}

      <div className="ch-profit-benchmark">
        <span className="ch-profit-section-label">Benchmark</span>
        <div className="ch-profit-benchmark-grid">
          <div>
            <span className="muted">Share of Store Revenue</span>
            <strong>{card.benchmark.revenueSharePct}%</strong>
          </div>
          <div>
            <span className="muted">Share of Store Profit</span>
            <strong>{card.benchmark.profitSharePct}%</strong>
          </div>
        </div>
        <p className="muted ch-profit-benchmark-insight">{card.benchmark.insight}</p>
      </div>

      <div className="ch-profit-ai-insight">
        <span className="ch-profit-section-label">AI Insight</span>
        <p>{card.aiInsight}</p>
      </div>

      <div className="ch-profit-action">
        <span className="ch-profit-section-label">Decision</span>
        <p className="ch-profit-action-text ch-profit-executive-decision">{card.recommendedAction}</p>
        {card.expectedImpactMonthly > 0 && (
          <p className="ch-profit-impact">
            <span className="muted">Expected Impact</span>
            <strong className="positive">+{formatMoney(card.expectedImpactMonthly)}/month</strong>
          </p>
        )}
      </div>

      {!card.connected && card.revenue === 0 && (
        <p className="muted ch-profit-disconnected">Not connected — connect for attribution</p>
      )}
    </article>
  );
}

export function ChannelProfitabilitySection({ cards }: { cards: ChannelProfitabilityCard[] }) {
  const visible = cards.filter(
    (c) =>
      c.revenue > 0 ||
      c.adSpend > 0 ||
      (!c.connected && c.tierLabel === "Not Connected"),
  );
  if (!visible.length) return null;

  return (
    <section className="card ch-profit-section">
      <h3 style={{ marginTop: 0 }}>Channel Profitability</h3>
      <p className="muted ch-profit-section-desc">
        Each channel explained as a business decision — profitability, momentum, and what to do next.
      </p>
      <div className="ch-profit-grid">
        {visible.map((card) => (
          <ChannelProfitabilityDecisionCard key={card.channelId} card={card} />
        ))}
      </div>
    </section>
  );
}
