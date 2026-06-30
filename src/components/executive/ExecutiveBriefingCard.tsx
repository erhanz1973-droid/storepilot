import Link from "next/link";
import type { ExecutiveBriefing } from "@/lib/analytics/executive-experience";

const SYNC_BADGE: Record<ExecutiveBriefing["syncStatus"], string> = {
  healthy: "badge-low",
  stale: "badge-medium",
  error: "badge-critical",
};

export function ExecutiveBriefingCard({ briefing }: { briefing: ExecutiveBriefing }) {
  return (
    <section className="exec-briefing-card card">
      <div className="exec-briefing-header">
        <div>
          <p className="exec-briefing-eyebrow">AI Commerce Advisor</p>
          <h2 className="exec-briefing-greeting">{briefing.greeting}.</h2>
        </div>
        <div className="exec-briefing-meta">
          <span className={`badge ${SYNC_BADGE[briefing.syncStatus]}`}>{briefing.syncStatus}</span>
          <time className="muted">
            {new Date(briefing.lastSyncAt).toLocaleString()}
          </time>
        </div>
      </div>
      <div className="exec-briefing-body">
        {briefing.paragraphs.map((line) => (
          <p key={line} className="exec-briefing-line">
            {line}
          </p>
        ))}
      </div>
      <Link href="/insights" className="btn btn-primary exec-briefing-cta">
        Review Recommendations
      </Link>
    </section>
  );
}
