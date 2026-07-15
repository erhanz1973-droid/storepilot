import Link from "next/link";

export function ExecutiveDemoBanner() {
  return (
    <div className="exec-demo-banner exec-demo-banner-compact" role="status">
      <div className="exec-demo-banner-content">
        <span className="exec-demo-banner-badge">Demo Store</span>
        <p className="exec-demo-banner-text">
          You&apos;re viewing sample business data.{" "}
          <span className="muted">
            Connect your Shopify store — then StorePilot will analyze your catalog and prepare your
            first executive recommendation.
          </span>
        </p>
      </div>
      <Link href="/first-run" className="btn btn-ghost exec-demo-banner-cta">
        Start first-run
      </Link>
    </div>
  );
}
