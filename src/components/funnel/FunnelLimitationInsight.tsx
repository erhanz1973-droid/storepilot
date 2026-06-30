export function FunnelLimitationInsight({
  message,
  unlockCapabilities,
}: {
  message: string;
  unlockCapabilities: string[];
}) {
  return (
    <div className="card funnel-limitation-insight">
      <h3 style={{ margin: "0 0 12px" }}>AI Recommendations</h3>
      <p style={{ margin: "0 0 16px", lineHeight: 1.55 }}>{message}</p>
      <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem", fontWeight: 600 }}>
        After connecting GA4, StorePilot will identify:
      </p>
      <ul className="funnel-unlock-list">
        {unlockCapabilities.map((cap) => (
          <li key={cap}>{cap}</li>
        ))}
      </ul>
    </div>
  );
}
