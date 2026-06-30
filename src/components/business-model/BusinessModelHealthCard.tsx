import type { BusinessModelHealth, DashboardWidgetId } from "@/lib/business-model/types";
import { BUSINESS_MODEL_LABELS } from "@/lib/business-model/types";

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  inventory_health: "Inventory Health",
  inventory_aging: "Inventory Aging",
  clearance_opportunities: "Clearance Opportunities",
  warehouse_value: "Warehouse Value",
  winning_products: "Winning Products",
  scaling_opportunities: "Scaling Opportunities",
  creative_fatigue: "Creative Fatigue",
  campaign_health: "Campaign Health",
  top_roas_products: "Top ROAS Products",
  churn_risk: "Churn Risk",
  subscription_growth: "Subscription Growth",
  funnel_conversion: "Funnel Conversion",
  design_performance: "Design Performance",
};

type Props = {
  health: BusinessModelHealth;
  widgets: DashboardWidgetId[];
  source?: "manual" | "detected" | "default";
};

export function BusinessModelHealthCard({ health, widgets, source }: Props) {
  const sourceLabel =
    source === "manual"
      ? "Your selection"
      : source === "detected"
        ? "Auto-detected"
        : null;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem", textTransform: "uppercase" }}>
            Business Model Health
          </p>
          <h3 style={{ margin: "4px 0 0" }}>
            {BUSINESS_MODEL_LABELS[health.businessModel]}
          </h3>
          {sourceLabel && (
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
              {sourceLabel}
            </p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{health.overallScorePct}</div>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Overall score</p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {health.metrics.slice(0, 5).map((metric) => (
          <div
            key={metric.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "8px 0",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div>
              <strong style={{ fontSize: "0.9rem" }}>{metric.label}</strong>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                {metric.detail}
              </p>
            </div>
            <span
              style={{
                fontWeight: 600,
                color:
                  metric.status === "healthy"
                    ? "var(--success)"
                    : metric.status === "watch"
                      ? "var(--warning)"
                      : "var(--critical)",
              }}
            >
              {metric.scorePct}
            </span>
          </div>
        ))}
      </div>

      {widgets.length > 0 && (
        <p className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: "0.8rem" }}>
          Active widgets: {widgets.map((w) => WIDGET_LABELS[w]).join(" · ")}
        </p>
      )}
    </div>
  );
}
