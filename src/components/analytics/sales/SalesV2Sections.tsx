"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import type {
  CustomerValueSummary,
  DiscountInsight,
  OrderIntelligenceHighlight,
  OrderProfitBreakdown,
  RevenueDriver,
  RevenueQuality,
  SalesBrief,
  SalesBusinessKpi,
  SalesOpportunity,
  SalesOrderRow,
  TrendCommentary,
} from "@/lib/analytics/sales-manager-v2";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function toneClass(tone?: SalesBusinessKpi["tone"]) {
  if (tone === "positive") return "sal-v2-kpi-positive";
  if (tone === "negative") return "sal-v2-kpi-negative";
  if (tone === "warning") return "sal-v2-kpi-warning";
  return "";
}

function scoreTone(score: number) {
  if (score >= 85) return "positive";
  if (score >= 65) return "warning";
  return "negative";
}

export function SalesBriefCard({ brief }: { brief: SalesBrief }) {
  return (
    <section className="card sal-v2-brief">
      <div className="sal-v2-brief-header">
        <span className="sal-v2-brief-icon" aria-hidden>
          ✦
        </span>
        <div>
          <p className="sal-v2-brief-greeting">{brief.greeting}.</p>
          <p className="muted sal-v2-brief-sub">Your AI Sales Manager</p>
        </div>
      </div>
      <div className="sal-v2-brief-body">
        {brief.lines.map((line) => (
          <p key={line} className="sal-v2-brief-line">
            {line}
          </p>
        ))}
      </div>
      {brief.todayPriority && (
        <div className="sal-v2-brief-priority">
          <span className="sal-v2-priority-label">Today&apos;s biggest opportunity</span>
          <strong>{brief.todayPriority}</strong>
          {brief.todayPriorityAction && (
            <span className="sal-v2-priority-action">{brief.todayPriorityAction}</span>
          )}
        </div>
      )}
    </section>
  );
}

export function SalesBusinessKpiRow({ kpis }: { kpis: SalesBusinessKpi[] }) {
  return (
    <div className="analytics-metric-grid sal-v2-kpi-grid">
      {kpis.map((kpi) => (
        <div key={kpi.id} className={`analytics-metric-card sal-v2-kpi ${toneClass(kpi.tone)}`}>
          <p className="analytics-metric-label">{kpi.label}</p>
          <p className="analytics-metric-value">{kpi.value}</p>
          {kpi.sublabel && <p className="analytics-metric-sublabel">{kpi.sublabel}</p>}
        </div>
      ))}
    </div>
  );
}

