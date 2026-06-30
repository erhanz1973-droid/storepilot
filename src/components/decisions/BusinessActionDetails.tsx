import type { AffectedEntity } from "@/lib/insights/business-action-groups";
import type { DecisionItem } from "@/lib/decisions/center";
import { ShopifyScopeAlert } from "@/components/execution/ShopifyScopeAlert";

const VISIBLE_PRODUCT_LIMIT = 5;

function metricValue(item: DecisionItem, label: string): string | undefined {
  return item.supportingMetrics.find((m) => m.label === label)?.value;
}

type Props = {
  item: DecisionItem;
  compact?: boolean;
};

export function BusinessActionDetails({ item, compact = false }: Props) {
  if (!item.isGroupedAction) return null;

  const affected = item.affectedEntities ?? [];
  const visible = affected.slice(0, VISIBLE_PRODUCT_LIMIT);
  const hiddenCount = Math.max(0, affected.length - visible.length);

  const discount = metricValue(item, "Discount");
  const duration = metricValue(item, "Duration");
  const productsAffected =
    metricValue(item, "Products affected") ?? String(affected.length || "—");
  const revenueRecovery = metricValue(item, "Est. revenue recovery");
  const inventoryReduction = metricValue(item, "Est. inventory reduction");

  return (
    <div className={`business-action-details${compact ? " business-action-details--compact" : ""}`}>
      {affected.length > 0 && (
        <div className="business-action-section">
          <p className="decision-section-label">Affected products</p>
          <ul className="business-action-product-list">
            {visible.map((entity) => (
              <li key={entity.id}>{entity.name}</li>
            ))}
            {hiddenCount > 0 && <li className="muted">…and {hiddenCount} more</li>}
          </ul>
        </div>
      )}

      <div className="business-action-section">
        <p className="decision-section-label">Recommended action</p>
        <p className="decision-section-body">{item.recommendedAction}</p>
      </div>

      <div className="business-action-metrics-grid">
        {discount && (
          <div className="business-action-metric">
            <span className="muted">Discount</span>
            <strong>{discount}</strong>
          </div>
        )}
        {duration && (
          <div className="business-action-metric">
            <span className="muted">Duration</span>
            <strong>{duration}</strong>
          </div>
        )}
        <div className="business-action-metric">
          <span className="muted">Products affected</span>
          <strong>{productsAffected}</strong>
        </div>
        {revenueRecovery && (
          <div className="business-action-metric">
            <span className="muted">Est. revenue recovery</span>
            <strong>{revenueRecovery}</strong>
          </div>
        )}
        {inventoryReduction && (
          <div className="business-action-metric">
            <span className="muted">Est. inventory reduction</span>
            <strong>{inventoryReduction}</strong>
          </div>
        )}
      </div>

      {item.executionAvailability === "one_click" && !item.missingShopifyScopes?.length && (
        <p className="muted business-action-execution-note">
          One-click after approval — StorePilot prepares one Shopify automatic discount covering all
          selected products.
        </p>
      )}

      <ShopifyScopeAlert item={item} />
    </div>
  );
}

export function affectedEntityNames(entities: AffectedEntity[] | undefined): string[] {
  return (entities ?? []).map((e) => e.name);
}
