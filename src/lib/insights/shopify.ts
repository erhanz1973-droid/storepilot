import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import { createCommerceOpportunity } from "./opportunity-schema";
import type { CommerceOpportunity } from "./opportunity-schema";
import { buildDeadInventoryBusinessAction, isDeadInventoryProduct } from "./business-action-groups";

export function buildShopifyInsights(
  snapshot: StoreSnapshot,
  profitDashboard?: ProfitDashboard | null,
): CommerceOpportunity[] {
  const results: CommerceOpportunity[] = [];
  const products = snapshot.products;

  for (const product of products) {
    const productStats = snapshot.productOrderStats?.[product.id];
    const dailyVelocity = product.unitsSold30d / 30;
    const daysOfCover =
      dailyVelocity > 0 ? product.inventoryQuantity / dailyVelocity : 999;

    if (product.cartAdds30d != null && product.cartAdds30d > 0 && product.unitsSold30d > 0) {
      const abandonRate = 1 - product.unitsSold30d / product.cartAdds30d;
      if (abandonRate >= 0.55 && product.cartAdds30d >= 30) {
        results.push(
          createCommerceOpportunity({
            id: `shop-cart-abandon-${product.id}`,
            source: "shopify",
            severity: abandonRate >= 0.7 ? "high" : "medium",
            confidence: 79,
            title: `High cart abandonment — ${product.title}`,
            description: `${Math.round(abandonRate * 100)}% of cart adds did not convert (${product.cartAdds30d} adds, ${product.unitsSold30d} purchases).`,
            recommendation: "Add cart recovery email, simplify checkout, or test free-shipping threshold.",
            category: "conversion",
            supportingMetrics: [
              { label: "Cart adds (30d)", value: String(product.cartAdds30d) },
              { label: "Purchases (30d)", value: String(product.unitsSold30d) },
              { label: "Abandonment rate", value: `${Math.round(abandonRate * 100)}%`, trend: "up" },
            ],
            expectedImpact: {
              revenueMonthly: Math.round(product.cartAdds30d * abandonRate * product.price * 0.25),
              label: "",
            },
            futureAction: "create_email_campaign",
            relatedEntityType: "product",
            relatedEntityId: product.id,
          }),
        );
      }
    }

    if (product.unitsSold30d >= 20 && daysOfCover <= 7 && product.inventoryQuantity > 0) {
      results.push(
        createCommerceOpportunity({
          id: `shop-low-stock-${product.id}`,
          source: "shopify",
          severity: daysOfCover <= 3 ? "critical" : "high",
          confidence: daysOfCover <= 3 ? 92 : 80,
          title: `Low inventory bestseller — ${product.title}`,
          description: `~${daysOfCover.toFixed(0)} days of cover (${product.inventoryQuantity} units).`,
          recommendation: "Restock immediately to avoid stockout on a high-velocity SKU.",
          category: "inventory",
          supportingMetrics: [
            { label: "Units on hand", value: String(product.inventoryQuantity) },
            { label: "30-day units sold", value: String(product.unitsSold30d) },
            { label: "Days of cover", value: daysOfCover.toFixed(1), trend: "down" },
          ],
          expectedImpact: {
            revenueMonthly: Math.round(dailyVelocity * product.price * 7 * 4.33),
            profitMonthly: Math.round(dailyVelocity * product.price * 7 * 4.33 * 0.35),
            label: "",
          },
          futureAction: "restock_product",
          relatedEntityType: "product",
          relatedEntityId: product.id,
        }),
      );
    }

    if (isDeadInventoryProduct(product)) {
      // Grouped into one dead-inventory business action after the product loop.
    }

    if (productStats && product.unitsSold30d >= 15) {
      const productPrev = productStats.previous30d;
      const productCur = productStats.last30d;
      if (productPrev.units > 0 && productCur.units < productPrev.units * 0.75) {
        results.push(
          createCommerceOpportunity({
            id: `shop-declining-${product.id}`,
            source: "shopify",
            severity: "medium",
            confidence: 76,
            title: `Declining sales — ${product.title}`,
            description: `Units fell from ${productPrev.units} to ${productCur.units} over 30-day windows.`,
            recommendation: "Refresh PDP content, test price, or promote via email/ads.",
            category: "trend",
            supportingMetrics: [
              { label: "Units (current 30d)", value: String(productCur.units), trend: "down" },
              { label: "Units (prior 30d)", value: String(productPrev.units) },
              { label: "Revenue (30d)", value: `$${product.revenue30d.toLocaleString()}` },
            ],
            expectedImpact: { revenueMonthly: Math.round(product.revenue30d * 0.12), label: "" },
            relatedEntityType: "product",
            relatedEntityId: product.id,
          }),
        );
      }
      if (productPrev.units > 0 && productCur.units > productPrev.units * 1.35) {
        results.push(
          createCommerceOpportunity({
            id: `shop-growing-${product.id}`,
            source: "shopify",
            severity: "low",
            confidence: 78,
            title: `Fast-growing product — ${product.title}`,
            description: `Units up ${Math.round(((productCur.units / productPrev.units) - 1) * 100)}% vs prior 30 days.`,
            recommendation: "Increase ad coverage and ensure inventory can support demand.",
            category: "product_ads",
            supportingMetrics: [
              { label: "Growth", value: `+${Math.round(((productCur.units / productPrev.units) - 1) * 100)}%`, trend: "up" },
              { label: "Units (30d)", value: String(productCur.units) },
            ],
            expectedImpact: { revenueMonthly: Math.round(product.revenue30d * 0.15), label: "" },
            futureAction: "increase_budget",
            relatedEntityType: "product",
            relatedEntityId: product.id,
          }),
        );
      }
    }

    if (product.tags.includes("bundle-candidate")) {
      const partners = products.filter(
        (p) => p.id !== product.id && p.tags.includes("bundle-candidate"),
      );
      if (partners.length > 0) {
        results.push(
          createCommerceOpportunity({
            id: `shop-bundle-${product.id}`,
            source: "shopify",
            severity: "low",
            confidence: 70,
            title: `Frequently bought together — ${product.title}`,
            description: `Bundle with ${partners[0].title} to lift AOV.`,
            recommendation: "Create a bundle offer on PDP and checkout upsell.",
            category: "pricing",
            supportingMetrics: [
              { label: "Tag", value: "bundle-candidate" },
              { label: "Partner SKU", value: partners[0].title },
            ],
            expectedImpact: { revenueMonthly: Math.round(snapshot.storeMetrics.aov30d * 0.08 * snapshot.storeMetrics.orders30d), label: "" },
            futureAction: "create_bundle",
            relatedEntityType: "product",
            relatedEntityId: product.id,
            executionParams: {
              partnerProductId: partners[0].id,
              partnerProductName: partners[0].title,
              discountPercent: 10,
              durationDays: 30,
            },
          }),
        );
      }
    }
  }

  const deadInventoryAction = buildDeadInventoryBusinessAction(products);
  if (deadInventoryAction) {
    results.push(deadInventoryAction);
  }

  const storeAvgUnits =
    products.length > 0
      ? products.reduce((s, p) => s + p.unitsSold30d, 0) / products.length
      : 0;

  const profitByProduct = new Map(
    (profitDashboard?.byProduct ?? []).map((r) => [r.productId, r]),
  );

  for (const product of products) {
    const profitRow = profitByProduct.get(product.id);
    const marginPct = profitRow?.marginPct ?? (product.unitCost
      ? ((product.price - product.unitCost) / product.price) * 100
      : 0);
    const lowTraffic = product.unitsSold30d < storeAvgUnits * 0.5;
    const highMargin = marginPct >= 45;

    if (lowTraffic && highMargin && product.price > 40) {
      results.push(
        createCommerceOpportunity({
          id: `shop-low-traffic-margin-${product.id}`,
          source: "shopify",
          severity: marginPct >= 55 ? "medium" : "low",
          confidence: profitRow ? 78 : 66,
          title: `High-margin product with little traffic — ${product.title}`,
          description: `${marginPct.toFixed(0)}% margin but only ${product.unitsSold30d} units sold in 30 days.`,
          recommendation: "Promote via collections, email, and paid ads to capture untapped margin.",
          category: "product_ads",
          supportingMetrics: [
            { label: "Margin", value: `${marginPct.toFixed(1)}%` },
            { label: "Units (30d)", value: String(product.unitsSold30d) },
            { label: "Store avg units", value: storeAvgUnits.toFixed(1) },
            { label: "Net profit (30d)", value: profitRow ? `$${Math.round(profitRow.netProfit).toLocaleString()}` : "—" },
          ],
          expectedImpact: { revenueMonthly: Math.round(product.price * 12), label: "" },
          futureAction: "increase_budget",
          relatedEntityType: "product",
          relatedEntityId: product.id,
        }),
      );
      break;
    }
  }

  for (const collection of snapshot.collections) {
    if (collection.productCount >= 3 && collection.revenue30d < snapshot.storeMetrics.revenue30d * 0.05) {
      results.push(
        createCommerceOpportunity({
          id: `shop-collection-low-${collection.id}`,
          source: "shopify",
          severity: "low",
          confidence: 64,
          title: `Low conversion collection — ${collection.title}`,
          description: `${collection.productCount} products but only $${collection.revenue30d.toLocaleString()} revenue (30d).`,
          recommendation: "Reorder collection, improve hero products, or run collection-specific promo.",
          category: "conversion",
          supportingMetrics: [
            { label: "Products", value: String(collection.productCount) },
            { label: "Revenue (30d)", value: `$${collection.revenue30d.toLocaleString()}` },
          ],
          expectedImpact: { revenueMonthly: Math.round(collection.revenue30d * 0.2), label: "" },
          relatedEntityType: "collection",
          relatedEntityId: collection.id,
        }),
      );
    }
  }

  const repeatCandidate = products.find((p) => p.unitsSold30d >= 60);
  if (repeatCandidate) {
    results.push(
      createCommerceOpportunity({
        id: "shop-returning-customers",
        source: "shopify",
        severity: "medium",
        confidence: 71,
        title: "Returning customer opportunity",
        description: `${repeatCandidate.title} buyers are a core segment — nurture repeat purchases.`,
        recommendation: "Launch VIP / early-access email flow for repeat buyers.",
        category: "pricing",
        supportingMetrics: [
          { label: "Hero SKU units (30d)", value: String(repeatCandidate.unitsSold30d) },
          { label: "Store orders (30d)", value: String(snapshot.storeMetrics.orders30d) },
        ],
        expectedImpact: { revenueMonthly: Math.round(repeatCandidate.revenue30d * 0.1), label: "" },
        futureAction: "create_email_campaign",
      }),
    );
  }

  if (profitDashboard && snapshot.storeMetrics.orders30d > 50) {
    const margin = profitDashboard.primary.profitMarginPct;
    if (margin != null && margin < 20) {
      results.push(
        createCommerceOpportunity({
          id: "shop-margin-pressure",
          source: "shopify",
          severity: "high",
          confidence: 82,
          title: "Net margin under pressure",
          description: `Store net margin ${margin.toFixed(1)}% — review COGS, ads, and discounting.`,
          recommendation: "Cut unprofitable SKUs and ad waste before scaling spend.",
          category: "pricing",
          supportingMetrics: [
            { label: "Net margin (30d)", value: `${margin.toFixed(1)}%`, trend: "down" },
            { label: "Revenue (30d)", value: `$${snapshot.storeMetrics.revenue30d.toLocaleString()}` },
          ],
          expectedImpact: { profitMonthly: Math.round(snapshot.storeMetrics.revenue30d * 0.03), label: "" },
        }),
      );
    }
  }

  return results;
}