export function RevenueQualityCard({ quality }: { quality: RevenueQuality }) {
  return (
    <section className="card sal-v2-quality">
      <div className="sal-v2-quality-header">
        <div>
          <h3 style={{ marginTop: 0 }}>Revenue Quality</h3>
          <p className="muted" style={{ margin: 0 }}>
            How healthy and sustainable your revenue is
          </p>
        </div>
        <div className={`sal-v2-quality-score sal-v2-score-${scoreTone(quality.score)}`}>
          <span className="sal-v2-quality-value">{quality.score}</span>
          <span className="muted">/ 100</span>
        </div>
      </div>
      <div className="sal-v2-quality-columns">
        <div>
          <span className="sal-v2-rec-label">Strengths</span>
          <ul className="sal-v2-reason-list">
            {quality.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        {quality.warnings.length > 0 && (
          <div>
            <span className="sal-v2-rec-label">Watch</span>
            <ul className="sal-v2-reason-list sal-v2-warnings">
              {quality.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export function RevenueDriversSection({ drivers }: { drivers: RevenueDriver[] }) {
  if (!drivers.length) return null;

  return (
    <section className="card sal-v2-drivers">
      <h3 style={{ marginTop: 0 }}>Revenue Drivers</h3>
      <p className="muted sal-v2-section-desc">What is driving revenue right now.</p>
      <div className="sal-v2-driver-grid">
        {drivers.map((d) => (
          <div key={d.id} className="sal-v2-driver-card">
            <span className="muted sal-v2-driver-label">{d.label}</span>
            <strong className="sal-v2-driver-value">{d.value}</strong>
            {d.detail && <span className="muted sal-v2-driver-detail">{d.detail}</span>}
            {d.contributionPct != null && (
              <span className="sal-v2-driver-pct">{d.contributionPct}% of revenue</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function SalesOpportunitySection({ opportunities }: { opportunities: SalesOpportunity[] }) {
  if (!opportunities.length) return null;

  return (
    <section className="card sal-v2-opportunities">
      <h3 style={{ marginTop: 0 }}>AI Opportunities</h3>
      <p className="muted sal-v2-section-desc">Sorted by expected business impact.</p>
      <ol className="sal-v2-opp-list">
        {opportunities.map((o, i) => (
          <li key={o.id} className="sal-v2-opp-item">
            <div className="sal-v2-opp-rank">{i + 1}</div>
            <div className="sal-v2-opp-body">
              <div className="sal-v2-opp-header">
                <strong>{o.title}</strong>
                <span className="sal-v2-opp-impact positive">+{fmt(o.estimatedProfitMonthly)}/month</span>
              </div>
              <p className="muted sal-v2-recovery-prob">Recovery probability: {o.recoveryProbabilityPct}%</p>
              <ul className="sal-v2-reason-list">
                {o.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function healthClass(health: SalesOrderRow["health"]) {
  return `sal-v2-health sal-v2-health-${health.toLowerCase().replace(/\s+/g, "-")}`;
}

function ProfitBreakdownPanel({ breakdown }: { breakdown: OrderProfitBreakdown }) {
  const rows = [
    { label: "Revenue", value: breakdown.revenue, tone: "default" as const },
    { label: "Product Cost", value: -breakdown.productCost, tone: "negative" as const },
    { label: "Advertising Cost", value: -breakdown.advertisingCost, tone: "negative" as const },
    { label: "Shipping", value: -breakdown.shipping, tone: "negative" as const },
    { label: "Payment Fees", value: -breakdown.paymentFees, tone: "negative" as const },
  ];
  if (breakdown.discounts > 0) {
    rows.push({ label: "Discounts", value: -breakdown.discounts, tone: "negative" });
  }
  if (breakdown.refunds > 0) {
    rows.push({ label: "Refunds", value: -breakdown.refunds, tone: "negative" });
  }

  return (
    <div className="sal-v2-profit-breakdown">
      {rows.map((row) => (
        <div key={row.label} className="sal-v2-breakdown-row">
          <span>{row.label}</span>
          <strong className={row.tone === "negative" ? "negative" : ""}>
            {row.tone === "negative" ? "−" : ""}
            {fmt(Math.abs(row.value))}
          </strong>
        </div>
      ))}
      <div className="sal-v2-breakdown-row sal-v2-breakdown-total">
        <span>Net Profit</span>
        <strong className={breakdown.netProfit >= 0 ? "positive" : "negative"}>
          {fmt(breakdown.netProfit)}
        </strong>
      </div>
    </div>
  );
}

function OrderHighlightsPanel({ highlights }: { highlights: OrderIntelligenceHighlight[] }) {
  if (!highlights.length) return null;

  return (
    <div className="sal-v2-order-highlights">
      {highlights.map((h) => (
        <div key={h.id} className="sal-v2-order-highlight-card">
          <span className="muted sal-v2-highlight-label">{h.label}</span>
          <strong>{h.customer}</strong>
          <span className="sal-v2-highlight-value">{h.value}</span>
          <span className="muted sal-v2-highlight-detail">{h.detail}</span>
        </div>
      ))}
    </div>
  );
}

export function OrderIntelligenceSection({
  orders,
  highlights = [],
}: {
  orders: SalesOrderRow[];
  highlights?: OrderIntelligenceHighlight[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section className="card sal-v2-orders">
      <div className="sal-v2-orders-header">
        <div>
          <h3 style={{ margin: 0 }}>Order Intelligence</h3>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Profitable orders matter more than order count alone — click a row for profit breakdown
          </p>
        </div>
        <Link href="/commerce/orders" className="btn btn-sm">
          View all orders
        </Link>
      </div>

      <OrderHighlightsPanel highlights={highlights} />

      <div className="sal-v2-orders-table-wrap">
        <table className="sal-v2-orders-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Revenue</th>
              <th>Profit</th>
              <th>Margin</th>
              <th>Health</th>
              <th>Channel</th>
              <th>Type</th>
              <th>Badges</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <Fragment key={o.id}>
                <tr
                  className={`sal-v2-order-row ${expandedId === o.id ? "expanded" : ""}`}
                  onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                >
                  <td>{o.externalId}</td>
                  <td>{o.customer}</td>
                  <td>{fmt(o.revenue)}</td>
                  <td className={o.profit < 0 ? "negative" : "positive"}>{fmt(o.profit)}</td>
                  <td>{o.marginPct.toFixed(1)}%</td>
                  <td>
                    <span className={healthClass(o.health)}>{o.health}</span>
                  </td>
                  <td>{o.channel}</td>
                  <td>{o.customerType}</td>
                  <td>
                    <div className="sal-v2-badge-row">
                      {o.badges.map((b) => (
                        <span key={b} className="sal-v2-badge">
                          {b}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
                {expandedId === o.id && (
                  <tr className="sal-v2-order-detail-row">
                    <td colSpan={9}>
                      <div className="sal-v2-order-detail">
                        <div>
                          <strong>Profit breakdown</strong>
                          <ProfitBreakdownPanel breakdown={o.breakdown} />
                        </div>
                        <div className="sal-v2-order-detail-meta">
                          <span>
                            <strong>Refund risk:</strong> {o.refundRisk}
                          </span>
                          {o.customerLifetimeValue != null && (
                            <span>
                              <strong>LTV:</strong> {fmt(o.customerLifetimeValue)}
                            </span>
                          )}
                          <span>
                            <strong>Date:</strong>{" "}
                            {new Date(o.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TrendCommentaryPanel({ commentary }: { commentary: TrendCommentary }) {
  return (
    <section className="card sal-v2-trend-commentary">
      <h3 style={{ marginTop: 0 }}>AI Trend Commentary</h3>
      <ul className="sal-v2-trend-lines">
        <li>{commentary.revenueLine}</li>
        <li>{commentary.ordersLine}</li>
        <li>
          <strong>{commentary.insight}</strong>
        </li>
      </ul>
    </section>
  );
}

export function CustomerValueSection({ value }: { value: CustomerValueSummary }) {
  return (
    <section className="card sal-v2-customer-value">
      <h3 style={{ marginTop: 0 }}>Customer Value</h3>
      <div className="sal-v2-cv-grid">
        <div>
          <span className="muted">New Customer Revenue</span>
          <strong>{fmt(value.newCustomerRevenue)}</strong>
        </div>
        <div>
          <span className="muted">Returning Customer Revenue</span>
          <strong>{fmt(value.returningCustomerRevenue)}</strong>
        </div>
        <div>
          <span className="muted">Repeat Purchase Rate</span>
          <strong>{value.repeatPurchaseRatePct.toFixed(1)}%</strong>
        </div>
        <div>
          <span className="muted">Customer Lifetime Value</span>
          <strong>
            {value.ltv != null ? fmt(value.ltv) : "—"}
            {value.ltvStatus !== "verified" && value.ltv != null && (
              <span className="muted sal-v2-ltv-note"> ({value.ltvStatus})</span>
            )}
          </strong>
        </div>
      </div>
    </section>
  );
}

export function DiscountInsightCard({ insight }: { insight: DiscountInsight }) {
  return (
    <section className="card sal-v2-discount">
      <h3 style={{ marginTop: 0 }}>Discount Performance</h3>
      <div className="sal-v2-discount-grid">
        <div>
          <span className="muted">Discounts Applied</span>
          <strong>{fmt(insight.discountTotal)}</strong>
        </div>
        <div>
          <span className="muted">Attributed Revenue</span>
          <strong className="positive">{fmt(insight.additionalRevenue)}</strong>
        </div>
        <div>
          <span className="muted">Margin Impact</span>
          <strong className="negative">−{insight.marginImpactPct}%</strong>
        </div>
      </div>
      <p className="sal-v2-discount-explanation">{insight.explanation}</p>
    </section>
  );
}

export function SecondaryMetricsRow({ metrics }: { metrics: SalesBusinessKpi[] }) {
  return (
    <section className="card sal-v2-secondary">
      <h3 style={{ marginTop: 0 }}>Order Economics</h3>
      <p className="muted sal-v2-section-desc">Taxes, shipping, and discounts — secondary detail.</p>
      <div className="sal-v2-secondary-grid">
        {metrics.map((m) => (
          <div key={m.id}>
            <span className="muted">{m.label}</span>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
