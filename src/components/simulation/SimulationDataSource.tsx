type Props = {
  compact?: boolean;
};

const SOURCE_ITEMS = [
  { ok: true, text: "Generated from StorePilot Simulation Engine" },
  { ok: false, text: "Not connected to Shopify" },
  { ok: false, text: "Not connected to Meta Ads" },
  { ok: false, text: "Not connected to Google Ads" },
] as const;

export function SimulationDataSource({ compact = false }: Props) {
  return (
    <div className={`sim-data-source${compact ? " sim-data-source-compact" : ""}`}>
      <h4 className="sim-data-source-title">Data Source</h4>
      <ul className="sim-data-source-list">
        {SOURCE_ITEMS.map((item) => (
          <li key={item.text}>
            <span className={item.ok ? "sim-source-ok" : "sim-source-off"} aria-hidden>
              {item.ok ? "✓" : "✗"}
            </span>
            {item.text}
          </li>
        ))}
      </ul>
      {!compact ? (
        <p className="sim-data-source-note muted">
          Metrics, campaigns, and recommendations in this view are synthetic. They demonstrate AI
          behavior — they are not live business data.
        </p>
      ) : null}
    </div>
  );
}
