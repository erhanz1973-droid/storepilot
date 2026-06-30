export function FunnelPreviewSection({ stepLabels }: { stepLabels: string[] }) {
  return (
    <div className="card funnel-preview-section">
      <h3 style={{ margin: "0 0 4px" }}>Funnel Preview</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
        Available after connecting GA4.
      </p>
      <div className="funnel-preview-steps">
        {stepLabels.map((label, i) => (
          <div key={label} className="funnel-preview-step">
            <div className="funnel-preview-bar locked">
              <span className="funnel-preview-lock" aria-hidden>🔒</span>
              <span>{label}</span>
            </div>
            {i < stepLabels.length - 1 && <span className="funnel-preview-arrow">↓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
