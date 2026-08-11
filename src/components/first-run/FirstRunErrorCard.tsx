"use client";

export function FirstRunErrorCard({
  message,
  onRetry,
  onConnections,
}: {
  message: string;
  onRetry: () => void;
  onConnections: () => void;
}) {
  return (
    <section className="card first-run-empty" role="alert" aria-labelledby="first-run-error-title">
      <p className="first-run-eyebrow">Analysis interrupted</p>
      <h1 id="first-run-error-title" style={{ marginTop: 6 }}>
        We couldn&apos;t finish your first insight
      </h1>
      <p>{message}</p>
      <div className="first-run-decision-actions">
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Retry analysis
        </button>
        <button type="button" className="btn btn-secondary" onClick={onConnections}>
          Open Connections
        </button>
      </div>
    </section>
  );
}
