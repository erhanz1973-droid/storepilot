import Link from "next/link";
import type { PriorityQueueItem } from "@/lib/insights/types";

const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;

export function PriorityQueuePanel({ items }: { items: PriorityQueueItem[] }) {
  if (items.length === 0) return null;

  const grouped = PRIORITY_ORDER.map((level) => ({
    level,
    items: items.filter((i) => i.priority === level).slice(0, 3),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>AI Priority Queue</h3>
      <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: "0.9rem" }}>
        What to fix first, ranked by profit impact and confidence
      </p>
      <div className="stack" style={{ gap: 16 }}>
        {grouped.map((group) => (
          <div key={group.level}>
            <h4
              style={{
                margin: "0 0 8px",
                fontSize: "0.8rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: group.level === "critical" ? "var(--critical)" : undefined,
              }}
            >
              {group.level}
            </h4>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {group.items.map((item) => (
                <li key={item.id} style={{ marginBottom: 10 }}>
                  <strong>{item.title}</strong>
                  <p className="muted" style={{ margin: "4px 0", fontSize: "0.875rem" }}>
                    {item.summary}
                  </p>
                  {item.expectedImpactLabel && (
                    <p style={{ margin: 0, fontSize: "0.85rem" }}>{item.expectedImpactLabel}</p>
                  )}
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    {item.confidence}% confidence
                    {item.futureAction && ` · Future action: ${item.futureAction.replace(/_/g, " ")}`}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 12, marginBottom: 0, fontSize: "0.875rem" }}>
        <Link href="/autopilot">Full Action Center</Link>
        {" · "}
        <Link href="/approvals">Approval Center</Link>
      </p>
    </div>
  );
}
