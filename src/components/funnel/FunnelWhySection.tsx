export function FunnelWhySection() {
  const available = [
    "Revenue",
    "Orders",
    "Advertising Performance",
    "Product Profitability",
  ];
  const required = ["Google Analytics 4"];

  return (
    <div className="card funnel-why-section">
      <h3 style={{ margin: "0 0 12px" }}>Why Funnel Analytics Need GA4</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.9rem" }}>
        StorePilot can already calculate:
      </p>
      <ul className="funnel-check-list">
        {available.map((item) => (
          <li key={item}>
            <span className="funnel-check">✓</span> {item}
          </li>
        ))}
      </ul>
      <p className="muted" style={{ margin: "16px 0 12px", fontSize: "0.9rem" }}>
        For visitor behavior analysis we require:
      </p>
      <ul className="funnel-require-list">
        {required.map((item) => (
          <li key={item}>
            <strong>{item}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
