import type { Metadata } from "next";
import Link from "next/link";
import { marketingPageMetadata } from "@/lib/marketing/metadata";
import { MARKETING_SITE_URL, MARKETING_SUPPORT_EMAIL } from "@/lib/marketing/site";

const LAST_UPDATED = "July 20, 2026";
const CONTACT_EMAIL = MARKETING_SUPPORT_EMAIL;

export const metadata: Metadata = marketingPageMetadata(
  "/terms",
  "Terms of Service — StorePilot AI",
  "The terms governing use of StorePilot AI, including the free plan, user responsibilities, and limitation of liability.",
);

export default function TermsOfServicePage() {
  return (
    <article className="legal-page">
      <header className="page-header">
        <h1>Terms of Service</h1>
        <p className="muted">
          Last Updated: <time dateTime="2026-07-17">{LAST_UPDATED}</time>
        </p>
      </header>

      <div className="card legal-card">
        <section aria-labelledby="acceptance">
          <h2 id="acceptance">1. Acceptance of These Terms</h2>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) are a binding agreement between you
            (the merchant or business installing or using the app) and{" "}
            <strong>Erhan Zorlu</strong>, the operator of StorePilot AI
            (&ldquo;StorePilot&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), available at{" "}
            <a href={MARKETING_SITE_URL}>{MARKETING_SITE_URL}</a>. By installing StorePilot AI from the Shopify App
            Store, connecting an integration, or otherwise using the service, you agree to these
            Terms and to our <Link href="/privacy">Privacy Policy</Link>. If you use the service
            on behalf of a business, you represent that you have authority to bind that business.
          </p>
        </section>

        <section aria-labelledby="service">
          <h2 id="service">2. Service Description</h2>
          <p>
            StorePilot AI is a commerce intelligence application that connects to your Shopify
            store and, optionally, to your Google Ads, Google Analytics 4, and Meta Ads accounts.
            It aggregates your store and advertising data into dashboards and uses analytical and
            AI-assisted models to generate insights and recommendations — for example on
            merchandising, pricing, inventory, campaign budgets, and profitability.
          </p>
          <p>
            <strong>StorePilot AI analyzes and recommends; it does not act autonomously.</strong>{" "}
            The service never creates, edits, pauses, or publishes products, discounts, campaigns,
            or ads in your connected accounts without an action you explicitly initiate and
            approve. All business decisions based on the service&rsquo;s output remain yours.
          </p>
        </section>

        <section aria-labelledby="subscription">
          <h2 id="subscription">3. Subscription and Fees</h2>
          <p>
            StorePilot AI Version 1 is offered as a <strong>completely free plan</strong>
            (&ldquo;Free Early Access&rdquo;). Every feature currently in the app is included at
            no charge, with no credit card required and no hidden fees. No charges are processed
            through the Shopify Billing API for Version 1.
          </p>
          <p>
            We may introduce paid plans in the future. If we do, we will announce them in
            advance, any charge will be processed through Shopify&rsquo;s Billing API with your
            explicit approval, and you will never be charged automatically or retroactively for
            your use of the free plan. Features available on the free plan at the time of a
            pricing change will be handled transparently, with notice before any feature moves
            to a paid tier.
          </p>
        </section>

        <section aria-labelledby="responsibilities">
          <h2 id="responsibilities">4. User Responsibilities</h2>
          <p>You agree to:</p>
          <ul>
            <li>
              provide accurate information and connect only Shopify stores and advertising
              accounts you own or are authorized to manage;
            </li>
            <li>
              keep your Shopify, Google, and Meta account credentials secure — access to the app
              flows through those accounts, and you are responsible for activity under them;
            </li>
            <li>
              use the service in compliance with all applicable laws and with the terms of
              Shopify, Google, and Meta, including advertising policies applicable to your
              campaigns;
            </li>
            <li>
              review recommendations before acting on them — the service provides decision
              support, not professional financial, legal, or tax advice;
            </li>
            <li>
              not misuse the service, including by attempting to access another merchant&rsquo;s
              data, probing or circumventing security controls, reverse engineering the service,
              scraping it, reselling it, or using it to build a competing product.
            </li>
          </ul>
        </section>

        <section aria-labelledby="api-usage">
          <h2 id="api-usage">5. API Usage and Third-Party Platforms</h2>
          <p>
            The service depends on APIs operated by Shopify, Google, and Meta. Your use of data
            from those platforms through StorePilot AI is also governed by their respective
            terms, and those platforms may change, rate-limit, or revoke API access at any time,
            which can affect the availability or accuracy of the service. We are not responsible
            for outages, data errors, or policy changes originating from third-party platforms.
          </p>
          <p>
            Access tokens you grant us are used solely to provide the service, as described in
            our <Link href="/privacy">Privacy Policy</Link>. You may revoke access at any time
            from the app&rsquo;s Connections page, your Shopify admin, or the provider&rsquo;s
            own security settings. You may not use the service to violate the API terms of any
            connected platform.
          </p>
        </section>

        <section aria-labelledby="termination">
          <h2 id="termination">6. Account Termination</h2>
          <p>
            <strong>By you:</strong> you can stop using the service at any time by uninstalling
            the app from your Shopify admin. Uninstallation revokes our access token immediately
            and triggers deletion of your stored data as described in the Privacy Policy.
          </p>
          <p>
            <strong>By us:</strong> we may suspend or terminate your access, with notice where
            practicable, if you materially breach these Terms, misuse the service, create
            security or legal risk, or if we discontinue the service. Where reasonably possible
            we will give at least 30 days&rsquo; notice before discontinuing the service
            entirely. Sections 7 through 10 survive termination.
          </p>
        </section>

        <section aria-labelledby="ip">
          <h2 id="ip">7. Intellectual Property</h2>
          <p>
            The service — including its software, design, dashboards, models, documentation, and
            the StorePilot AI name and branding — is owned by Erhan Zorlu and protected by
            intellectual property laws. We grant you a limited, non-exclusive, non-transferable,
            revocable license to use the service for your own business while these Terms are in
            effect. No other rights are granted.
          </p>
          <p>
            <strong>Your data remains yours.</strong> You retain all rights to your store and
            advertising data. You grant us a limited license to process that data solely to
            provide and improve the service, as described in the Privacy Policy. Insights and
            recommendations generated for your account are yours to use in your business.
          </p>
        </section>

        <section aria-labelledby="warranty">
          <h2 id="warranty">8. Warranty Disclaimer</h2>
          <p>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;, WITHOUT
            WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES
            OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT.
            WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR
            THAT INSIGHTS AND RECOMMENDATIONS WILL BE ACCURATE OR PRODUCE ANY PARTICULAR BUSINESS
            RESULT. AI-GENERATED ANALYSIS MAY CONTAIN ERRORS; YOU ARE RESPONSIBLE FOR VERIFYING
            ANY RECOMMENDATION BEFORE ACTING ON IT.
          </p>
        </section>

        <section aria-labelledby="liability">
          <h2 id="liability">9. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS,
            REVENUE, DATA, OR GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF (OR INABILITY TO
            USE) THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL
            AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER
            OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM
            AROSE, OR (B) ONE HUNDRED US DOLLARS (USD $100).
          </p>
          <p>
            Nothing in these Terms excludes or limits liability that cannot be excluded or
            limited under applicable law, including liability for fraud or for death or personal
            injury caused by negligence. If you are a consumer in a jurisdiction whose law grants
            you mandatory rights, those rights are unaffected.
          </p>
        </section>

        <section aria-labelledby="governing-law">
          <h2 id="governing-law">10. Governing Law and Disputes</h2>
          <p>
            These Terms are governed by the laws of the Republic of Türkiye, without regard to
            conflict-of-law principles. The courts of Istanbul, Türkiye have exclusive
            jurisdiction over any dispute arising from these Terms or the service, except that
            either party may seek injunctive relief in any court of competent jurisdiction, and
            except where the mandatory consumer-protection law of your country of residence
            provides otherwise. Before starting formal proceedings, you agree to first contact us
            at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> so we can attempt to
            resolve the dispute informally within 30 days.
          </p>
        </section>

        <section aria-labelledby="general">
          <h2 id="general">11. General</h2>
          <p>
            We may update these Terms from time to time; material changes will be reflected in
            the &ldquo;Last Updated&rdquo; date and, where required, notified through the app.
            Continued use after an update constitutes acceptance. If any provision of these Terms
            is found unenforceable, the remaining provisions remain in effect. Our failure to
            enforce a provision is not a waiver. You may not assign these Terms without our
            consent; we may assign them in connection with a merger, acquisition, or sale of
            assets. These Terms, together with the Privacy Policy, are the entire agreement
            between you and us regarding the service.
          </p>
        </section>

        <section aria-labelledby="contact">
          <h2 id="contact">12. Contact Information</h2>
          <p>
            Questions about these Terms:
            <br />
            Erhan Zorlu — StorePilot AI
            <br />
            Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <br />
            Website: <a href={MARKETING_SITE_URL}>{MARKETING_SITE_URL}</a>
          </p>
        </section>

        <footer className="legal-footer">
          <p className="muted">
            See also our <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </footer>
      </div>
    </article>
  );
}
