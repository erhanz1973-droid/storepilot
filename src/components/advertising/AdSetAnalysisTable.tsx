import type { AdSetRow } from "@/lib/advertising/types";
import { HEALTH_TIER_LABELS } from "@/lib/advertising/types";
import { formatRoas } from "@/lib/attribution/format-roas";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function AdSetAnalysisTable({ adSets }: { adSets: AdSetRow[] }) {
  if (adSets.length === 0) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Ad Set Analysis</h2>
        <p className="muted" style={{ margin: 0 }}>No ad set data available yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Ad Set Analysis</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
        Identify weak ad sets before making campaign-wide changes.
      </p>
      <div className="adv-table-wrap">
        <table className="adv-data-table">
          <thead>
            <tr>
              <th>Ad Set</th>
              <th>Spend</th>
              <th>Revenue</th>
              <th>ROAS</th>
              <th>CPA</th>
              <th>CTR</th>
              <th>Conv Rate</th>
              <th>Frequency</th>
              <th>Health</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {adSets.slice(0, 20).map((a) => (
              <tr key={a.id}>
                <td><strong>{a.name}</strong></td>
                <td>{fmt(a.spend)}</td>
                <td>{fmt(a.revenue)}</td>
                <td>{formatRoas(a.roas)}</td>
                <td>{fmt(a.cpa)}</td>
                <td>{a.ctr}%</td>
                <td>{a.conversionRate}%</td>
                <td>{a.frequency}</td>
                <td>
                  <span className={`adv-health-pill adv-tier-${a.healthTier}`}>{a.healthScore}</span>
                  <span className="muted" style={{ fontSize: "0.7rem", display: "block" }}>
                    {HEALTH_TIER_LABELS[a.healthTier]}
                  </span>
                </td>
                <td><span className="adv-rec-pill">{a.recommendation}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
