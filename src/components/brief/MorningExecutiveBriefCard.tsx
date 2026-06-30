import type { MorningExecutiveBrief } from "@/lib/brief/morning-brief";

export function MorningExecutiveBriefCard({ brief }: { brief: MorningExecutiveBrief }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Morning Executive Brief</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
            ~{brief.readingTimeSec}s read · Generated{" "}
            {new Date(brief.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{brief.storeHealth.score}</div>
          <div className="muted" style={{ fontSize: "0.75rem" }}>
            Store Health
            {brief.storeHealth.delta != null && (
              <span style={{ marginLeft: 4 }}>
                ({brief.storeHealth.delta > 0 ? "+" : ""}
                {brief.storeHealth.delta})
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16, gap: 16 }}>
        {brief.sections.map((section) => (
          <div key={section.title}>
            <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600 }}>
              {section.title}
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.875rem" }}>
              {section.lines.map((line) => (
                <li key={line} style={{ marginBottom: 4 }}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {brief.recommendationOfTheDay && (
        <div
          className="revenue-impact-panel"
          style={{ marginTop: 16, padding: 12, borderRadius: 8 }}
        >
          <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.8rem", fontWeight: 600 }}>
            Recommendation of the Day
          </p>
          <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{brief.recommendationOfTheDay.title}</p>
          <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
            {brief.recommendationOfTheDay.why} · Confidence {brief.recommendationOfTheDay.confidencePct}% ·{" "}
            {brief.recommendationOfTheDay.estimatedImpactLabel}
          </p>
        </div>
      )}
    </div>
  );
}
