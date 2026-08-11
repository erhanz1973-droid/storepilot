import Image from "next/image";
import { LandingTracker } from "@/components/marketing/LandingTracker";
import { ProductPreviews } from "@/components/marketing/ProductPreviews";
import { StartFreeForm } from "@/components/marketing/StartFreeForm";

const BENEFITS = [
  {
    title: "Know what to do next",
    description:
      "StorePilot turns your store and advertising data into actionable AI recommendations.",
  },
  {
    title: "Understand real profitability",
    description: "See which products, channels and campaigns actually make money.",
  },
  {
    title: "Manage your store with AI",
    description:
      "Get a clear view of what needs attention instead of jumping between multiple dashboards.",
  },
] as const;

const FLOW = ["Data", "Analysis", "Recommendation", "Action"] as const;

export function LandingPage() {
  return (
    <>
      <LandingTracker />

      <section className="marketing-hero" aria-labelledby="hero-title">
        <div className="marketing-hero-inner">
          <Image
            src="/images/logo.png"
            alt=""
            width={64}
            height={64}
            className="marketing-hero-logo"
            priority
          />
          <p className="marketing-hero-brand">StorePilot AI</p>
          <h1 id="hero-title">Your AI Store Manager for Shopify</h1>
          <p className="marketing-hero-lead">
            Stop staring at dashboards. Start making better decisions.
          </p>
          <p className="marketing-hero-subtitle">
            StorePilot AI analyzes your sales, products, profitability and advertising to tell you{" "}
            <strong>what to do next</strong>.
          </p>
          <StartFreeForm id="start" variant="hero" />
          <p className="marketing-connect-hint">
            Connect your Shopify store and start analyzing your business with AI.
          </p>
          <p className="marketing-trust-line">
            Sales · Profitability · Meta Ads · Google Ads · AI Recommendations
          </p>
        </div>
      </section>

      <section id="benefits" className="marketing-section" aria-labelledby="benefits-title">
        <h2 id="benefits-title">What you get</h2>
        <ul className="marketing-features">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="marketing-feature-card">
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="how-it-works"
        className="marketing-section marketing-about"
        aria-labelledby="how-title"
      >
        <h2 id="how-title">Your Shopify store already has the data. StorePilot turns it into decisions.</h2>
        <p>
          StorePilot connects your Shopify store with your advertising and analytics data, analyzes
          performance and identifies the actions that can improve your business.
        </p>
        <ol className="marketing-flow">
          {FLOW.map((step, index) => (
            <li key={step}>
              <span className="marketing-flow-step">{step}</span>
              {index < FLOW.length - 1 ? (
                <span className="marketing-flow-arrow" aria-hidden="true">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <ProductPreviews />

      <section className="marketing-section marketing-bottom-cta" aria-labelledby="bottom-cta-title">
        <h2 id="bottom-cta-title">Start analyzing your store with AI</h2>
        <p>Connect Shopify. StorePilot shows you what to do next. No credit card required.</p>
        <StartFreeForm id="start-bottom" variant="footer" />
      </section>
    </>
  );
}
