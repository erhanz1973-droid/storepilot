import type { AdRow } from "@/lib/advertising/types";
import { formatRoas } from "@/lib/attribution/format-roas";
import { CreativePreviewThumb } from "./CreativePreviewThumb";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function IndividualAdsTable({ ads }: { ads: AdRow[] }) {
  if (ads.length === 0) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Individual Ads</h2>
        <p className="muted" style={{ margin: 0 }}>No ad-level data available yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Individual Ads</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
        Creative-level intelligence with preview — evaluate every ad before making changes.
      </p>
      <div className="adv-table-wrap">
        <table className="adv-data-table">
          <thead>
            <tr>
              <th>Preview</th>
              <th>Ad</th>
              <th>Spend</th>
              <th>CTR</th>
              <th>ROAS</th>
              <th>Creative Score</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {ads.slice(0, 20).map((a) => (
              <tr key={a.id}>
                <td>
                  <CreativePreviewThumb type={a.previewType} size="sm" />
                </td>
                <td>
                  <strong>{a.name}</strong>
                  <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>
                    {a.campaignName}
                  </span>
                </td>
                <td>{fmt(a.spend)}</td>
                <td>{a.ctr}%</td>
                <td>{formatRoas(a.roas)}</td>
                <td>
                  <span className={`adv-creative-score ${a.creativeScore >= 75 ? "high" : a.creativeScore < 35 ? "low" : ""}`}>
                    {a.creativeScore}
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
