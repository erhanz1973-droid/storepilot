export default function DecisionsLoading() {
  return (
    <div className="analytics-loading" aria-busy="true" aria-label="Loading decisions">
      <div className="analytics-loading-header">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-subtitle" />
      </div>
      <div className="card skeleton-card skeleton-panel" style={{ marginBottom: 16 }} />
      <div className="stack">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card skeleton-card skeleton-panel" />
        ))}
      </div>
    </div>
  );
}
