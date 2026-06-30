import type { IntegrationStatusRow } from "@/lib/services/integrations";

const CATEGORY_LABEL: Record<IntegrationStatusRow["category"], string> = {
  ads: "Advertising",
  email: "Email & SMS",
  analytics: "Analytics",
  inventory: "Inventory",
  finance: "Finance",
  operations: "Operations",
};

export function IntegrationGrid({ integrations }: { integrations: IntegrationStatusRow[] }) {
  const byCategory = integrations.reduce<Record<string, IntegrationStatusRow[]>>((acc, row) => {
    const key = row.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  return (
    <div className="stack" style={{ gap: 24 }}>
      {Object.entries(byCategory).map(([category, rows]) => (
        <section key={category}>
          <h3 style={{ marginBottom: 12 }}>{CATEGORY_LABEL[category as IntegrationStatusRow["category"]] ?? category}</h3>
          <div className="grid-2">
            {rows.map((row) => (
              <div className="card" key={row.id}>
                <div className="breakdown-row" style={{ marginBottom: 8 }}>
                  <strong>{row.label}</strong>
                  <span
                    className={`confidence-level-pill ${
                      row.connected ? "confidence-high" : row.configured ? "confidence-medium" : "confidence-low"
                    }`}
                  >
                    {row.connected ? "Connected" : row.configured ? "Configured" : "Not connected"}
                  </span>
                </div>
                <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.875rem" }}>
                  {row.description}
                </p>
                {row.dataPreview && (
                  <p style={{ margin: "0 0 8px", fontSize: "0.875rem" }}>
                    <strong>Live:</strong> {row.dataPreview}
                  </p>
                )}
                <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                  {row.dataPoints.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
