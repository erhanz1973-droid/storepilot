import Image from "next/image";

const FEATURES = [
  {
    title: "Unified Analytics",
    description: "See sales, traffic, and advertising metrics in one place.",
  },
  {
    title: "AI Recommendations",
    description: "Actionable insights to grow revenue and reduce wasted spend.",
  },
  {
    title: "Profitability Tracking",
    description: "Understand margins, costs, and true store performance.",
  },
  {
    title: "Advertising Performance",
    description: "Connect Google Ads and Meta Ads to measure ROAS alongside sales.",
  },
  {
    title: "Store Health Score",
    description: "A clear signal of inventory, orders, and operational health.",
  },
  {
    title: "Custom Reports",
    description: "Executive summaries and reports built for Shopify merchants.",
  },
] as const;

export function LandingPage() {
  return (
    <>
      <section className="marketing-hero" aria-labelledby="hero-title">
        <div className="marketing-hero-inner">
          <Image
            src="/images/logo.png"
            alt=""
            width={88}
            height={88}
            className="marketing-hero-logo"
            priority
          />
          <h1 id="hero-title">StorePilot AI</h1>
          <p className="marketing-hero-subtitle">
            AI-powered analytics, profitability and advertising insights for Shopify merchants.
          </p>
          <p className="marketing-cta" role="status">
            Coming Soon on Shopify App Store
          </p>
        </div>
      </section>

      <section id="features" className="marketing-section" aria-labelledby="features-title">
        <h2 id="features-title">Features</h2>
        <ul className="marketing-features">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="marketing-feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="about" className="marketing-section marketing-about" aria-labelledby="about-title">
        <h2 id="about-title">About</h2>
        <p>
          StorePilot AI helps Shopify merchants monitor sales, advertising, profitability, and store
          performance from a single dashboard. Install from Shopify Admin, connect your store, and
          optionally link Google Ads, Meta Ads, and Google Analytics 4 for a complete picture of
          what drives growth.
        </p>
      </section>
    </>
  );
}
