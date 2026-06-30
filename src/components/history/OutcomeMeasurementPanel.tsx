export function OutcomeMeasurementPanel({ hasMeasuredOutcomes }: { hasMeasuredOutcomes: boolean }) {
  return (
    <section className="card outcome-measurement-panel">
      <h3>Outcome Measurement</h3>
      {hasMeasuredOutcomes ? (
        <p className="muted" style={{ margin: 0, lineHeight: 1.55, fontSize: "0.92rem" }}>
          StorePilot compares business performance before and after each approved action using a
          configurable measurement window (7, 14, or 30 days). Once enough data is collected, the
          AI reports actual business impact and recommendation accuracy below.
        </p>
      ) : (
        <>
          <p style={{ margin: "0 0 10px", lineHeight: 1.55, fontSize: "0.92rem" }}>
            StorePilot compares business performance before and after each approved action using a
            configurable measurement window (e.g., 7, 14, or 30 days). Once enough data is
            collected, the AI reports the actual business impact and recommendation accuracy.
          </p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55, fontSize: "0.9rem" }}>
            No recommendations have completed their measurement window yet. Approve and execute your
            first recommendation to begin tracking real business results.{" "}
            <a href="/approvals">Open Approval Center</a>
          </p>
        </>
      )}
    </section>
  );
}
