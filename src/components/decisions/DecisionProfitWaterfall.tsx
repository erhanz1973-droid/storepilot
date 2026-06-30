import type { ProfitWaterfall } from "@/lib/decisions/product-economics";

function formatUsd(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type Props = {
  waterfall: ProfitWaterfall;
};

export function DecisionProfitWaterfall({ waterfall }: Props) {
  const rows: { label: string; amount: number; negative?: boolean; total?: boolean }[] = [
    { label: "Revenue", amount: waterfall.revenue },
    { label: "Product Cost", amount: -waterfall.productCost, negative: true },
    { label: "Advertising", amount: -waterfall.advertising, negative: true },
    { label: "Shipping", amount: -waterfall.shipping, negative: true },
    { label: "Processing Fees", amount: -waterfall.processingFees, negative: true },
    { label: "Net Profit", amount: waterfall.netProfit, total: true },
  ];

  return (
    <div className="decision-card-section" style={{ marginTop: 12 }}>
      <p className="decision-section-label">Profit breakdown (30d estimate)</p>
      <table style={{ width: "100%", fontSize: "0.88rem", borderCollapse: "collapse" }}>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              style={{
                borderTop: row.total ? "1px solid rgba(255,255,255,0.12)" : undefined,
                fontWeight: row.total ? 600 : 400,
              }}
            >
              <td style={{ padding: "6px 0" }}>{row.label}</td>
              <td
                style={{
                  padding: "6px 0",
                  textAlign: "right",
                  color: row.negative ? "#f87171" : row.total ? "#22c55e" : undefined,
                }}
              >
                {row.negative ? "−" : ""}
                {formatUsd(Math.abs(row.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
