import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://storepilot-production-d591.up.railway.app";
const LAST_UPDATED = "July 17, 2026";
const CONTACT_EMAIL = "erhanz1973@gmail.com";

export const metadata: Metadata = {
  title: "Privacy Policy — StorePilot AI",
  description:
    "How StorePilot AI collects, uses, stores, and protects data from Shopify, Google Ads, Google Analytics 4, and Meta Ads, and the rights you have under GDPR, UK GDPR, and CCPA.",
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: "Privacy Policy — StorePilot AI",
    description:
      "How StorePilot AI collects, uses, stores, and protects merchant and advertising data.",
    url: `${SITE_URL}/privacy`,
    type: "article",
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <article className="legal-page">
      <header className="page-header">
        <h1>Privacy Policy</h1>
        <p className="muted">
          Last Updated: <time dateTime="2026-07-17">{LAST_UPDATED}</time>
        </p>
      </header>

      <div className="card legal-card">
        <section aria-labelledby="who-we-are">
          <h2 id="who-we-are">1. Who We Are</h2>
          <p>
            StorePilot AI (&ldquo;StorePilot&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;) is a commerce intelligence application operated by{" "}
            <strong>Erhan Zorlu</strong> and made available at{" "}
            <a href={SITE_URL}>{SITE_URL}</a>. StorePilot AI connects to a merchant&rsquo;s
            Shopify store and, optionally, to their Google Ads, Google Analytics 4
            (&ldquo;GA4&rdquo;), and Meta Ads accounts in order to analyze store and advertising
            performance and to generate recommendations. StorePilot AI analyzes and recommends
            only — it never takes automated actions on your store or advertising accounts without
            your explicit approval.
          </p>
          <p>
            For the purposes of the EU General Data Protection Regulation (&ldquo;GDPR&rdquo;) and
            the UK GDPR, the data controller for personal data processed through StorePilot AI is
            Erhan Zorlu, reachable at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Where we process store data
            on behalf of a merchant (for example, customer records contained in Shopify order
            data), we act as a data processor and the merchant is the controller of that data.
          </p>
        </section>

        <section aria-labelledby="what-we-collect">
          <h2 id="what-we-collect">2. Information We Collect</h2>
          <p>We collect only the information needed to provide the service:</p>
          <ul>
            <li>
              <strong>Account and installation data:</strong> your Shopify store domain
              (myshopify.com address), store name, and the OAuth access tokens issued when you
              install the app or connect an integration.
            </li>
            <li>
              <strong>Shopify store data:</strong> products, orders, inventory levels,
              collections, discounts, and aggregate customer metrics, as authorized by the access
              scopes you approve during installation.
            </li>
            <li>
              <strong>Advertising and analytics data:</strong> campaign, ad set, spend,
              impression, click, conversion, and return-on-ad-spend metrics from Google Ads and
              Meta Ads, and session, traffic-source, landing-page, and conversion metrics from
              GA4 — only for the accounts and properties you explicitly connect.
            </li>
            <li>
              <strong>Connected identity data:</strong> when you connect Google or Meta, we
              receive the basic profile of the connecting user (a user ID, and for Google an
              email address and name) so we can label which account is connected.
            </li>
            <li>
              <strong>Technical data:</strong> server logs (IP address, request path, timestamp,
              user agent) generated when you use the app, retained for security and debugging.
            </li>
          </ul>
          <p>
            We do not collect payment card numbers, government identifiers, or any special
            categories of personal data. We do not sell personal information to anyone.
          </p>
        </section>

        <section aria-labelledby="shopify-data">
          <h2 id="shopify-data">3. Shopify Data Usage</h2>
          <p>
            When you install StorePilot AI from the Shopify App Store, Shopify grants us API
            access under the scopes shown on the installation screen. We use this access to
            build store performance snapshots (revenue, orders, product performance, inventory
            health) and to generate merchandising and profitability recommendations. Customer
            personal data contained in orders is processed only to compute aggregate metrics;
            we do not use it for advertising, profiling of individual shoppers, or any purpose
            unrelated to serving you.
          </p>
          <p>
            We comply with Shopify&rsquo;s{" "}
            <a
              href="https://shopify.dev/docs/apps/build/privacy-law-compliance"
              rel="noopener noreferrer"
              target="_blank"
            >
              privacy law compliance requirements
            </a>
            , including the mandatory compliance webhooks. When Shopify sends us a{" "}
            <code>customers/data_request</code>, <code>customers/redact</code>, or{" "}
            <code>shop/redact</code> webhook, we respond by exporting or deleting the relevant
            data within the required timeframe. Uninstalling the app triggers deletion of your
            store&rsquo;s access token immediately and deletion of stored store data as described
            in Section 9.
          </p>
        </section>

        <section aria-labelledby="google-ads-data">
          <h2 id="google-ads-data">4. Google Ads Data Usage</h2>
          <p>
            If you connect Google Ads, we use the Google Ads API with read-only intent to
            retrieve campaign structure and performance metrics for the customer accounts you
            select. This data is used solely to display performance dashboards and to generate
            budget, scaling, and pause recommendations inside StorePilot AI. We never create,
            edit, or pause campaigns in your Google Ads account.
          </p>
          <p>
            StorePilot AI&rsquo;s use and transfer of information received from Google APIs
            adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              rel="noopener noreferrer"
              target="_blank"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. Google user data is used only to provide
            the user-facing features described in this policy, is never sold, is never used for
            advertising, and is never transferred to third parties except as necessary to provide
            the service, comply with law, or as part of a merger or acquisition with prior notice.
            Humans do not read this data except with your consent, for security purposes, to
            comply with law, or when aggregated and anonymized.
          </p>
        </section>

        <section aria-labelledby="ga4-data">
          <h2 id="ga4-data">5. Google Analytics 4 (GA4) Data Usage</h2>
          <p>
            If you connect GA4, we use the Google Analytics Data API with the read-only
            analytics scope to retrieve aggregate metrics — sessions, users, traffic sources,
            landing pages, and conversion events — for the GA4 properties you select. We use
            these metrics to correlate site traffic with store revenue and advertising
            performance. We do not access individual visitor-level identifiers, and the same
            Google Limited Use commitments in Section 4 apply to all GA4 data.
          </p>
        </section>

        <section aria-labelledby="meta-data">
          <h2 id="meta-data">6. Meta Ads Data Usage</h2>
          <p>
            If you connect Meta Ads, we use the Meta Marketing API with the <code>ads_read</code>{" "}
            and <code>business_management</code> permissions to retrieve campaign, ad set, spend,
            reach, frequency, and conversion metrics for the ad accounts you select. This data is
            used only to display performance dashboards and generate recommendations. We never
            create, modify, publish, or pause ads, and we never access your Facebook or Instagram
            profile content, friends, messages, or audience lists.
          </p>
          <p>
            Our processing of Meta Platform Data complies with the{" "}
            <a
              href="https://developers.facebook.com/terms/"
              rel="noopener noreferrer"
              target="_blank"
            >
              Meta Platform Terms
            </a>{" "}
            and Developer Policies. Platform Data is retained only while your Meta connection is
            active and is deleted as described in Sections 9 and 10.
          </p>
        </section>

        <section aria-labelledby="cookies">
          <h2 id="cookies">7. Cookies</h2>
          <p>
            StorePilot AI uses only strictly necessary, first-party cookies. We do not use
            advertising, tracking, or third-party analytics cookies, and we do not respond to
            cross-site tracking. The cookies we set are:
          </p>
          <ul>
            <li>
              <strong>Session and store-context cookies</strong> — identify your connected store
              during a browsing session (HttpOnly, Secure).
            </li>
            <li>
              <strong>OAuth state cookies</strong> — short-lived (10 minutes) anti-forgery
              tokens set while you authorize a Google, GA4, or Meta connection (HttpOnly,
              Secure, SameSite=Lax). These protect you against cross-site request forgery
              during sign-in and are deleted as soon as the authorization completes.
            </li>
          </ul>
          <p>
            Because these cookies are essential for the service to function, they do not require
            consent under the ePrivacy rules; the app cannot operate without them.
          </p>
        </section>

        <section aria-labelledby="oauth">
          <h2 id="oauth">8. OAuth Authentication</h2>
          <p>
            All integrations use the industry-standard OAuth 2.0 authorization flow. You
            authenticate directly with Shopify, Google, or Meta on their own domains; StorePilot
            AI never sees or stores your passwords. We store only the access and refresh tokens
            those providers issue, encrypted at rest with AES-256-GCM. You can revoke our access
            at any time from your Shopify admin, your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              rel="noopener noreferrer"
              target="_blank"
            >
              Google Account permissions page
            </a>
            , or your{" "}
            <a
              href="https://www.facebook.com/settings?tab=business_tools"
              rel="noopener noreferrer"
              target="_blank"
            >
              Facebook Business Integrations settings
            </a>
            . Revoking access immediately invalidates the stored tokens.
          </p>
        </section>

        <section aria-labelledby="retention">
          <h2 id="retention">9. Data Retention</h2>
          <ul>
            <li>
              <strong>Access tokens:</strong> deleted immediately when you disconnect an
              integration, uninstall the app, or revoke access from the provider.
            </li>
            <li>
              <strong>Store and advertising snapshots:</strong> retained while your account is
              active and deleted within 30 days of app uninstallation or a{" "}
              <code>shop/redact</code> webhook.
            </li>
            <li>
              <strong>Customer personal data in Shopify order records:</strong> deleted or
              anonymized within 30 days of a <code>customers/redact</code> request.
            </li>
            <li>
              <strong>Server logs:</strong> retained for a maximum of 90 days for security and
              troubleshooting, then deleted.
            </li>
          </ul>
        </section>

        <section aria-labelledby="deletion">
          <h2 id="deletion">10. Data Deletion Requests</h2>
          <p>
            You can request deletion of all data StorePilot AI holds about you or your store at
            any time by any of the following methods:
          </p>
          <ul>
            <li>Uninstalling the app from your Shopify admin (triggers automatic deletion).</li>
            <li>Disconnecting an individual integration from the Connections page in the app.</li>
            <li>
              Emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the subject
              &ldquo;Data Deletion Request&rdquo; and your store domain. We will confirm deletion
              within 30 days.
            </li>
          </ul>
        </section>

        <section aria-labelledby="rights">
          <h2 id="rights">11. Your Rights (GDPR, UK GDPR, and CCPA)</h2>
          <p>
            If you are in the European Economic Area or the United Kingdom, you have the right to
            access, rectify, erase, restrict, or object to the processing of your personal data,
            the right to data portability, and the right to withdraw consent at any time. Our
            legal bases for processing are the performance of our contract with you (providing
            the service), our legitimate interests (security and service improvement), and your
            consent (optional integrations). You also have the right to lodge a complaint with
            your local supervisory authority.
          </p>
          <p>
            If you are a California resident, the California Consumer Privacy Act (CCPA/CPRA)
            gives you the right to know what personal information we collect (described in
            Section 2), the right to request deletion, the right to correct inaccurate
            information, and the right to non-discrimination for exercising these rights.{" "}
            <strong>We do not sell or share personal information</strong> as those terms are
            defined in the CCPA, so no opt-out is required.
          </p>
          <p>
            To exercise any of these rights, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We respond to verified
            requests within 30 days.
          </p>
        </section>

        <section aria-labelledby="security">
          <h2 id="security">12. Security</h2>
          <p>
            We protect your data with industry-standard measures: all traffic is encrypted in
            transit with TLS (HTTPS); OAuth tokens are encrypted at rest with AES-256-GCM;
            protected API routes require verified Shopify session tokens so one merchant can
            never access another merchant&rsquo;s data; and access to production systems is
            restricted and logged. No method of transmission or storage is 100% secure, but if
            we become aware of a breach affecting your personal data we will notify you and the
            relevant authorities as required by applicable law (including within 72 hours where
            GDPR applies).
          </p>
        </section>

        <section aria-labelledby="third-parties">
          <h2 id="third-parties">13. Third-Party Services</h2>
          <p>We rely on the following processors and platforms to operate the service:</p>
          <ul>
            <li>
              <strong>Shopify</strong> — commerce platform and app distribution (
              <a
                href="https://www.shopify.com/legal/privacy"
                rel="noopener noreferrer"
                target="_blank"
              >
                privacy policy
              </a>
              ).
            </li>
            <li>
              <strong>Google</strong> — Google Ads API, Google Analytics Data API, and Google
              OAuth (
              <a
                href="https://policies.google.com/privacy"
                rel="noopener noreferrer"
                target="_blank"
              >
                privacy policy
              </a>
              ).
            </li>
            <li>
              <strong>Meta Platforms</strong> — Meta Marketing API and Meta OAuth (
              <a
                href="https://www.facebook.com/privacy/policy/"
                rel="noopener noreferrer"
                target="_blank"
              >
                privacy policy
              </a>
              ).
            </li>
            <li>
              <strong>Railway</strong> — application hosting and database infrastructure (
              <a
                href="https://railway.com/legal/privacy"
                rel="noopener noreferrer"
                target="_blank"
              >
                privacy policy
              </a>
              ).
            </li>
          </ul>
          <p>
            Hosting infrastructure may store data outside your country of residence. Where data
            is transferred out of the EEA or UK, we rely on providers that offer appropriate
            safeguards such as Standard Contractual Clauses.
          </p>
        </section>

        <section aria-labelledby="children">
          <h2 id="children">14. Children&rsquo;s Privacy</h2>
          <p>
            StorePilot AI is a business tool intended for merchants and is not directed at
            children under 16. We do not knowingly collect personal data from children. If you
            believe a child has provided us with personal data, contact us and we will delete it.
          </p>
        </section>

        <section aria-labelledby="changes">
          <h2 id="changes">15. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes will be
            reflected in the &ldquo;Last Updated&rdquo; date above, and where required by law we
            will notify you through the app or by email. Continued use of the service after an
            update constitutes acceptance of the revised policy.
          </p>
        </section>

        <section aria-labelledby="contact">
          <h2 id="contact">16. Contact</h2>
          <p>
            For any privacy question, request, or complaint, contact:
            <br />
            Erhan Zorlu — StorePilot AI
            <br />
            Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <br />
            Website: <a href={SITE_URL}>{SITE_URL}</a>
          </p>
        </section>

        <footer className="legal-footer">
          <p className="muted">
            See also our <Link href="/terms">Terms of Service</Link>.
          </p>
        </footer>
      </div>
    </article>
  );
}
