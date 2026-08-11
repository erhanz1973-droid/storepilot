import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { marketingSiteMetadata } from "@/lib/marketing/metadata";
import { isMarketingPath, MARKETING_SITE_URL } from "@/lib/marketing/site";

describe("marketing landing copy", () => {
  const landing = readFileSync(
    join(process.cwd(), "src/components/marketing/LandingPage.tsx"),
    "utf8",
  );
  const shell = readFileSync(
    join(process.cwd(), "src/components/marketing/MarketingShell.tsx"),
    "utf8",
  );
  const startForm = readFileSync(
    join(process.cwd(), "src/components/marketing/StartFreeForm.tsx"),
    "utf8",
  );

  it("positions StorePilot as an AI Store Manager, not a coming-soon dashboard", () => {
    expect(landing).toContain("Your AI Store Manager for Shopify");
    expect(landing).toContain("Stop staring at dashboards. Start making better decisions.");
    expect(startForm).toContain("Start Free");
    expect(startForm).toContain("No credit card required.");
    expect(landing).toContain("Connect your Shopify store and start analyzing your business with AI.");
    expect(landing).not.toContain("Coming Soon on Shopify App Store");
  });

  it("keeps header and in-page CTAs on the Start Free form", () => {
    expect(shell).toContain('href="/#start"');
    expect(shell).toContain("Start Free");
    expect(landing).toContain('id="start"');
  });

  it("uses conversion-focused SEO title and description", () => {
    expect(marketingSiteMetadata.title).toMatchObject({
      default: "StorePilot AI — Your AI Store Manager for Shopify",
    });
    expect(marketingSiteMetadata.description).toBe(
      "StorePilot AI analyzes your Shopify store, profitability and advertising to tell you what to do next.",
    );
    expect(marketingSiteMetadata.openGraph?.title).toBe(
      "StorePilot AI — Your AI Store Manager for Shopify",
    );
    expect(marketingSiteMetadata.alternates?.canonical).toBe(MARKETING_SITE_URL);
  });

  it("exposes legal pages including data deletion on the marketing host", () => {
    expect(isMarketingPath("/")).toBe(true);
    expect(isMarketingPath("/privacy")).toBe(true);
    expect(isMarketingPath("/terms")).toBe(true);
    expect(isMarketingPath("/contact")).toBe(true);
    expect(isMarketingPath("/data-deletion")).toBe(true);
    expect(isMarketingPath("/analytics")).toBe(false);
  });
});
