export default function AnalyticsLoading() {
  return (
    <div className="analytics-loading" aria-busy="true" aria-label="Loading dashboard">
      <div className="analytics-loading-header">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-subtitle" />
      </div>
      <div className="analytics-metric-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="analytics-metric-card skeleton-card">
            <div className="skeleton skeleton-label" />
            <div className="skeleton skeleton-value" />
          </div>
        ))}
      </div>
      <div className="analytics-loading-panels">
        <div className="card skeleton-card skeleton-panel" />
        <div className="card skeleton-card skeleton-panel" />
      </div>
    </div>
  );
}
