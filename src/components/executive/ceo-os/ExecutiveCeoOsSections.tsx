import type {
  ExecutiveAccountabilityItem,
  ExecutiveDecisionModelAccuracy,
  ExecutiveMode,
  ExecutiveNotes,
  ExecutivePlannedDecision,
  ExecutivePlannedSection,
  ExecutiveRiskStory,
} from "@/lib/analytics/build-executive-ceo-os";
import type { ExecutiveAiLiveStatus } from "@/lib/analytics/executive-ai-behavior";

const TYPE_LABEL = {
  rejected: "Waiting cost",
  approved: "Tracking",
  pending: "Pending",
  measuring: "Measuring",
} as const;

const TYPE_BADGE = {
  rejected: "exec-ceo-chip-warn",
  approved: "exec-ceo-chip-ok",
  pending: "exec-ceo-chip-info",
  measuring: "exec-ceo-chip-info",
} as const;

const MODE_CHIP: Record<ExecutiveMode, { label: string; className: string }> = {
  NO_ACTION: { label: "Stable", className: "exec-ceo-chip-ok" },
  OBSERVE: { label: "Building Evidence", className: "exec-ceo-chip-info" },
  ACTION_REQUIRED: { label: "Action", className: "exec-ceo-chip-warn" },
  CRITICAL: { label: "Critical", className: "exec-ceo-chip-warn" },
};

