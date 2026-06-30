import Link from "next/link";
import type { ExecutiveMemoryItem } from "@/lib/analytics/executive-ai-behavior";

export function ExecutiveMemoryCard({ items }: { items: ExecutiveMemoryItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="exec-advisor-memory card">
      <h2 className="exec-advisor-section-title">Executive Memory</h2>
      <p className="muted exec-advisor-memory-sub">
        AI remembers your decisions and follows up on what happens next.
      </p>
      <ul className="exec-advisor-memory-list">
        {items.map((item) => (
          <li key={item.id} className={`exec-advisor-memory-item ${item.status}`}>
            <div className="exec-advisor-memory-head">
              <span className="exec-advisor-memory-when">{item.recommendedLabel}</span>
              <span className={`exec-advisor-memory-status ${item.status}`}>{item.statusLabel}</span>
            </div>
            <p className="exec-advisor-memory-context">{item.contextMessage}</p>
            <strong>{item.title}</strong>
            <p className={`exec-advisor-memory-impact ${item.impactPrefix === "+" ? "positive" : "negative"}`}>
              {item.status === "completed" ? "Current impact: " : "Estimated missed opportunity: "}
              <strong>
                {item.impactPrefix === "+" ? "+" : ""}
                {item.impactPrefix === "-" ? `$${item.dailyImpact.toLocaleString()}/day` : item.impactLabel}
              </strong>
            </p>
            {item.actionLabel && (
              <Link href="/decisions" className="exec-advisor-memory-action">
                {item.actionLabel}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
