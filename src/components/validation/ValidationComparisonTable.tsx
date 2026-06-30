import type { MetricComparisonRow } from "@/lib/validation/framework/types";

type Props = {
  rows: MetricComparisonRow[];
};

function severityColor(severity: string): string {
  if (severity === "green") return "#22c55e";
  if (severity === "yellow") return "#eab308";
  return "#ef4444";
}

function statusLabel(status: string): string {
  return status.toUpperCase();
}

export function ValidationComparisonTable({ rows }: Props) {
  return (
    <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
      <thead>
        <tr className="muted">
          <th style={{ textAlign: "left", padding: "6px 8px 6px 0" }}>Metric</th>
          <th style={{ textAlign: "right", padding: 6 }}>Dashboard</th>
          <th style={{ textAlign: "right", padding: 6 }}>API</th>
          <th style={{ textAlign: "right", padding: 6 }}>Difference</th>
          <th style={{ textAlign: "center", padding: 6 }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.metric}>
            <td style={{ padding: "8px 8px 8px 0", fontWeight: 500 }}>{row.metric}</td>
            <td style={{ textAlign: "right", padding: 8 }}>{row.dashboard}</td>
            <td style={{ textAlign: "right", padding: 8 }}>{row.api}</td>
            <td
              style={{
                textAlign: "right",
                padding: 8,
                color: severityColor(row.severity),
                fontWeight: 600,
              }}
            >
              {row.differencePct === null ? "—" : `${row.differencePct}%`}
            </td>
            <td style={{ textAlign: "center", padding: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: severityColor(row.severity),
                  background: `${severityColor(row.severity)}18`,
                }}
              >
                {statusLabel(row.status)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
