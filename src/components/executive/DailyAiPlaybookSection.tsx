import Link from "next/link";
import type { DailyAiPlaybook } from "@/lib/analytics/ai-daily-playbook";
import { EXECUTIVE_MODULES, EXECUTIVE_STORY_FLOW } from "@/lib/analytics/executive-modules";

export function DailyAiPlaybookSection({
  playbook,
  showStoryFlow = false,
  compact = false,
}: {
  playbook: DailyAiPlaybook;
  showStoryFlow?: boolean;
  compact?: boolean;
}) {
  if (playbook.items.length === 0) return null;

  const top3 = playbook.items.slice(0, 3);
  const top3Hrefs = top3.map((i) => i.approvalHref).join(",");

  return (
    <section className={`card daily-playbook ${compact ? "daily-playbook-compact" : ""}`}>
      <div className="daily-playbook-head">
        <div>
          <h3 style={{ marginTop: 0 }}>{playbook.title}</h3>
          <p className="muted daily-playbook-sub">{playbook.subtitle}</p>
        </div>
        {playbook.totalRecoverableMonthly > 0 && (
          <div className="daily-playbook-total">
            <span className="muted">Total recoverable today</span>
            <strong className="positive">
              +$
              {playbook.totalRecoverableMonthly.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
              /month
            </strong>
          </div>
        )}
      </div>

      {showStoryFlow && (
        <div className="exec-story-flow" aria-label="Executive story flow">
          {EXECUTIVE_STORY_FLOW.map((id, i) => (
            <span key={id} className="exec-story-step">
              <Link href={EXECUTIVE_MODULES[id].href}>{EXECUTIVE_MODULES[id].role}</Link>
              {i < EXECUTIVE_STORY_FLOW.length - 1 && (
                <span className="exec-story-arrow" aria-hidden>
                  ↓
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <ol className="daily-playbook-list">
        {playbook.items.map((item) => (
          <li key={item.id} className="daily-playbook-item">
            <span className="daily-playbook-rank">{item.rank}</span>
            <div className="daily-playbook-body">
              <div className="daily-playbook-item-head">
                <Link href={item.moduleHref} className="daily-playbook-module">
                  {item.roleLabel} · {EXECUTIVE_MODULES[item.module].label}
                </Link>
                <span className="daily-playbook-confidence">{item.confidence} confidence</span>
              </div>
              <strong className="daily-playbook-title">{item.title}</strong>
              <span className="daily-playbook-impact">{item.impactLabel}</span>
            </div>
            <Link href={item.approvalHref} className="btn btn-secondary btn-sm daily-playbook-review">
              Review
            </Link>
          </li>
        ))}
      </ol>

      <div className="daily-playbook-actions">
        <Link href="/approvals" className="btn btn-primary btn-sm">
          Approve All
        </Link>
        <Link
          href={`/approvals?batch=top3&playbooks=${encodeURIComponent(top3Hrefs)}`}
          className="btn btn-secondary btn-sm"
        >
          Approve Top 3
        </Link>
        <Link href="/approvals" className="btn btn-secondary btn-sm">
          Review Individually
        </Link>
      </div>
    </section>
  );
}
