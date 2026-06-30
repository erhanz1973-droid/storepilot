import type { ProductsPageView } from "@/lib/products/page-view";
import { RECOMMENDATION_BADGE_LABELS } from "@/lib/products/recommendations";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ProductsRecoverySection({
  recovery,
  allHealthy,
}: {
  recovery: ProductsPageView["recovery"];
  allHealthy: boolean;
}) {
  if (allHealthy) {
    return (
      <div className="card products-recovery-section healthy">
        <h3 style={{ margin: "0 0 8px" }}>AI Merchandising Manager</h3>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          All products are currently healthy. StorePilot will continue monitoring your catalog
          and notify you when optimization opportunities appear.
        </p>
      </div>
    );
  }

  if (recovery.opportunities.length === 0) return null;

  return (
    <div className="card products-recovery-section">
      <div className="products-recovery-header">
        <div>
          <h3 style={{ margin: 0 }}>AI Merchandising Opportunities</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
            {recovery.opportunities.length} actions identified across your catalog
          </p>
        </div>
        <strong className="products-recovery-total positive">
          {formatMoney(recovery.totalMonthlyRecovery)}/month
        </strong>
      </div>
      <div className="products-recovery-list">
        {recovery.opportunities.map((opp) => (
          <div key={opp.id} className="products-recovery-item detailed">
            <div className="products-recovery-item-head">
              <strong>
                {RECOMMENDATION_BADGE_LABELS[opp.badge]} — {opp.productTitle}
              </strong>
              <span className="positive">+{formatMoney(opp.estimatedMonthlyImpact)}/mo</span>
            </div>
            <ul className="products-recovery-reasoning">
              {opp.reasoning.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="products-recovery-action">
              <strong>Recommendation:</strong> {opp.action}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
