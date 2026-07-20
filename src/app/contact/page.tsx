import Link from "next/link";
import type { Metadata } from "next";
import { marketingPageMetadata } from "@/lib/marketing/metadata";
import { MARKETING_SUPPORT_EMAIL } from "@/lib/marketing/site";

export const metadata: Metadata = marketingPageMetadata(
  "/contact",
  "Contact — StorePilot AI",
  "Contact StorePilot AI support for help with our Shopify analytics app.",
);

export default function ContactPage() {
  return (
    <article className="legal-page marketing-legal">
      <header className="page-header">
        <h1>Contact</h1>
        <p className="muted">We&apos;re here to help Shopify merchants get the most from StorePilot AI.</p>
      </header>

      <div className="card legal-card">
        <section aria-labelledby="contact-info">
          <h2 id="contact-info">StorePilot AI</h2>
          <p>
            <strong>Support Email:</strong>{" "}
            <a href={`mailto:${MARKETING_SUPPORT_EMAIL}`}>{MARKETING_SUPPORT_EMAIL}</a>
          </p>
          <p>
            <strong>Response time:</strong> Within 1 business day.
          </p>
          <p>
            For privacy or data-deletion requests, please include your Shopify store domain
            (for example, <code>your-store.myshopify.com</code>) so we can assist you quickly.
          </p>
        </section>

        <footer className="legal-footer">
          <Link href="/">← Back to home</Link>
        </footer>
      </div>
    </article>
  );
}
