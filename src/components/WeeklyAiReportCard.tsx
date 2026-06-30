import type { WeeklyAiReport } from "@/lib/types";

export function WeeklyAiReportCard({ report }: { report: WeeklyAiReport }) {
  return (
    <div className="card weekly-report-card">
      <h3>Weekly AI Report</h3>
      <p className="muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>
        {report.weekStart} – {report.weekEnd}
      </p>

      {(report.revenue30d != null || report.profit30d != null) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          {report.revenue30d != null && (
            <div>
              <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>
                Revenue (30d)
              </p>
              <p style={{ margin: "4px 0 0", fontWeight: 700 }}>
                ${Math.round(report.revenue30d).toLocaleString()}
              </p>
            </div>
          )}
          {report.profit30d != null && (
            <div>
              <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>
                Profit (30d)
              </p>
              <p style={{ margin: "4px 0 0", fontWeight: 700 }}>
                ${Math.round(report.profit30d).toLocaleString()}
              </p>
            </div>
          )}
          {report.roas30d != null && (
            <div>
              <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>
                ROAS
              </p>
              <p style={{ margin: "4px 0 0", fontWeight: 700 }}>
                {report.roas30d.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}

      {report.executiveSummary && report.executiveSummary.length > 0 && (
        <ul className="weekly-report-list" style={{ marginTop: 16 }}>
          {report.executiveSummary.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      <ul className="weekly-report-list" style={{ marginTop: 16 }}>
        <li>
          Recommendations completed: <strong>{report.recommendationsCompleted}</strong>
        </li>
        <li>
          Recommendations measured: <strong>{report.recommendationsMeasured}</strong>
        </li>
        <li>
          Overall prediction accuracy: <strong>{report.overallAccuracy}%</strong>
        </li>
        {report.bestPerforming && (
          <li>
            Best performing: <strong>{report.bestPerforming.title}</strong> (
            {report.bestPerforming.accuracy}% accuracy)
          </li>
        )}
        {report.worstPrediction && (
          <li>
            Worst prediction: <strong>{report.worstPrediction.title}</strong> (
            {report.worstPrediction.accuracy}% accuracy)
          </li>
        )}
        {report.topRecommendationNextWeek && (
          <li>
            Top recommendation next week:{" "}
            <strong>{report.topRecommendationNextWeek}</strong>
          </li>
        )}
      </ul>

      {report.bestProducts && report.bestProducts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p className="muted" style={{ marginBottom: 8, fontWeight: 500, fontSize: "0.85rem" }}>
            Best performing products
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.875rem" }}>
            {report.bestProducts.map((p, i) => (
              <li key={`best-product-${i}-${p.title}`}>
                {p.title} — ${p.profit.toLocaleString()} profit
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.worstCampaigns && report.worstCampaigns.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p className="muted" style={{ marginBottom: 8, fontWeight: 500, fontSize: "0.85rem" }}>
            Worst performing campaigns
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.875rem" }}>
            {report.worstCampaigns.map((c, i) => (
              <li key={c.id ?? `worst-campaign-${i}-${c.name}-${c.roas}`}>
                {c.name} — ROAS {c.roas}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.accuracyTrend.length >= 2 && (
        <div style={{ marginTop: 16 }}>
          <p className="muted" style={{ marginBottom: 8, fontWeight: 500, fontSize: "0.85rem" }}>
            Accuracy trend
          </p>
          <div className="accuracy-trend">
            {report.accuracyTrend.map((point) => (
              <div key={point.week} className="accuracy-trend-bar" title={`${point.week}: ${point.accuracy}%`}>
                <div
                  className="accuracy-trend-fill"
                  style={{ height: `${Math.max(8, point.accuracy)}%` }}
                />
                <span className="accuracy-trend-label">{point.accuracy}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
