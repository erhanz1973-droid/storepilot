import Link from "next/link";
import { BusinessActionDetails } from "@/components/decisions/BusinessActionDetails";
import type { DecisionItem } from "@/lib/decisions/center";

const PRIORITY_GROUP: Record<string, { label: string; levels: DecisionItem["priority"][] }> = {
  high: { label: "High Priority", levels: ["critical", "high"] },
  medium: { label: "Medium Priority", levels: ["medium"] },
  low: { label: "Low Priority", levels: ["low"] },
};

const PRIORITY_BADGE: Record<DecisionItem["priority"], string> = {
  critical: "badge-critical",
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
};

function priorityLabel(p: DecisionItem["priority"]) {
  if (p === "critical" || p === "high") return "High";
  if (p === "medium") return "Medium";
  return "Low";
}

type Props = {
  items: DecisionItem[];
  limit?: number;
  showOpenInDecisions?: boolean;
};

export function DailyActionsPanel({ items, limit, showOpenInDecisions = true }: Props) {
  const open = items.filter((i) => i.status === "open");
  const visible = limit ? open.slice(0, limit) : open;

  if (visible.length === 0) {
    return (
      <div className="card daily-actions-panel">
        <p className="muted" style={{ margin: 0 }}>
          No urgent actions right now. StorePilot is monitoring your store — check back after the
          next sync, or open{" "}
          <Link href="/ask-ai">AI Copilot</Link> to ask a specific question.
        </p>
      </div>
    );
  }

  const grouped = Object.entries(PRIORITY_GROUP).map(([key, group]) => ({
    key,
    label: group.label,
    items: visible.filter((i) => group.levels.includes(i.priority)),
  }));

  return (
    <div className="daily-actions-panel">
      {grouped.map(
        (group) =>
          group.items.length > 0 && (
            <section key={group.key} className="daily-actions-group">
              <h3 className="daily-actions-group-title">{group.label}</h3>
              <div className="stack">
                {group.items.map((item) => (
                  <article key={item.id} className="card daily-action-card">
                    <div className="daily-action-card-header">
                      <span className={`badge ${PRIORITY_BADGE[item.priority]}`}>
                        {priorityLabel(item.priority)}
                      </span>
                      <span className="muted" style={{ fontSize: "0.8rem" }}>
                        {item.confidencePct}% confidence · {item.estimatedImpactLabel}
                      </span>
                    </div>
                    <h4 className="daily-action-title">{item.summary}</h4>
                    <p className="daily-action-reason">
                      <strong>Reason:</strong> {item.why}
                    </p>
                    {item.isGroupedAction ? (
                      <BusinessActionDetails item={item} compact />
                    ) : (
                      <p className="daily-action-action muted">
                        <strong>Action:</strong> {item.recommendedAction}
                      </p>
                    )}
                    {showOpenInDecisions && (
                      <div className="actions-row" style={{ marginTop: 12 }}>
                        <Link href={`/decisions#${item.id}`} className="btn btn-primary">
                          Open in Decisions
                        </Link>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ),
      )}
    </div>
  );
}
