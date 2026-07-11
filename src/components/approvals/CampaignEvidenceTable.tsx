import type { CampaignEvidenceRow } from "@/lib/approvals/decision-center-types";
import { MetricInfo } from "./MetricInfo";

const TREND_ICON = { up: "↑", down: "↓", flat: "→" } as const;

export function CampaignEvidenceTable({ rows }: { rows: CampaignEvidenceRow[] }) {
  if (rows.length === 0) return null;

  const hasClicks = rows.some((r) => r.clicks);
  const hasCtr = rows.some((r) => r.ctr);
  const hasConversion = rows.some((r) => r.conversionRate);
  const hasBudget = rows.some((r) => r.budget);

  return (
    <section className="decision-evidence-table-section">
      <div className="decision-evidence-table-wrap">
        <table className="decision-evidence-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Spend</th>
              <th>Revenue</th>
              <th>Profit</th>
              <th>Margin</th>
              <th>
                ROAS <MetricInfo metricKey="roas" />
              </th>
              <th>
                CPA <MetricInfo metricKey="cpa" />
              </th>
              {hasConversion && <th>Conv. Rate</th>}
              {hasClicks && <th>Clicks</th>}
              {hasCtr && <th>CTR</th>}
              {hasBudget && <th>Budget</th>}
              <th>Status</th>
              <th>Trend</th>
              <th>AI Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.campaign}>
                <td>{row.campaign}</td>
                <td>{row.spend}</td>
                <td>{row.revenue}</td>
                <td>{row.profit ?? "—"}</td>
                <td>{row.profitMargin ?? "—"}</td>
                <td>{row.roas}</td>
                <td>{row.cpa ?? "—"}</td>
                {hasConversion && <td>{row.conversionRate ?? "—"}</td>}
                {hasClicks && <td>{row.clicks ?? "—"}</td>}
                {hasCtr && <td>{row.ctr ?? "—"}</td>}
                {hasBudget && <td>{row.budget ?? "—"}</td>}
                <td>{row.status ?? "—"}</td>
                <td className={`decision-trend-${row.trend}`}>{TREND_ICON[row.trend]}</td>
                <td>
                  <span className="decision-evidence-decision">{row.decision}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
