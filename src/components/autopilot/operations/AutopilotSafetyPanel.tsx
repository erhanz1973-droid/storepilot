export function AutopilotSafetyPanel({ guarantees }: { guarantees: string[] }) {
  return (
    <section className="card autopilot-ops-safety-card">
      <h3>What StorePilot will never do automatically</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 12, fontSize: "0.9rem" }}>
        Every automation prepares recommendations for your review. These actions are always blocked
        without explicit approval.
      </p>
      <ul className="autopilot-ops-safety-list">
        {guarantees.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
