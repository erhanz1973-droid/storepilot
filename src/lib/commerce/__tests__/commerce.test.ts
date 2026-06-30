import { describe, expect, it } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { normalizeCommerceSnapshot } from "@/lib/commerce/normalize";
import { COMMERCE_PLATFORMS, getAvailableCommercePlatforms } from "@/lib/commerce/registry";
import { getConnectionsByCategory } from "@/lib/connections/catalog";

describe("Commerce provider abstraction", () => {
  it("normalizes snapshot without platform-specific fields in output", () => {
    const normalized = normalizeCommerceSnapshot(DEMO_STORE_SNAPSHOT);
    expect(normalized.platform).toBe("shopify");
    expect(normalized.products.length).toBeGreaterThan(0);
    expect(normalized.products[0].platform).toBe("shopify");
    expect(normalized.products[0].externalId).toBeTruthy();
    expect(normalized.metrics.orders30d).toBeGreaterThan(0);
  });

  it("lists Shopify as available and others as planned", () => {
    expect(getAvailableCommercePlatforms().map((p) => p.id)).toContain("shopify");
    const planned = COMMERCE_PLATFORMS.filter((p) => p.status === "planned");
    expect(planned.map((p) => p.id)).toContain("woocommerce");
    expect(planned.map((p) => p.id)).toContain("amazon_seller");
  });

  it("organizes connections catalog by category", () => {
    const grouped = getConnectionsByCategory();
    expect(grouped.commerce.length).toBeGreaterThanOrEqual(8);
    expect(grouped.advertising.some((c) => c.id === "google_ads")).toBe(true);
    expect(grouped.marketplaces.some((c) => c.id === "amazon_marketplace")).toBe(true);
  });
});
