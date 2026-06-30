import type { ValidationSnapshot } from "@/lib/validation/framework/types";

type Props = {
  title: string;
  snapshot: ValidationSnapshot;
};

function row(label: string, value: string | number) {
  return (
    <div className="breakdown-row" style={{ marginBottom: 4 }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ValidationSnapshotCard({ title, snapshot }: Props) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.15)",
      }}
    >
      <h4 style={{ margin: "0 0 10px", fontSize: "0.9rem" }}>{title}</h4>
      {row("Spend", snapshot.spend)}
      {row("ROAS", snapshot.roas)}
      {row("Revenue", snapshot.revenue)}
      {row("Purchases", snapshot.purchases)}
      {row("Campaigns", snapshot.campaigns)}
      {row("Currency", snapshot.currency)}
      {row("Date Range", snapshot.dateRange)}
    </div>
  );
}