export function ExecutiveAccountabilityCard({ items }: { items: ExecutiveAccountabilityItem[] }) {
  return (
    <section className="card exec-ceo-secondary-card exec-accountability">
      <div className="exec-ceo-secondary-head">
        <h3>Memory</h3>
        <span className="exec-ceo-chip exec-ceo-chip-muted">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="muted exec-ceo-card-fill">No prior decisions recorded yet.</p>
      ) : (
        <ul className="exec-ceo-compact-list">
          {items.slice(0, 3).map((item) => (
            <li key={item.id} className="exec-ceo-compact-row">
              <span className={`exec-ceo-chip ${TYPE_BADGE[item.type]}`}>
                {TYPE_LABEL[item.type]}
              </span>
              <div className="exec-ceo-compact-body">
                <strong>{item.title}</strong>
                {item.metrics[0] ? (
                  <span className="muted">
                    {item.metrics[0].label}: {item.metrics[0].value}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ExecutiveRiskStoryCard({ story }: { story: ExecutiveRiskStory }) {
  const chip = MODE_CHIP[story.mode];

  return (
    <section
      className={`card exec-ceo-secondary-card exec-risk-story exec-risk-story-${story.mode.toLowerCase()}`}
    >
      <div className="exec-ceo-secondary-head">
        <h3>Story</h3>
        <span className={`exec-ceo-chip ${chip.className}`}>{chip.label}</span>
      </div>
      <p className="exec-ceo-story-headline muted">{story.headline}</p>
      <dl className="exec-ceo-story-scan">
        {story.sections.map((section, i) => (
          <div key={`${section.label}-${i}`}>
            <div
              className={`exec-ceo-story-scan-row${
                section.amountFormatted && story.showFinancialLeakage ? " impact" : ""
              }`}
            >
              <dt>{section.label}</dt>
              <dd
                className={
                  section.amountFormatted && story.showFinancialLeakage ? "positive" : undefined
                }
              >
                {section.body}
              </dd>
            </div>
            {i < story.sections.length - 1 && story.showFinancialLeakage ? (
              <span className="exec-ceo-story-arrow" aria-hidden>
                ↓
              </span>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ExecutivePlannedDecisionsCard({
  items,
  section,
}: {
  items: ExecutivePlannedDecision[];
  section: ExecutivePlannedSection;
}) {
  return (
    <section className="card exec-ceo-secondary-card exec-planned-decisions exec-ceo-planned-wide">
      <div className="exec-ceo-secondary-head">
        <h3>{section.title}</h3>
        <span className="exec-ceo-chip exec-ceo-chip-muted">{section.chip}</span>
      </div>
      {section.intro ? <p className="muted exec-ceo-planned-intro">{section.intro}</p> : null}
      {items.length === 0 ? (
        <p className="muted exec-ceo-card-fill">{section.emptyMessage}</p>
      ) : (
        <ul className="exec-ceo-planned-list">
          {items.slice(0, 3).map((item) => (
            <li key={item.rank} className="exec-ceo-planned-item">
              <div className="exec-ceo-planned-main">
                <strong>{item.title}</strong>
                <span className="exec-ceo-chip exec-ceo-chip-muted">{item.plannedLabel}</span>
              </div>
              <span
                className={`exec-ceo-planned-impact${
                  section.kind === "optimization" ? "" : " positive"
                }`}
              >
                {item.impactLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ExecutiveNotesCard({
  notes,
  onShowFull,
}: {
  notes: ExecutiveNotes;
  onShowFull: () => void;
}) {
  return (
    <section className="card exec-ceo-secondary-card exec-ceo-notes">
      <div className="exec-ceo-secondary-head">
        <h3>Executive notes</h3>
        <span className="exec-ceo-chip exec-ceo-chip-info">Today</span>
      </div>
      <p className="exec-ceo-notes-copy">{notes.headline}</p>
      <p className="muted exec-ceo-notes-copy">{notes.body}</p>
      <p className="muted exec-ceo-notes-copy">
        Full dashboards and module breakdowns stay available when you need depth — not before.
      </p>
      <button type="button" className="btn btn-ghost exec-advisor-mode-expand" onClick={onShowFull}>
        Open full analysis →
      </button>
    </section>
  );
}

/** Internal trust metric — Decision Validation layer (not primary merchant CTA). */
export function ExecutiveDecisionModelAccuracyCard({
  accuracy,
}: {
  accuracy: ExecutiveDecisionModelAccuracy | null;
}) {
  return (
    <section
      className="card exec-ceo-secondary-card exec-decision-model-accuracy"
      aria-label="Internal decision model accuracy"
    >
      <div className="exec-ceo-secondary-head">
        <h3>Decision Model Accuracy</h3>
        <span className="exec-ceo-chip exec-ceo-chip-muted">Internal</span>
      </div>
      {!accuracy || accuracy.sampleSize === 0 ? (
        <p className="muted exec-ceo-card-fill">
          Awaiting validated outcomes. Accuracy appears after recommendations are measured
          against real results.
        </p>
      ) : (
        <>
          <p className="exec-decision-accuracy-value">{accuracy.accuracyPct}%</p>
          <p className="muted exec-ceo-notes-copy">{accuracy.windowLabel}</p>
          <ul className="exec-ceo-monitor-list">
            <li className="exec-ceo-monitor-row">
              <span className="exec-ceo-monitor-label">Correct</span>
              <strong>{accuracy.correctPct}%</strong>
            </li>
            <li className="exec-ceo-monitor-row">
              <span className="exec-ceo-monitor-label">Neutral</span>
              <strong>{accuracy.neutralPct}%</strong>
            </li>
            <li className="exec-ceo-monitor-row">
              <span className="exec-ceo-monitor-label">Negative</span>
              <strong>{accuracy.negativePct}%</strong>
            </li>
          </ul>
        </>
      )}
    </section>
  );
}

function domainIcon(status: ExecutiveAiLiveStatus["domains"][0]["status"]): string {
  if (status === "watching") return "✓";
  if (status === "analyzing") return "…";
  return "○";
}

export function ExecutiveWatchStrip({ status }: { status: ExecutiveAiLiveStatus }) {
  const running = status.state === "analyzing";

  return (
    <div className="card exec-ceo-secondary-card exec-watch-strip" role="status">
      <div className="exec-ceo-secondary-head">
        <h3>Monitoring</h3>
        {running ? (
          <span className="exec-ceo-chip exec-ceo-chip-info">Running…</span>
        ) : (
          <span className="exec-watch-pulse" aria-hidden />
        )}
      </div>
      <ul className="exec-ceo-monitor-list">
        {status.domains.map((domain) => (
          <li key={domain.id} className={`exec-ceo-monitor-row ${domain.status}`}>
            <span className="exec-ceo-monitor-icon" aria-hidden>
              {domainIcon(domain.status)}
            </span>
            <span className="exec-ceo-monitor-label">{domain.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
