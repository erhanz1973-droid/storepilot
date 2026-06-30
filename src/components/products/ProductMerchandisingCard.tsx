"use client";

import type { EnrichedProductCard } from "@/lib/products/page-view";
import { RECOMMENDATION_BADGE_LABELS } from "@/lib/products/recommendations";

const STATUS_CLASS: Record<EnrichedProductCard["displayStatus"], string> = {
  Winner: "status-winner",
  Healthy: "status-healthy",
  Scaling: "status-scaling",
  "Low Margin": "status-low-margin",
  "Over Advertised": "status-over-advertised",
  "Dead Inventory": "status-dead-inventory",
  "Out of Stock": "status-oos",
  "Losing Money": "status-losing",
};

const LIFECYCLE_CLASS: Record<EnrichedProductCard["lifecycleStage"], string> = {
  Launching: "lifecycle-launching",
  Growing: "lifecycle-growing",
  Winning: "lifecycle-winning",
  Stable: "lifecycle-stable",
  Declining: "lifecycle-declining",
  "Dead Inventory": "lifecycle-dead",
};

const HEALTH_TIER_CLASS: Record<EnrichedProductCard["healthTier"], string> = {
  Healthy: "health-tier-healthy",
  "Needs Attention": "health-tier-attention",
  Critical: "health-tier-critical",
};

const REC_CLASS: Record<EnrichedProductCard["recommendation"]["badge"], string> = {
  increase_budget: "rec-increase",
  pause_advertising: "rec-pause",
  optimize_advertising: "rec-optimize",
  create_bundle: "rec-bundle",
  restock: "rec-restock",
  discount: "rec-discount",
  price_increase: "rec-price",
  reduce_carrying_cost: "rec-carrying",
  healthy: "rec-healthy",
  monitor: "rec-monitor",
};

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type Props = {
  product: EnrichedProductCard;
  selected: boolean;
  compareMode: boolean;
  onToggleCompare: () => void;
  onOpen: () => void;
};

export function ProductMerchandisingCard({
  product: p,
  selected,
  compareMode,
  onToggleCompare,
  onOpen,
}: Props) {
  const growth = p.trends.revenueGrowthPct;

  return (
    <article
      className={`product-merch-card ${p.isLosingMoney ? "losing" : ""} ${selected ? "selected" : ""}`}
      onClick={compareMode ? onToggleCompare : onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") compareMode ? onToggleCompare() : onOpen();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="product-merch-header">
        {compareMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleCompare}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Compare ${p.title}`}
          />
        )}
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt="" className="product-thumb" />
        ) : (
          <div className="product-thumb product-thumb-placeholder">SKU</div>
        )}
        <div className="product-merch-title">
          <h4>{p.title}</h4>
          <div className="product-badges">
            <span className={`product-status-pill ${STATUS_CLASS[p.displayStatus]}`}>
              {p.displayStatus}
            </span>
            <span className={`product-lifecycle-pill ${LIFECYCLE_CLASS[p.lifecycleStage]}`}>
              {p.lifecycleStage}
            </span>
            <span className={`product-rec-badge ${REC_CLASS[p.recommendation.badge]}`}>
              {RECOMMENDATION_BADGE_LABELS[p.recommendation.badge]}
            </span>
          </div>
        </div>
        <div className={`product-health-tier ${HEALTH_TIER_CLASS[p.healthTier]}`}>
          <strong>{p.healthScore}</strong>
          <span>Health</span>
        </div>
      </div>

      <dl className="product-merch-metrics">
        <div><dt>Revenue</dt><dd>{formatMoney(p.revenue)}</dd></div>
        <div>
          <dt>Net Profit</dt>
          <dd className={p.netProfit < 0 ? "negative" : "positive"}>{formatMoney(p.netProfit)}</dd>
        </div>
        <div><dt>Margin</dt><dd>{p.marginPct}%</dd></div>
        <div><dt>ROAS</dt><dd>{p.productRoas?.toFixed(2) ?? "—"}</dd></div>
        <div><dt>Inventory</dt><dd>{p.inventory}</dd></div>
        <div>
          <dt>Days of Stock</dt>
          <dd>{p.daysUntilStockout != null ? `~${p.daysUntilStockout}` : p.inventory === 0 ? "0" : "—"}</dd>
        </div>
        <div>
          <dt>Last Sale</dt>
          <dd>{p.lastSaleDaysAgo != null ? `${p.lastSaleDaysAgo}d ago` : "—"}</dd>
        </div>
        <div>
          <dt>Sales Trend</dt>
          <dd>
            {p.salesTrendLabel}
            {growth != null && (
              <span className={`trend-delta ${growth >= 0 ? "positive" : "negative"}`}>
                {growth >= 0 ? "+" : ""}{growth}%
              </span>
            )}
          </dd>
        </div>
      </dl>

      {p.merchandisingInsights.length > 0 && (
        <ul className="product-merch-insights">
          {p.merchandisingInsights.slice(0, 2).map((insight) => (
            <li key={insight.id} className={`insight-${insight.severity}`}>
              {insight.text}
            </li>
          ))}
        </ul>
      )}

      <div className="product-merch-rec-block">
        <p className="product-merch-rec">{p.recommendation.action}</p>
        {p.recommendation.expectedMonthlyImpact > 0 && (
          <span className="product-merch-impact positive">
            +{formatMoney(p.recommendation.expectedMonthlyImpact)}/mo
          </span>
        )}
      </div>
    </article>
  );
}
