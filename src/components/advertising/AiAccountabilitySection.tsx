import type {
  AccountabilityItem,
  CrossModuleAlert,
  LearningInsight,
  PredictionTrackRecord,
} from "@/lib/advertising/types";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const TYPE_LABEL = {
  rejected: "Not approved — cost of inaction",
  approved: "Approved — measured results",
  pending: "Awaiting your decision",
} as const;

const TYPE_CLASS = {
  rejected: "adv-accountability-rejected",
  approved: "adv-accountability-approved",
  pending: "adv-accountability-pending",
} as const;

export function AiAccountabilitySection({ items }: { items: AccountabilityItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="card adv-accountability-section">
      <h2 style={{ marginTop: 0 }}>AI accountability — I remember my advice</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
        Tracking what I recommended, what you decided, and what happened next.
      </p>
      <div className="adv-accountability-list">
        {items.map((item) => (
          <article key={item.id} className={`adv-accountability-card ${TYPE_CLASS[item.type]}`}>
            <span className="adv-accountability-type">{TYPE_LABEL[item.type]}</span>
            <strong>{item.recommendationTitle}</strong>
            {item.campaignName && (
              <span className="muted" style={{ fontSize: "0.8rem" }}>{item.campaignName}</span>
            )}
            <p className="adv-accountability-narrative">{item.narrative}</p>
            {item.metrics.length > 0 && (
              <dl className="adv-accountability-metrics">
                {item.metrics.map((m) => (
                  <div key={m.label}>
                    <dt>{m.label}</dt>
                    <dd>{m.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {item.predictionAccuracy != null && (
              <p className="adv-accountability-accuracy">
                Prediction accuracy: <strong>{item.predictionAccuracy}%</strong>
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

export function LearningPersonalizationPanel({ insight }: { insight: LearningInsight | null }) {
  if (!insight) return null;

  return (
    <div className="card adv-learning-panel">
      <h3 style={{ marginTop: 0 }}>What I&apos;ve learned about you</h3>
      <p className="adv-learning-headline">{insight.headline}</p>
      <p style={{ margin: "8px 0" }}>{insight.detail}</p>
      <p className="adv-learning-personalization">{insight.personalization}</p>
    </div>
  );
}

export function CrossModuleIntelligencePanel({ alerts }: { alerts: CrossModuleAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="card adv-cross-module">
      <h3 style={{ marginTop: 0 }}>Cross-module intelligence</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
        Advertising decisions checked against Inventory, Finance, and Fulfillment.
      </p>
      <ul className="adv-cross-module-list">
        {alerts.map((a, i) => (
          <li key={`${a.module}-${i}`} className={`adv-cross-module-item adv-cross-${a.severity}`}>
            <span className="adv-cross-module-badge">{a.module}</span>
            <span>{a.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PredictionTrackRecordPanel({ record }: { record: PredictionTrackRecord }) {
  return (
    <div className="card adv-prediction-record">
      <h3 style={{ marginTop: 0 }}>Prediction vs. reality</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>{record.summary}</p>
      <p className="adv-prediction-overall">
        Overall track record: <strong>{record.overallAccuracyPct}%</strong> prediction accuracy
      </p>
      <div className="adv-prediction-items">
        {record.items.map((item) => (
          <article key={item.title} className={`adv-prediction-item adv-prediction-${item.status}`}>
            <strong>{item.title}</strong>
            <dl className="adv-prediction-metrics">
              <div>
                <dt>Expected</dt>
                <dd>+{fmt(item.expectedImprovement)}/mo</dd>
              </div>
              <div>
                <dt>Actual</dt>
                <dd className="positive">+{fmt(item.actualImprovement)}/mo</dd>
              </div>
              <div>
                <dt>Accuracy</dt>
                <dd>{item.predictionAccuracy}%</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
