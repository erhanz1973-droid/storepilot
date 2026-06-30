import Link from "next/link";

export function ExecutiveDemoBanner() {
  return (
    <div className="exec-demo-banner exec-demo-banner-compact" role="status">
      <div className="exec-demo-banner-content">
        <span className="exec-demo-banner-badge">Demo Store</span>
        <p className="exec-demo-banner-text">
          You&apos;re viewing sample business data.{" "}
          <span className="muted">Connect your Shopify store for personalized AI recommendations.</span>
        </p>
      </div>
      <Link href="/connections" className="btn btn-ghost exec-demo-banner-cta">
        Connect Store
      </Link>
    </div>
  );
}
