import Link from "next/link";
import { getActionCapability } from "@/lib/insights/actions";
import { MetricPills } from "@/components/MetricPills";
import type { DecisionItem } from "@/lib/decisions/center";

const PRIORITY_BADGE: Record<DecisionItem["priority"], string> = {
  critical: "badge-critical",
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
};

export function DecisionCenterList({ items }: { items: DecisionItem[] }) {
  if (items.length === 0) {
    return (
      <p className="muted" style={{ fontSize: "0.9rem" }}>
        No open decisions — your store looks healthy.
      </p>
    );
  }

  return (
    <div className="stack">
      {items.map((item) => {
        const action = item.futureAction ? getActionCapability(item.futureAction as never) : undefined;
        return (
          <article
            key={item.id}
            className="insight-card"
            style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <span className={`badge ${PRIORITY_BADGE[item.priority]}`}>{item.priority}</span>
                  <span className="badge badge-medium">{item.status}</span>
                  <span className="badge badge-medium" style={{ opacity: 0.75 }}>
                    {item.source}
                  </span>
                </div>
                <h4 style={{ margin: "0 0 6px" }}>{item.summary}</h4>
                <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.9rem" }}>
                  <strong>Why:</strong> {item.why}
                </p>
                {item.supportingMetrics.length > 0 && (
                  <MetricPills metrics={item.supportingMetrics} />
                )}
                <p style={{ margin: "8px 0 0", fontSize: "0.9rem" }}>
                  <strong>Action:</strong> {item.recommendedAction}
                </p>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                  Est. impact: {item.estimatedImpactLabel}
                </p>
                {action && (
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
                    {action.label} · {item.actionAvailable ? "Available" : "Approval required (coming soon)"}
                  </p>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{item.confidencePct}%</div>
                <div className="muted" style={{ fontSize: "0.75rem" }}>
                  confidence
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function DecisionCenterHeader() {
  return (
    <p className="muted" style={{ marginTop: 4, fontSize: "0.9rem" }}>
      Unified recommendations from monitors, insights, and alerts. Critical items always surface first.{" "}
      <Link href="/approvals">Approval Center</Link> · <Link href="/ask-ai">AI Copilot</Link>
    </p>
  );
}
