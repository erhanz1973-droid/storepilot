const PREVIEWS = [
  {
    id: "health",
    title: "Store Health Score",
    caption: "One score for inventory, ads, conversion, and profit.",
    frame: "health" as const,
  },
  {
    id: "recommendations",
    title: "AI Recommendations",
    caption: "What to do next, with impact and time required.",
    frame: "recommendations" as const,
  },
  {
    id: "profit",
    title: "Product Profitability",
    caption: "Which products actually make money.",
    frame: "profit" as const,
  },
  {
    id: "ads",
    title: "Advertising Performance",
    caption: "Meta and Google spend next to real store results.",
    frame: "ads" as const,
  },
  {
    id: "dashboard",
    title: "Dashboard",
    caption: "Sales, profit, and the next action in one place.",
    frame: "dashboard" as const,
  },
] as const;

function HealthFrame() {
  return (
    <div className="marketing-preview-ui" aria-hidden="true">
      <div className="marketing-preview-ui-head">Store Health</div>
      <div className="marketing-preview-health">
        <div className="health-ring marketing-preview-ring">
          <span className="health-ring-value">74</span>
          <span className="health-ring-max">/100</span>
        </div>
        <div>
          <p className="marketing-preview-status">Healthy</p>
          <ul className="marketing-preview-factors">
            <li>
              <span>Inventory</span>
              <span>82</span>
            </li>
            <li>
              <span>Profitability</span>
              <span>71</span>
            </li>
            <li>
              <span>Ads</span>
              <span>64</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function RecommendationsFrame() {
  return (
    <div className="marketing-preview-ui" aria-hidden="true">
      <p className="marketing-preview-eyebrow">If You Only Do One Thing Today</p>
      <p className="marketing-preview-rec-title">Pause the campaign that is losing money</p>
      <div className="marketing-preview-metrics">
        <div>
          <span>Impact</span>
          <strong>High</strong>
        </div>
        <div>
          <span>Time</span>
          <strong>10 min</strong>
        </div>
        <div>
          <span>Difficulty</span>
          <strong>Low</strong>
        </div>
      </div>
      <div className="marketing-preview-actions">
        <span className="marketing-preview-chip">Approve</span>
        <span className="marketing-preview-chip ghost">See why</span>
      </div>
    </div>
  );
}

function ProfitFrame() {
  return (
    <div className="marketing-preview-ui" aria-hidden="true">
      <div className="marketing-preview-ui-head">Product Profitability</div>
      <ul className="marketing-preview-table">
        <li>
          <span>Trail Jacket</span>
          <strong className="positive">+$42</strong>
        </li>
        <li>
          <span>Hiking Socks</span>
          <strong className="positive">+$18</strong>
        </li>
        <li>
          <span>Gift Bundle</span>
          <strong className="negative">−$6</strong>
        </li>
      </ul>
    </div>
  );
}

function AdsFrame() {
  return (
    <div className="marketing-preview-ui" aria-hidden="true">
      <div className="marketing-preview-ui-head">Advertising Performance</div>
      <div className="marketing-preview-metrics">
        <div>
          <span>Meta ROAS</span>
          <strong>2.4x</strong>
        </div>
        <div>
          <span>Google ROAS</span>
          <strong>1.8x</strong>
        </div>
      </div>
      <p className="marketing-preview-note">Spend is shown next to contribution, not just clicks.</p>
    </div>
  );
}

function DashboardFrame() {
  return (
    <div className="marketing-preview-ui" aria-hidden="true">
      <div className="marketing-preview-ui-head">Dashboard</div>
      <div className="marketing-preview-kpis">
        <div>
          <span>Sales</span>
          <strong>$12.4k</strong>
        </div>
        <div>
          <span>Profit</span>
          <strong>$3.1k</strong>
        </div>
        <div>
          <span>Health</span>
          <strong>74</strong>
        </div>
      </div>
      <p className="marketing-preview-note">Next action is on the same screen as the numbers.</p>
    </div>
  );
}

function Frame({ frame }: { frame: (typeof PREVIEWS)[number]["frame"] }) {
  switch (frame) {
    case "health":
      return <HealthFrame />;
    case "recommendations":
      return <RecommendationsFrame />;
    case "profit":
      return <ProfitFrame />;
    case "ads":
      return <AdsFrame />;
    case "dashboard":
      return <DashboardFrame />;
  }
}

export function ProductPreviews() {
  return (
    <section id="product" className="marketing-section" aria-labelledby="product-title">
      <h2 id="product-title">Inside StorePilot</h2>
      <p className="marketing-section-lead">
        Product screens from StorePilot AI — not customer reviews or revenue claims.
      </p>
      <ul className="marketing-previews">
        {PREVIEWS.map((preview) => (
          <li key={preview.id} className="marketing-preview-card">
            <Frame frame={preview.frame} />
            <h3>{preview.title}</h3>
            <p>{preview.caption}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
