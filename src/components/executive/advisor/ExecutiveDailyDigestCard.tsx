import type { DailyExecutiveDigest } from "@/lib/analytics/executive-ai-behavior";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ExecutiveDailyDigestCard({ digest }: { digest: DailyExecutiveDigest | null }) {
  if (!digest || !digest.showToday) return null;

  return (
    <section className="exec-advisor-digest card">
      <div className="exec-advisor-digest-header">
        <span className="exec-advisor-digest-badge">Executive Digest</span>
        <span className="muted exec-advisor-digest-time">
          {new Date(digest.generatedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <p className="exec-advisor-digest-greeting">{digest.greeting}</p>

      <div className="exec-advisor-digest-scan">
        {digest.storeHealthScore != null && digest.storeHealthLabel && (
          <div className="exec-advisor-digest-block">
            <span className="muted">Store Health</span>
            <strong>
              {digest.storeHealthScore} / 100
            </strong>
            <span className="exec-advisor-digest-sub">{digest.storeHealthLabel}</span>
          </div>
        )}

        {digest.todayPriority && (
          <div className="exec-advisor-digest-block">
            <span className="muted">Today&apos;s Priority</span>
            <strong>{digest.todayPriority}</strong>
          </div>
        )}

        {digest.recoveryEstimateMonthly > 0 && (
          <div className="exec-advisor-digest-block">
            <span className="muted">Estimated Recovery</span>
            <strong className="positive">+{fmt(digest.recoveryEstimateMonthly)}/month</strong>
          </div>
        )}

        {digest.openDecisionsCount > 0 && (
          <div className="exec-advisor-digest-block">
            <span className="muted">Open Decision</span>
            <strong>
              {digest.openDecisionsCount} Ready for Approval
            </strong>
          </div>
        )}
      </div>
    </section>
  );
}
