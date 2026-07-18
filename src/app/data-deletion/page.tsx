import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://storepilot-production-d591.up.railway.app";
const LAST_UPDATED = "July 18, 2026";
const CONTACT_EMAIL = "erhanz1973@gmail.com";

export const metadata: Metadata = {
  title: "User Data Deletion — StorePilot AI",
  description:
    "How to request deletion of your StorePilot AI data, including Shopify, Google Ads, GA4, and Meta Ads connection data, OAuth tokens, and stored analytics.",
  alternates: { canonical: `${SITE_URL}/data-deletion` },
  openGraph: {
    title: "User Data Deletion — StorePilot AI",
    description:
      "Instructions for requesting deletion of StorePilot AI connection data, OAuth tokens, and stored analytics.",
    url: `${SITE_URL}/data-deletion`,
    type: "article",
  },
  robots: { index: true, follow: true },
};

export default function DataDeletionPage() {
  return (
    <article className="legal-page">
      <header className="page-header">
        <h1>User Data Deletion</h1>
        <p className="muted">
          Last Updated: <time dateTime="2026-07-18">{LAST_UPDATED}</time>
        </p>
      </header>

      <div className="card legal-card">
        <section aria-labelledby="overview">
          <h2 id="overview">1. Overview</h2>
          <p>
            StorePilot AI (&ldquo;StorePilot&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), operated
            by <strong>Erhan Zorlu</strong>, lets you request permanent deletion of the data we
            hold about you and your store. This page explains what we delete, how to request
            deletion, and how long it takes. It is provided to meet Meta Platform requirements
            for a publicly accessible User Data Deletion URL, and also applies to Shopify, Google
            Ads, and Google Analytics 4 (&ldquo;GA4&rdquo;) connection data.
          </p>
          <p>
            Full details of what we collect and why are in our{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </section>

        <section aria-labelledby="what-we-delete">
          <h2 id="what-we-delete">2. What We Delete</h2>
          <p>When a deletion request is completed, we remove:</p>
          <ul>
            <li>
              <strong>Shopify connection data</strong> — your store domain, installation
              record, Shopify offline access token, and synced store snapshots (products,
              orders aggregates, inventory, and related merchandising metrics).
            </li>
            <li>
              <strong>Google Ads connection</strong> — selected customer accounts, campaign
              performance snapshots, and the Google Ads installation record.
            </li>
            <li>
              <strong>GA4 connection</strong> — selected GA4 properties, analytics snapshots
              (sessions, traffic sources, landing pages, conversions), and the GA4 installation
              record.
            </li>
            <li>
              <strong>Meta Ads connection</strong> — selected Meta ad accounts, campaign and
              spend metrics, Meta user profile identifiers used for the connection, and the Meta
              Ads installation record.
            </li>
            <li>
              <strong>OAuth tokens</strong> — all access tokens and refresh tokens issued by
              Shopify, Google, or Meta for StorePilot AI, including encrypted copies stored at
              rest.
            </li>
            <li>
              <strong>Stored analytics</strong> — dashboards, sync history, recommendation
              history, and other derived analytics computed from the connections above.
            </li>
          </ul>
          <p>
            We may retain anonymized, aggregated statistics that cannot identify you or your
            store, and server logs for up to 90 days for security purposes, as described in the
            Privacy Policy.
          </p>
        </section>

        <section aria-labelledby="how-to-request">
          <h2 id="how-to-request">3. How to Request Deletion</h2>
          <p>You can delete your data in any of the following ways:</p>

          <h3>Option A — Email request (recommended for Meta / full account deletion)</h3>
          <p>
            Send an email to{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Data%20Deletion%20Request`}>
              {CONTACT_EMAIL}
            </a>{" "}
            with:
          </p>
          <ul>
            <li>
              Subject line: <strong>Data Deletion Request</strong>
            </li>
            <li>Your Shopify store domain (for example, <code>your-store.myshopify.com</code>)</li>
            <li>
              Optionally, which connections to delete (Shopify, Google Ads, GA4, Meta Ads, or
              all)
            </li>
          </ul>
          <p>
            We will confirm receipt, verify ownership of the store when needed, and complete
            deletion within the timeline below.
          </p>

          <h3>Option B — Disconnect integrations inside the app</h3>
          <p>
            Open StorePilot AI from Shopify Admin, go to{" "}
            <Link href="/connections">Connections</Link>, and disconnect Google Ads, GA4, or Meta
            Ads. Disconnecting an integration immediately invalidates that provider&rsquo;s OAuth
            tokens and removes the connection record; associated analytics for that provider are
            deleted as part of the retention schedule.
          </p>

          <h3>Option C — Uninstall the Shopify app</h3>
          <p>
            Uninstall StorePilot AI from your Shopify admin. Uninstallation revokes the Shopify
            access token immediately and starts deletion of remaining store and integration data
            (including Meta, Google Ads, and GA4 data tied to that store) under the timeline
            below. Shopify also sends us the mandatory <code>shop/redact</code> compliance webhook,
            which we process as a formal deletion request.
          </p>

          <h3>Option D — Revoke access from Meta, Google, or Shopify</h3>
          <p>
            You can also revoke StorePilot&rsquo;s access from the provider&rsquo;s own settings:
          </p>
          <ul>
            <li>
              <a
                href="https://www.facebook.com/settings?tab=business_tools"
                rel="noopener noreferrer"
                target="_blank"
              >
                Facebook Business Integrations
              </a>{" "}
              — remove StorePilot AI
            </li>
            <li>
              <a
                href="https://myaccount.google.com/permissions"
                rel="noopener noreferrer"
                target="_blank"
              >
                Google Account permissions
              </a>{" "}
              — remove StorePilot AI
            </li>
            <li>Shopify Admin → Apps — uninstall StorePilot</li>
          </ul>
          <p>
            Revoking access invalidates tokens. For a complete wipe of stored analytics and
            installation records, also email us or uninstall the app so we can finish the
            deletion on our side.
          </p>
        </section>

        <section aria-labelledby="timeline">
          <h2 id="timeline">4. Expected Deletion Timeline</h2>
          <ul>
            <li>
              <strong>OAuth tokens:</strong> deleted or invalidated immediately when you
              disconnect an integration, uninstall the app, or revoke access at the provider.
            </li>
            <li>
              <strong>Connection records and stored analytics:</strong> deleted within{" "}
              <strong>30 days</strong> of a verified deletion request, app uninstall, or Shopify{" "}
              <code>shop/redact</code> webhook.
            </li>
            <li>
              <strong>Confirmation:</strong> for email requests, we reply to confirm that
              deletion has been completed, typically within 30 days of receipt.
            </li>
          </ul>
        </section>

        <section aria-labelledby="meta-users">
          <h2 id="meta-users">5. Meta Platform Users</h2>
          <p>
            If you connected Meta Ads to StorePilot AI and want Meta Platform Data removed from
            our systems, use Option A above (email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>) or disconnect Meta Ads from
            Connections and uninstall the app. This URL —{" "}
            <a href={`${SITE_URL}/data-deletion`}>{SITE_URL}/data-deletion</a> — is the official
            User Data Deletion instructions page for our Meta app listing.
          </p>
        </section>

        <section aria-labelledby="contact">
          <h2 id="contact">6. Contact</h2>
          <p>
            Erhan Zorlu — StorePilot AI
            <br />
            Email:{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Data%20Deletion%20Request`}>
              {CONTACT_EMAIL}
            </a>
            <br />
            Website: <a href={SITE_URL}>{SITE_URL}</a>
          </p>
        </section>

        <footer className="legal-footer">
          <p className="muted">
            See also our <Link href="/privacy">Privacy Policy</Link> and{" "}
            <Link href="/terms">Terms of Service</Link>.
          </p>
        </footer>
      </div>
    </article>
  );
}
