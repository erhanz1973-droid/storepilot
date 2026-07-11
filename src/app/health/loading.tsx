export default function HealthLoading() {
  return (
    <div className="analytics-loading" aria-busy="true" aria-label="Loading business health">
      <div className="analytics-loading-header">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-subtitle" />
      </div>
      <div className="analytics-metric-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="analytics-metric-card skeleton-card">
            <div className="skeleton skeleton-label" />
            <div className="skeleton skeleton-value" />
          </div>
        ))}
      </div>
      <div className="card skeleton-card skeleton-panel" style={{ marginTop: 16 }} />
    </div>
  );
}
