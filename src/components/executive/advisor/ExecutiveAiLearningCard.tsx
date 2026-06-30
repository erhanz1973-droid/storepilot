import type { AiLearningStatus } from "@/lib/analytics/executive-advisor";
import type { AiRecentLearning } from "@/lib/analytics/executive-ai-behavior";

export function ExecutiveAiLearningCard({
  learning,
  recentLearnings = [],
}: {
  learning: AiLearningStatus;
  recentLearnings?: AiRecentLearning[];
}) {
  return (
    <section className="exec-advisor-learning card">
      <h2 className="exec-advisor-section-title">AI Business Understanding</h2>
      <div className="exec-advisor-learning-score">
        <span className="exec-advisor-learning-pct">{learning.understandingPct}%</span>
        <p className="muted exec-advisor-learning-note">{learning.accuracyNote}</p>
      </div>

      {recentLearnings.length > 0 && (
        <div className="exec-advisor-learning-group">
          <p className="exec-advisor-learning-label">AI learned recently</p>
          <ul className="exec-advisor-learned-insights">
            {recentLearnings.map((l) => (
              <li key={l.id}>🧠 {l.insight}</li>
            ))}
          </ul>
        </div>
      )}

      {learning.connectedSources.length > 0 && (
        <div className="exec-advisor-learning-group">
          <p className="exec-advisor-learning-label">Connected Sources</p>
          <ul className="exec-advisor-learning-sources connected">
            {learning.connectedSources.map((s) => (
              <li key={s}>✓ {s}</li>
            ))}
          </ul>
        </div>
      )}

      {learning.missingSources.length > 0 && (
        <div className="exec-advisor-learning-group">
          <p className="exec-advisor-learning-label">Missing</p>
          <ul className="exec-advisor-learning-sources missing">
            {learning.missingSources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
